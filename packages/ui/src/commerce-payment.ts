import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { CommerceError, findOrder, saveOrder, transition, withCommerce, type Order } from "./commerce-store";

type StripeSession = { id: string; url: string | null; status: string; payment_status: string;
  amount_total: number; currency: string; client_reference_id: string; payment_intent: string | null };
type StripeRefund = { id: string; status: string; amount: number; metadata?: Record<string, string> };

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

export function paymentsAvailable() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

export async function startPayment(order: Order, requestOrigin: string) {
  if (!paymentsAvailable()) throw new CommerceError(503, "Online payments are not configured.");
  if (order.stage !== "pending_payment") throw new CommerceError(409, "This order is no longer awaiting payment.");
  let attempt = order.attempt;
  if (order.sessionId) {
    const current = await stripe<StripeSession>(`checkout/sessions/${encodeURIComponent(order.sessionId)}`);
    if (current.status === "open" && current.url) return { url: current.url };
    if (current.status !== "expired") return { url: null };
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
  const origin = new URL(process.env.BETTER_AUTH_URL || requestOrigin).origin;
  const resultUrl = `${origin}/orders/${encodeURIComponent(order.reference)}`;
  const session = await stripe<StripeSession>("checkout/sessions", {
    mode: "payment", currency: "eur", client_reference_id: order.reference, customer_email: order.email,
    success_url: `${resultUrl}?payment=return`, cancel_url: `${origin}/payment?resume=${encodeURIComponent(order.reference)}`,
    "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][unit_amount]": String(order.total),
    "line_items[0][price_data][product_data][name]": `Yespizz ${order.reference}`,
    "metadata[reference]": order.reference, "payment_intent_data[metadata][reference]": order.reference,
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
  const link = new URL(`/orders/${encodeURIComponent(order.reference)}`, BETTER_AUTH_URL);
  if (!order.shopper) link.searchParams.set("access", order.accessToken);
  const lines = order.lines.map(line => `${line.quantity} × ${line.name}`).join("\n");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json",
      "Idempotency-Key": `receipt-${order.reference}` }, signal: AbortSignal.timeout(8000),
    body: JSON.stringify({ from: AUTH_EMAIL_FROM, to: [order.email], subject: `Yespizz · ${order.reference}`,
      text: `${lines}\n\nTotal: ${(order.total / 100).toFixed(2)} EUR\n${link.href}` }),
  });
  if (!response.ok) throw new CommerceError(502, "The receipt email could not be sent.");
}

function applyRefund(refund: StripeRefund) {
  const reference = refund.metadata?.reference;
  if (!reference) return;
  withCommerce(db => {
    const order = findOrder(db, reference);
    if (!order || refund.amount !== order.total || order.paymentStatus === "refunded") return;
    order.paymentStatus = refund.status === "succeeded" ? "refunded" :
      ["failed", "canceled"].includes(refund.status) ? "refund_failed" : "refund_pending";
    saveOrder(db, order);
  }, true);
}

export async function refundPayment(order: Order) {
  if (order.paymentStatus === "refunded" || order.paymentStatus === "refund_pending") return;
  if ((order.paymentStatus !== "paid" && order.paymentStatus !== "refund_failed") || !order.paymentIntent) {
    throw new CommerceError(409, "There is no confirmed payment to refund.");
  }
  const refund = await stripe<StripeRefund>("refunds", {
    payment_intent: order.paymentIntent, amount: String(order.total), "metadata[reference]": order.reference,
  }, `refund-${order.reference}`);
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
    const order = locatePayment(type === "checkout.session.async_payment_failed" ? { ...session, status: "expired" } : session);
    if (order && session.payment_status === "paid") await sendReceipt(order);
  }
  if (["refund.created", "refund.updated", "refund.failed"].includes(type)) applyRefund(data.object as StripeRefund);
  return { received: true };
}
