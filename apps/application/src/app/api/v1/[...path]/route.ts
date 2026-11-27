import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { authPost, authSession } from "../../../../../../../packages/staff/api-client";
import { addressSchema, catalog, delivery, orderSchema, parse, quote, quoteSchema, restaurants, slots } from "@/lib/commerce";
import { CommerceError, customerOrders, findOrder, getRecord, insertOrder, publicOrder,
  records, saveOrder, transition, withCommerce, writeRecord } from "../../../../../../../packages/ui/src/commerce-store";
import { refundPayment, startPayment, stripeWebhook } from "../../../../../../../packages/ui/src/commerce-payment";
import { inputText, jsonBody, respond, sameOrigin } from "../../../../../../../packages/ui/src/commerce-http";

type Context = { params: Promise<{ path: string[] }> };
const guestCookie = "yespizz-guest";
const single = new Set(["cart", "preferences", "favorites"]);
const accountCollections = new Set([...single, "addresses", "devices", "notifications"]);

async function customer(request: Request, createGuest = false) {
  const session = await authSession("customer",request.headers);
  const jar = await cookies();
  let guest = jar.get(guestCookie)?.value ?? "";
  if (!/^[a-f0-9]{64}$/.test(guest)) guest = "";
  if (!session && !guest && createGuest) {
    guest = randomBytes(32).toString("hex");
    jar.set(guestCookie, guest, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 31536000 });
  }
  return { session, shopper: session?.user.id ?? "", guest };
}

function orderFor(reference: string, shopper: string, guest: string, access = "") {
  const order = withCommerce(db => findOrder(db, reference));
  if (!order) throw new CommerceError(404, "Order not found.");
  const token = !order.shopper && order.accessToken && /^[a-f0-9]{64}$/.test(access) &&
    timingSafeEqual(Buffer.from(access, "hex"), Buffer.from(order.accessToken, "hex"));
  if ((order.shopper ? order.shopper !== shopper : !guest || order.guest !== guest) && !token) {
    throw new CommerceError(404, "Order not found.");
  }
  return order;
}

function acceptOrder(db: Parameters<Parameters<typeof withCommerce>[0]>[0], owner: string, scheduledAt: string, capacity: number) {
  const expiringAt = new Date(Date.now() - 35 * 60000).toISOString();
  const count = db.prepare(`SELECT COUNT(*) AS total FROM commerce_orders WHERE owner=? AND json_extract(data,'$.scheduledAt')=?
    AND (stage IN ('received','accepted','preparing','ready','out_for_delivery','delivered') OR (stage='pending_payment' AND date>=?))`)
    .get(owner, scheduledAt, expiringAt);
  if (Number(count?.total) >= capacity) throw new CommerceError(409, "This delivery time is full.");
}

async function handle(request: Request, path: string[]) {
  const [collection, id, action, ...rest] = path;
  const method = request.method;
  const url = new URL(request.url);
  if (rest.length) throw new CommerceError(404, "Endpoint not found.");
  if (collection === "webhooks" && id === "stripe" && !action && method === "POST") return stripeWebhook(request);
  if (collection === "health" && !id && method === "GET") return withCommerce(() => ({ ok: true }));
  if (collection === "restaurants" && method === "GET") {
    const shops = restaurants();
    if (!id) return shops;
    const shop = shops.find(entry => entry.owner === id);
    if (!shop) throw new CommerceError(404, "Restaurant not found.");
    if (!action) return shop;
    if (action === "delivery-slots") return slots(id);
    if (action === "menu") {
      const search = url.searchParams.get("q")?.toLowerCase() ?? "";
      return catalog(id).filter(item => !search || item.name?.toLowerCase().includes(search));
    }
  }
  if (collection === "menu-items" && id && !action && method === "GET") {
    const owner = url.searchParams.get("restaurant") ?? restaurants()[0]?.owner;
    const item = owner && catalog(owner).find(entry => entry.id === id);
    if (!item) throw new CommerceError(404, "Menu item not found.");
    return item;
  }
  if (collection === "delivery" && id === "availability" && !action && method === "POST") {
    const body = await jsonBody(request);
    const address = parse(addressSchema, body.address);
    return delivery(inputText(body.owner, 100, true), address.postalCode, inputText(body.scheduledAt, 50));
  }
  if (collection === "checkout" && id === "quote" && !action && method === "POST") return quote(parse(quoteSchema, await jsonBody(request)));
  if (collection === "orders") {
    const { shopper, guest } = await customer(request, method === "POST" && !id);
    if (!id && method === "GET") return customerOrders(shopper, guest).map(publicOrder);
    if (!id && method === "POST") {
      const input = parse(orderSchema, await jsonBody(request));
      const fingerprint = createHash("sha256").update(JSON.stringify(input)).digest("hex");
      const previous = withCommerce(db => findOrder(db, input.reference));
      const verify = (order: NonNullable<typeof previous>) => {
        if ((order.shopper ? order.shopper !== shopper : order.guest !== guest) || order.fingerprint !== fingerprint) {
          throw new CommerceError(409, "This order reference is already in use.");
        }
        return publicOrder(order);
      };
      if (previous) return verify(previous);
      const price = quote(input);
      if (price.total !== input.expectedTotal) throw new CommerceError(409, "The total changed. Review the new price before paying.");
      const availability = delivery(input.owner, input.address.postalCode, input.scheduledAt);
      return withCommerce(db => {
        const existing = findOrder(db, input.reference);
        if (existing) return verify(existing);
        if (price.scheduledAt) acceptOrder(db, input.owner, price.scheduledAt, availability.slotCapacity);
        return publicOrder(insertOrder(db, { ...price, reference: input.reference, owner: input.owner, shopper, guest,
          address: input.address, name: input.name, email: input.email, phone: input.phone, fingerprint,
          accessToken: randomBytes(32).toString("hex") }));
      }, true);
    }
    if (id) {
      const order = orderFor(id, shopper, guest, url.searchParams.get("access") || "");
      if (method === "GET" && (!action || ["payment", "tracking", "receipt"].includes(action))) return publicOrder(order);
      if (method === "POST" && action === "payment") {
        sameOrigin(request);
        return startPayment(order, url.origin);
      }
      if (method === "POST" && action === "cancel") {
        const body = await jsonBody(request);
        const reason = inputText(body.reason, 500) || "Cancelled by customer";
        const cancelled = withCommerce(db => {
          const latest = findOrder(db, id)!;
          if (latest.stage === "pending_payment" && latest.sessionId) throw new CommerceError(409, "Use the payment page to resume this order.");
          transition(latest, "cancelled", reason);
          saveOrder(db, latest);
          return latest;
        }, true);
        if (["paid", "refund_failed"].includes(cancelled.paymentStatus)) await refundPayment(cancelled);
        return publicOrder(withCommerce(db => findOrder(db, id)!));
      }
      if (method === "POST" && action === "review") {
        const body = await jsonBody(request);
        if (order.stage !== "delivered") throw new CommerceError(409, "Reviews are available after delivery.");
        const rating = parse(z.number().int().min(1).max(5), body.rating);
        return writeRecord(order.owner, "reviews", order.reference, { rating, text: inputText(body.text, 2000, true), at: new Date().toISOString(), published: false });
      }
      if (method === "POST" && action === "reorder") return { lines: order.lines };
    }
  }
  if (collection === "me") {
    const { session, shopper } = await customer(request);
    if (!session) throw new CommerceError(401, "Sign in to use this feature.");
    const scope = `customer:${shopper}`;
    if (!id && method === "GET") return { ...session.user, ...(getRecord(scope, "preferences", "profile") ?? {}) };
    if (!id && method === "PATCH") {
      const body = await jsonBody(request);
      const data = parse(z.object({ name: z.string().trim().min(1).max(100).optional(), contactPhone: z.string().trim().max(50).optional(),
        birth: z.string().max(30).optional(), gender: z.string().max(24).optional(), photo: z.string().max(300000).optional() }), body);
      return writeRecord(scope, "preferences", "profile", data, true);
    }
    if (!id && method === "DELETE") {
      const body = await jsonBody(request);
      const password = body.password === undefined ? "" : inputText(body.password, 128);
      const response = await authPost("/api/auth/delete-user", { ...(password && { password }), callbackURL: "/" }, request.headers);
      if (!response.ok) throw new CommerceError(response.status, "The account deletion request could not be completed.");
      return { ok: true, confirmation: "email" };
    }
    if (id && accountCollections.has(id)) {
      const key = action ?? "state";
      if (method === "GET") return single.has(id) ? getRecord(scope, id, key) : action ? getRecord(scope, id, action) : records(scope, id);
      if (method === "DELETE" && action && id !== "notifications") return writeRecord(scope, id, action, null);
      if (["POST", "PUT", "PATCH"].includes(method)) {
        const body = await jsonBody(request);
        if (id === "notifications") {
          if (!action || !getRecord(scope, id, action)) throw new CommerceError(404, "Notification not found.");
          return writeRecord(scope, id, action, { read: true }, true);
        }
        if (id === "addresses") {
          const value = parse(addressSchema, body);
          return writeRecord(scope, id, action ?? crypto.randomUUID(), value);
        }
        if (id === "devices") {
          const value = parse(z.object({ token: z.string().min(16).max(4096), platform: z.enum(["android", "ios"]) }), body);
          return writeRecord(scope, id, createHash("sha256").update(value.token).digest("hex"), value);
        }
        return writeRecord(scope, id, key, { value: body.value });
      }
    }
  }
  if (collection === "offers" && !action && method === "GET") {
    const owner = id || restaurants()[0]?.owner;
    return owner ? records(owner, "promotions").filter(row => row.active === true).map(({ id, code, amount, minimum, name }) => ({ id, code, amount, minimum, name })) : [];
  }
  if (collection === "reviews" && id && !action && method === "GET") return records(id, "reviews").filter(row => row.published === true)
    .map(({ id: reviewId, rating, text, at, reply }) => ({ id: reviewId, rating, text, at, reply }));
  if (collection === "support" && id === "tickets") {
    const { shopper, guest } = await customer(request, method === "POST");
    const scope = shopper ? `customer:${shopper}` : `guest:${guest}`;
    if (!shopper && !guest) return [];
    if (method === "GET") return action ? getRecord(scope, "support", action) : records(scope, "support");
    if (method === "POST") {
      const body = await jsonBody(request);
      const text = inputText(body.text, 2000, true);
      const ticketId = action || crypto.randomUUID();
      const previous = action ? getRecord(scope, "support", action) : null;
      if (action && !previous) throw new CommerceError(404, "Ticket not found.");
      const reference = previous ? String(previous.reference) : inputText(body.reference, 60);
      const order = reference ? orderFor(reference, shopper, guest) : null;
      const owner = order?.owner;
      const original = getRecord("admin", "support", ticketId) ?? previous;
      const ticket = { reference, owner, status: "open", scope,
        messages: [...(Array.isArray(original?.messages) ? original.messages : []), { text, by: "customer", at: new Date().toISOString() }] };
      writeRecord("admin", "support", ticketId, ticket);
      return writeRecord(scope, "support", ticketId, ticket);
    }
  }
  throw new CommerceError(404, "Endpoint not found.");
}

function route(request: Request, context: Context) {
  return respond(async () => handle(request, (await context.params).path));
}

export { route as GET, route as POST, route as PATCH, route as PUT, route as DELETE };
