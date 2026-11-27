import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { authPost, authSession } from "../../../../../../../packages/staff/api-client";
import { addressSchema, catalog, delivery, eligibleRestaurants, orderSchema, parse, quote, quoteSchema, restaurants, slots } from "@/lib/commerce";
import { CommerceError, customerOrders, findOrder, getRecord, insertOrder, publicOrder,
  rankOffers, records, saveOrder, transition, withCommerce, writeRecord } from "../../../../../../../packages/ui/src/commerce-store";
import { businesses } from "../../../../../../../packages/ui/src/order-store";
import { connectEnabled, cardsFor, openCardSetup, paymentsAvailable, refundPayment, removeCard, startPayment, stripeWebhook } from "../../../../../../../packages/ui/src/commerce-payment";
import { inputText, jsonBody, respond, sameOrigin } from "../../../../../../../packages/ui/src/commerce-http";
import { addSupportMessage, parseAttachment, supportFile, ticketFor, ticketsFor } from "../../../../../../../packages/ui/src/commerce-support";
import { pushAvailable, sendOrderPush } from "../../../../../../../packages/ui/src/commerce-push";
import { placeDetails, placeSuggestions } from "@/lib/places";

type Context = { params: Promise<{ path: string[] }> };
const guestCookie = "yespizz-guest";
const single = new Set(["cart", "preferences"]);
const accountCollections = new Set([...single, "addresses", "devices", "notifications", "favorites"]);

async function customer(request: Request, createGuest = false) {
  const jar = await cookies();
  const hasSession = jar.has("better-auth.session_token") || jar.has("__Secure-better-auth.session_token");
  const session = hasSession ? await authSession("customer", request.headers) : null;
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

async function handle(request: Request, path: string[]) {
  const [collection, id, action, ...rest] = path;
  const method = request.method;
  const url = new URL(request.url);
  if (rest.length) throw new CommerceError(404, "Endpoint not found.");
  if (collection === "webhooks" && id === "stripe" && !action && method === "POST") return stripeWebhook(request);
  if (collection === "health" && !id && method === "GET") return withCommerce(() => ({ ok: true }));
  if (collection === "integrations" && id === "push" && !action && method === "GET") return { android: pushAvailable("android"), ios: pushAvailable("ios") };
  if (collection === "integrations" && id === "payments" && !action && method === "GET") return { enabled: paymentsAvailable() };
  if (collection === "locations" && id === "suggestions" && !action && method === "POST") return placeSuggestions(inputText((await jsonBody(request)).query, 150));
  if (collection === "locations" && id === "places" && action && method === "GET") return placeDetails(action);
  if (collection === "restaurants" && method === "GET") {
    if (id === "yespizz" && action === "menu") {
      const search = url.searchParams.get("q")?.toLowerCase() ?? "";
      return catalog(id).filter(item => !search || item.name?.toLowerCase().includes(search));
    }
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
    const { shopper, guest } = await customer(request);
    if (!id && method === "GET") return customerOrders(shopper, guest).map(publicOrder);
    if (!id && method === "POST") {
      if (!shopper) throw new CommerceError(401, "Sign in to place an order.");
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
      input.owner = "yespizz";
      const price = quote(input);
      if (price.total !== input.expectedTotal) throw new CommerceError(409, "The total changed. Review the new price before paying.");
      const eligible = eligibleRestaurants(input.address.postalCode, input.scheduledAt).filter(shop => shop.availability.minimum <= price.subtotal);
      if (!eligible.length) throw new CommerceError(409, "No restaurant can deliver this order.");
      return withCommerce(db => {
        const existing = findOrder(db, input.reference);
        if (existing) return verify(existing);
        rankOffers(db, input.reference, input.address.point, eligible);
        return publicOrder(insertOrder(db, { ...price, reference: input.reference, owner: input.owner, sharedPayout: connectEnabled(), shopper, guest,
          address: input.address, name: input.name, email: input.email, phone: input.phone, fingerprint,
          accessToken: randomBytes(32).toString("hex") }));
      }, true);
    }
    if (id) {
      const order = orderFor(id, shopper, guest, url.searchParams.get("access") || "");
      if (method === "GET" && (!action || ["payment", "tracking", "receipt"].includes(action))) return publicOrder(order);
      if (method === "POST" && action === "payment") {
        sameOrigin(request);
        return startPayment(order, request.headers.get("origin") || url.origin);
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
        await sendOrderPush(cancelled, "cancelled");
        return publicOrder(withCommerce(db => findOrder(db, id)!));
      }
      if (method === "GET" && action === "review") {
        if (order.stage !== "delivered") throw new CommerceError(409, "Reviews are available after delivery.");
        return getRecord(order.owner, "reviews", order.reference);
      }
      if (method === "POST" && action === "review") {
        if (!shopper) throw new CommerceError(401, "Sign in to review your order.");
        const body = await jsonBody(request);
        if (order.stage !== "delivered") throw new CommerceError(409, "Reviews are available after delivery.");
        const rating = parse(z.number().int().min(1).max(5), body.rating);
        return writeRecord(order.owner, "reviews", order.reference, { rating, text: inputText(body.text, 2000, true),
          at: new Date().toISOString(), published: false, items: [...new Set(order.lines.map(line => line.id))] });
      }
      if (method === "POST" && action === "reorder") return { lines: order.lines };
    }
  }
  if (collection === "me") {
    const { session, shopper } = await customer(request);
    if (!session) throw new CommerceError(401, "Sign in to use this feature.");
    const scope = `customer:${shopper}`;
    if (id === "cards") {
      if (!action && method === "GET") return cardsFor(shopper);
      if (action === "setup" && method === "POST") { await jsonBody(request); return openCardSetup(shopper, session.user.email, url.origin); }
      if (action && method === "DELETE") { sameOrigin(request); return removeCard(shopper, action); }
    }
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
      if (method === "GET") {
        if (id === "devices") return records(scope, id).map(({ id: deviceId, platform }) => ({ id: deviceId, platform }));
        return single.has(id) ? getRecord(scope, id, key) : action ? getRecord(scope, id, action) : records(scope, id);
      }
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
          if (!pushAvailable(value.platform)) throw new CommerceError(503, "Push notifications are not configured.");
          const key = createHash("sha256").update(value.token).digest("hex");
          return withCommerce(db => {
            db.prepare("DELETE FROM commerce_records WHERE collection='devices' AND id=?").run(key);
            db.prepare("INSERT INTO commerce_records VALUES(?,'devices',?,?)").run(scope, key, JSON.stringify(value));
            return { id: key, platform: value.platform };
          }, true);
        }
        if (id === "favorites" && action) return writeRecord(scope, id, inputText(action, 80, true), {});
        if (id === "cart") {
          const cart = parse(z.object({ simple: z.record(z.string().max(80), z.number().int().min(0).max(200)),
            configured: z.array(z.object({ key: z.string().max(800), id: z.string().max(80), name: z.string().max(120),
              quantity: z.number().int().min(1).max(200), unitPrice: z.number().int().min(1).max(1000000), size: z.string().max(80).optional(),
              toppings: z.array(z.string().max(80)).max(15), removed: z.array(z.string().max(80)).max(15) })).max(50) }), body.value);
          return writeRecord(scope, id, key, { value: cart });
        }
        return writeRecord(scope, id, key, { value: body.value });
      }
    }
  }
  if (collection === "offers" && !action && method === "GET") {
    const owner = id || restaurants()[0]?.owner;
    return owner ? records(owner === "yespizz" ? "admin" : owner, "promotions").filter(row => row.active === true).map(({ id, code, amount, minimum, name }) => ({ id, code, amount, minimum, name })) : [];
  }
  if (collection === "content" && !action && method === "GET") {
    const owner = url.searchParams.get("restaurant") ?? restaurants()[0]?.owner;
    const placement = id ?? "home";
    const scopes = owner ? [owner, "admin"] : ["admin"];
    const now = Date.now();
    return scopes.flatMap(scope => [
      ...records(scope, "content").filter(item => item.published === true || item.status === "published"),
      ...records(scope, "ads").filter(item => item.active === true || item.status === "running"),
    ]).filter(item => item.placement === placement && (!item.startsAt || Date.parse(String(item.startsAt)) <= now) &&
      (!item.endsAt || Date.parse(String(item.endsAt)) > now)).flatMap(item => {
      const headline = typeof item.headline === "string" ? item.headline.trim().slice(0, 120) : "";
      const href = typeof item.destination === "string" && /^\/(?![\/\\])[^\u0000-\u001f]*$/.test(item.destination) ? item.destination : "/menu";
      return headline ? [{ id: item.id, headline, href, description: typeof item.description === "string" ? item.description.slice(0, 240) : "" }] : [];
    }).slice(0, 10);
  }
  if (collection === "reviews" && !action && method === "GET") {
    const owner = id ?? restaurants()[0]?.owner;
    const item = url.searchParams.get("item");
    if (!owner) return [];
    const reviews = owner === "yespizz" ? businesses().flatMap(shop => records(shop.owner, "reviews")) : records(owner, "reviews");
    return reviews.filter(row => row.published === true && (!item || (Array.isArray(row.items) && row.items.includes(item))))
    .map(({ id: reviewId, rating, text, at, reply, demo }) => ({ id: reviewId, rating, text, at, reply, demo: demo === true }));
  }
  if (collection === "support" && (id === "tickets" || id === "attachments")) {
    const { shopper, guest } = await customer(request, method === "POST");
    const scope = shopper ? `customer:${shopper}` : `guest:${guest}`;
    if (id === "attachments") {
      if (!action || method !== "GET" || (!shopper && !guest)) throw new CommerceError(404, "Attachment not found.");
      return supportFile(action, { scope });
    }
    if (!shopper && !guest) return [];
    if (method === "GET") return action ? ticketFor(action, scope) : ticketsFor(scope);
    if (method === "POST") {
      sameOrigin(request);
      const isForm = request.headers.get("content-type")?.startsWith("multipart/form-data");
      if (isForm && Number(request.headers.get("content-length")) > 2_200_000) throw new CommerceError(413, "Attachment is too large.");
      const body = isForm ? Object.fromEntries(await request.formData()) : await jsonBody(request);
      const attachment = isForm ? await parseAttachment(body.file instanceof File ? body.file : null) : undefined;
      const text = inputText(body.text, 2000, !attachment);
      const ticketId = action || crypto.randomUUID();
      const previous = action ? ticketFor(action, scope) : null;
      if (action && !previous) throw new CommerceError(404, "Ticket not found.");
      const reference = previous?.reference ?? inputText(body.reference, 60);
      const owner = previous?.owner ?? (reference ? orderFor(reference, shopper, guest, inputText(body.access, 64)).owner : undefined);
      return addSupportMessage({ id: ticketId, owner, reference, scope, text, attachment, create: !action });
    }
  }
  throw new CommerceError(404, "Endpoint not found.");
}

function route(request: Request, context: Context) {
  return respond(async () => handle(request, (await context.params).path));
}

export { route as GET, route as POST, route as PATCH, route as PUT, route as DELETE };
