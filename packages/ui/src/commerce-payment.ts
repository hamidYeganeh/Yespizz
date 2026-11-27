import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { CommerceError, findOrder, saveOrder, transition, withCommerce, type Order } from "./commerce-store";
import { getRecord, writeRecord } from "./commerce-store";
import { sendOrderPush } from "./commerce-push";
import { restaurantCommission } from "./order-store";

type StripeSession = { id: string; url: string | null; status: string; payment_status: string;
  amount_total: number; currency: string; client_reference_id: string; payment_intent: string | null;
  mode?: string; customer?: string; setup_intent?: string; metadata?: Record<string, string> };
type StripeRefund = { id: string; status: string; amount: number; metadata?: Record<string, string> };
type StripeAccount = { id: string; charges_enabled: boolean; payouts_enabled: boolean; capabilities?: { transfers?: string } };
type StripeCard = { id: string; customer: string; card?: { brand: string; last4: string; exp_month: number; exp_year: number } };

async function stripe<T>(path: string, data?: Record<string, string>, key?: string): Promise<T> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new CommerceError(503, "Online payments are not configured.");
  const headers = new Headers({ Authorization: `Bearer ${secret}` });
  if (key) headers.set("Idempotency-Key", key);
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers, method: data ? "POST" : "GET", body: data && new URLSearchParams(data),
    cache: "no-store", signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new CommerceError(502, "The payment provider could not complete this request. Please try again.");
  return response.json();
}

export function localDemo() {
  const isolatedMobile = Boolean(process.env.YESPIZZ_MOBILE_DEMO_ORIGIN?.startsWith("https://") &&
    process.env.YESPIZZ_MOBILE_DEMO_ORIGIN === process.env.BETTER_AUTH_URL && !process.env.STRIPE_SECRET_KEY);
  return (process.env.NODE_ENV === "development" || isolatedMobile) && process.env.YESPIZZ_LOCAL_DEMO === "1" &&
    withCommerce(db => Boolean(db.prepare("SELECT 1 FROM commerce_records WHERE scope='system' AND collection='configuration' AND id='local-demo'").get()));
}

export function paymentsAvailable() {
  return localDemo() || Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET &&
    (process.env.NODE_ENV !== "production" || process.env.BETTER_AUTH_URL));
}

function stripeCustomer(shopper: string) {
  const id = getRecord(`customer:${shopper}`, "stripe", "customer")?.stripeId;
  return typeof id === "string" ? id : null;
}

export async function openCardSetup(shopper: string, email: string, origin: string) {
  if (!paymentsAvailable()) throw new CommerceError(503, "Card setup is unavailable.");
  let customer = stripeCustomer(shopper);
  if (!customer) {
    const result = await stripe<{ id: string }>("customers", { email, "metadata[profile]": shopper }, `customer-${shopper}`);
    customer = result.id;
    writeRecord(`customer:${shopper}`, "stripe", "customer", { stripeId: customer });
  }
  const returnUrl = new URL("/profile/payment", process.env.BETTER_AUTH_URL || origin).href;
  const session = await stripe<StripeSession>("checkout/sessions", { mode: "setup", customer, "payment_method_types[0]": "card",
    "metadata[shopper]": shopper, success_url: returnUrl + "?card=added", cancel_url: returnUrl });
  return { url: session.url };
}

export async function cardsFor(shopper: string) {
  const customer = stripeCustomer(shopper);
  if (!customer) return [];
  const result = await stripe<{ data: StripeCard[] }>(`customers/${encodeURIComponent(customer)}/payment_methods?type=card`);
  return result.data.flatMap(method => method.card ? [{ id: method.id, ...method.card }] : []);
}

export async function removeCard(shopper: string, id: string) {
  const customer = stripeCustomer(shopper);
  if (!customer || !/^pm_[a-zA-Z0-9_]{1,100}$/.test(id)) throw new CommerceError(404, "Card not found.");
  const method = await stripe<StripeCard>(`payment_methods/${encodeURIComponent(id)}`);
  if (method.customer !== customer) throw new CommerceError(404, "Card not found.");
  await stripe(`payment_methods/${encodeURIComponent(id)}/detach`, {}, `detach-${id}`);
  return { ok: true };
}

export function connectEnabled() { return process.env.STRIPE_CONNECT_ENABLED === "1" && Boolean(process.env.STRIPE_SECRET_KEY); }

export async function connectStatus(owner: string) {
  const id = getRecord(owner, "stripe-connect", "account")?.accountId;
  if (!connectEnabled() || typeof id !== "string") return { enabled: connectEnabled(), ready: false };
  const account = await stripe<StripeAccount>(`accounts/${encodeURIComponent(id)}`);
  const ready = account.charges_enabled && account.payouts_enabled && account.capabilities?.transfers === "active";
  writeRecord(owner, "stripe-connect", "account", { accountId: account.id, ready });
  return { enabled: true, ready };
}

export async function connectRestaurant(owner: string, origin: string) {
  if (!connectEnabled()) throw new CommerceError(503, "Stripe Connect is not configured.");
  let account = getRecord(owner, "stripe-connect", "account")?.accountId;
  if (typeof account !== "string") {
    const result = await stripe<StripeAccount>("accounts", {
      country: "AT", "controller[stripe_dashboard][type]": "express", "controller[fees][payer]": "application",
      "controller[losses][payments]": "application", "controller[requirement_collection]": "stripe",
      "capabilities[card_payments][requested]": "true", "capabilities[transfers][requested]": "true",
    }, `connect-${owner}`);
    account = result.id;
    writeRecord(owner, "stripe-connect", "account", { accountId: account, ready: false });
  }
  const returnUrl = new URL("/dashboard/commerce?connect=1", process.env.BUSINESS_AUTH_URL || origin).href;
  return stripe<{ url: string }>("account_links", { account: String(account), type: "account_onboarding", refresh_url: returnUrl, return_url: returnUrl });
}

export async function startPayment(order: Order, requestOrigin: string) {
  if (localDemo()) {
    const url = new URL(`/orders/${encodeURIComponent(order.reference)}`, requestOrigin);
    if (!["127.0.0.1", "localhost"].includes(url.hostname) && url.origin !== process.env.YESPIZZ_MOBILE_DEMO_ORIGIN) {
      throw new CommerceError(403, "Unknown demo checkout origin.");
    }
    withCommerce(db => {
      const current = findOrder(db, order.reference)!;
      if (current.paymentStatus === "paid") return;
      if (current.stage !== "pending_payment") throw new CommerceError(409, "This order is no longer awaiting payment.");
      current.paymentStatus = "paid";
      transition(current, "received");
      saveOrder(db, current);
    }, true);
    url.searchParams.set("payment", "return");
    if (!order.shopper) url.searchParams.set("access", order.accessToken);
    return { url: url.pathname + url.search };
  }
  if (!paymentsAvailable()) throw new CommerceError(503, "Online payments are not configured.");
  if (order.stage !== "pending_payment") throw new CommerceError(409, "This order is no longer awaiting payment.");
  let attempt = order.attempt;
  if (order.sessionId) {
    const current = await stripe<StripeSession>(`checkout/sessions/${encodeURIComponent(order.sessionId)}`);
    if (current.status === "open" && current.url) return { url: current.url };
    if (current.status !== "expired" && !(current.status === "complete" && order.paymentStatus === "failed")) return { url: null };
    attempt = withCommerce(db => {
      const latest = findOrder(db, order.reference)!;
      if (latest.stage !== "pending_payment") throw new CommerceError(409, "This order is no longer awaiting payment.");
      if (latest.sessionId === order.sessionId) {
        latest.attempt++;
        latest.sessionId = null;
        latest.paymentStatus = "pending";
        saveOrder(db, latest);
      }
      return latest.attempt;
    }, true);
  }
  if (connectEnabled() && order.owner !== "yespizz" && !order.destination) {
    const account = getRecord(order.owner, "stripe-connect", "account");
    if (typeof account?.accountId !== "string" || account.ready !== true) throw new CommerceError(503, "This restaurant has not completed its payment setup.");
    const applicationFee = Math.min(order.total, Math.max(0, Math.round(order.total * restaurantCommission(order.owner) / 100)));
    order = withCommerce(db => {
      const latest = findOrder(db, order.reference)!;
      if (latest.stage !== "pending_payment") throw new CommerceError(409, "Payment state changed. Refresh the order.");
      if (!latest.destination) { latest.destination = String(account.accountId); latest.applicationFee = applicationFee; saveOrder(db, latest); }
      return latest;
    }, true);
  }
  const origin = new URL(process.env.BETTER_AUTH_URL || requestOrigin).origin;
  const resultUrl = new URL(`/orders/${encodeURIComponent(order.reference)}`, origin);
  resultUrl.searchParams.set("payment", "return");
  if (!order.shopper) resultUrl.searchParams.set("access", order.accessToken);
  const customer = order.shopper && stripeCustomer(order.shopper);
  const session = await stripe<StripeSession>("checkout/sessions", {
    mode: "payment", client_reference_id: order.reference, ...(customer ? { customer } : { customer_email: order.email }),
    success_url: resultUrl.href, cancel_url: `${origin}/payment?resume=${encodeURIComponent(order.reference)}`,
    "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][unit_amount]": String(order.total),
    "line_items[0][price_data][product_data][name]": `Yespizz ${order.reference}`,
    "metadata[reference]": order.reference, "payment_intent_data[metadata][reference]": order.reference,
    ...(order.destination && { "payment_intent_data[transfer_data][destination]": order.destination,
      "payment_intent_data[application_fee_amount]": String(order.applicationFee ?? 0) }),
  }, `order-${order.reference}-${attempt}`);
  withCommerce(db => {
    const latest = findOrder(db, order.reference)!;
    if (latest.stage !== "pending_payment" || latest.attempt !== attempt) throw new CommerceError(409, "Payment state changed. Refresh the order.");
    latest.sessionId = session.id;
    saveOrder(db, latest);
  }, true);
  return { url: session.url };
}

function locatePayment(session: StripeSession) {
  return withCommerce(db => {
    const order = findOrder(db, session.client_reference_id);
    if (!order || session.id !== order.sessionId || session.amount_total !== order.total || session.currency !== "eur") return null;
    if (session.payment_status === "paid" && order.stage === "pending_payment") {
      order.paymentIntent = session.payment_intent;
      order.paymentStatus = "paid";
      transition(order, "received");
      saveOrder(db, order);
    } else if (order.stage === "pending_payment" && session.status === "expired") {
      order.paymentStatus = "failed";
      saveOrder(db, order);
    }
    return order;
  }, true);
}

async function sendReceipt(order: Order) {
  const { RESEND_API_KEY, AUTH_EMAIL_FROM, BETTER_AUTH_URL } = process.env;
  if (!RESEND_API_KEY || !AUTH_EMAIL_FROM || !BETTER_AUTH_URL || !order.email || order.paymentStatus !== "paid") return;
  if (getRecord("system", "order-receipts", order.reference)) return;
  const link = new URL(`/orders/${encodeURIComponent(order.reference)}`, BETTER_AUTH_URL);
  if (!order.shopper) link.searchParams.set("access", order.accessToken);
  const lines = order.lines.map(line => `${line.quantity} × ${line.name}`).join("\n");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json",
      "Idempotency-Key": `receipt-${order.reference}` }, signal: AbortSignal.timeout(8000),
    body: JSON.stringify({ from: AUTH_EMAIL_FROM, to: [order.email], subject: `Yespizz · ${order.reference}`,
      text: `${lines}\n\nTotal: ${(order.total / 100).toFixed(2)} EUR\n${order.tax === undefined ? "" : `Included VAT: ${(order.tax / 100).toFixed(2)} EUR\n`}${link.href}` }),
  });
  if (!response.ok) throw new CommerceError(502, "The receipt email could not be sent.");
  writeRecord("system", "order-receipts", order.reference, { sentAt: new Date().toISOString() });
}

function applyRefund(refund: StripeRefund) {
  const reference = refund.metadata?.reference;
  if (!reference) return;
  withCommerce(db => {
    const order = findOrder(db, reference);
    if (!order || refund.amount !== order.total || order.paymentStatus === "refunded") return;
    order.lastRefundId = refund.id;
    order.paymentStatus = refund.status === "succeeded" ? "refunded" :
      ["failed", "canceled"].includes(refund.status) ? "refund_failed" : "refund_pending";
    saveOrder(db, order);
  }, true);
}

export async function settleDelivery(order: Order) {
  if (!order.sharedPayout || !order.paymentIntent) return;
  if (getRecord("system", "restaurant-transfers", order.reference)) return;
  const destination = getRecord(order.owner, "stripe-connect", "account")?.accountId;
  if (typeof destination !== "string") throw new CommerceError(409, "Restaurant payout account unavailable.");
  const amount = order.total - Math.round(order.total * restaurantCommission(order.owner) / 100);
  if (amount <= 0) return;
  const payment = await stripe<{latest_charge:string}>(`payment_intents/${encodeURIComponent(order.paymentIntent)}`);
  const transfer = await stripe<{id:string}>("transfers", { amount: String(amount), currency: order.currency, destination,
    source_transaction: payment.latest_charge, transfer_group: order.reference }, `delivery-${order.reference}`);
  writeRecord("system", "restaurant-transfers", order.reference, { transferId: transfer.id });
}

export async function refundPayment(order: Order) {
  if (order.paymentStatus === "refunded" || order.paymentStatus === "refund_pending") return;
  if (localDemo() && order.paymentStatus === "paid" && !order.paymentIntent) {
    withCommerce(db => {
      const current = findOrder(db, order.reference)!;
      current.paymentStatus = "refunded";
      saveOrder(db, current);
    }, true);
    return;
  }
  if ((order.paymentStatus !== "paid" && order.paymentStatus !== "refund_failed") || !order.paymentIntent) {
    throw new CommerceError(409, "There is no confirmed payment to refund.");
  }
  const transfer = getRecord("system", "restaurant-transfers", order.reference);
  if (typeof transfer?.transferId === "string" && !transfer.reversed) {
    await stripe(`transfers/${encodeURIComponent(transfer.transferId)}/reversals`, {}, `reverse-${order.reference}`);
    writeRecord("system", "restaurant-transfers", order.reference, { ...transfer, reversed: true });
  }
  const refund = await stripe<StripeRefund>("refunds", {
    payment_intent: order.paymentIntent, amount: String(order.total), "metadata[reference]": order.reference,
    ...(order.destination && { reverse_transfer: "true", ...(order.applicationFee ? { refund_application_fee: "true" } : {}) }),
  }, `refund-${order.reference}-${order.lastRefundId ?? "first"}`);
  applyRefund(refund);
}

export async function stripeWebhook(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new CommerceError(503, "Payment webhooks are not configured.");
  const raw = await request.text();
  const segments = request.headers.get("stripe-signature")?.split(",").map(pair => pair.trim()) ?? [];
  const timestamp = segments.find(segment => segment.startsWith("t="))?.slice(2) ?? "";
  const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest();
  const signed = /^\d+$/.test(timestamp) && Math.abs(Date.now() / 1000 - Number(timestamp)) <= 300 && segments.some(segment => {
    if (!/^v1=[a-f0-9]{64}$/i.test(segment)) return false;
    return timingSafeEqual(expected, Buffer.from(segment.slice(3), "hex"));
  });
  if (!signed) throw new CommerceError(400, "Invalid payment webhook signature.");
  const { type, data } = JSON.parse(raw) as { type: string; data: { object: StripeSession | StripeRefund } };
  if (["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.expired", "checkout.session.async_payment_failed"].includes(type)) {
    const session = data.object as StripeSession;
    if (type === "checkout.session.completed" && session.mode === "setup" && session.setup_intent && session.metadata?.shopper &&
      session.customer && session.customer === stripeCustomer(session.metadata.shopper)) {
      const intent = await stripe<{ status: string; customer: string; payment_method: string }>(`setup_intents/${encodeURIComponent(session.setup_intent)}`);
      if (intent.status === "succeeded" && intent.customer === session.customer && intent.payment_method) {
        await stripe(`payment_methods/${encodeURIComponent(intent.payment_method)}`, { allow_redisplay: "always" }, `redisplay-${session.id}`);
      }
      return { received: true };
    }
    const order = locatePayment(type === "checkout.session.async_payment_failed" ? { ...session, status: "expired" } : session);
    if (order && session.payment_status === "paid") await Promise.all([sendReceipt(order), sendOrderPush(order, "received")]);
  }
  if (["refund.created", "refund.updated", "refund.failed"].includes(type)) applyRefund(data.object as StripeRefund);
  return { received: true };
}
