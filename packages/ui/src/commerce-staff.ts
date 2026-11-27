import "server-only";
import { businesses } from "./order-store";
import { CommerceError, findOrder, getRecord, publicOrder, records, saveOrder, staffOrders, transition, withCommerce,
  writeRecord, type RecordValue, type Stage } from "./commerce-store";
import { inputText, jsonBody } from "./commerce-http";
import { refundPayment } from "./commerce-payment";

const resources = new Set(["menus", "menu-items", "categories", "toppings", "ingredients", "delivery-zones", "couriers",
  "shifts", "team", "promotions", "review-options", "cancellation-reasons", "content", "ads", "crm", "follow-ups",
  "notification-templates", "reports", "kpis", "payouts", "reviews"]);
const stages: Stage[] = ["accepted", "preparing", "ready", "out_for_delivery", "delivered", "rejected", "cancelled"];

function staffOrder(reference: string, owner?: string) {
  const order = withCommerce(db => findOrder(db, reference));
  if (!order || (owner !== undefined && order.owner !== owner)) throw new CommerceError(404, "Order not found.");
  return order;
}

function integer(value: unknown, fallback: number, minimum: number, max: number) {
  const number = value === undefined || value === "" ? fallback : Number(value);
  if (!Number.isSafeInteger(number) || number < minimum || number > max) throw new CommerceError(400, "Enter a valid number.");
  return number;
}

function restaurantSettings(body: RecordValue) {
  const opening = body.opening;
  if (opening !== undefined && (!opening || typeof opening !== "object" || Array.isArray(opening) || Object.entries(opening).some(([day, entries]) =>
    !/^(mon|tue|wed|thu|fri|sat|sun)$/.test(day) || !Array.isArray(entries) || entries.some(pair =>
      !Array.isArray(pair) || pair.length !== 2 || !pair.every(hour => typeof hour === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(hour)) || pair[0] >= pair[1])))) {
    throw new CommerceError(400, "Enter opening periods such as 11:00–22:00.");
  }
  if (body.closedDates !== undefined && (!Array.isArray(body.closedDates) || body.closedDates.some(day => typeof day !== "string" || !/^\d{4}-\d\d-\d\d$/.test(day)))) {
    throw new CommerceError(400, "Enter closures as YYYY-MM-DD dates.");
  }
  return { accepting: body.accepting === true, minimum: integer(body.minimum, 0, 0, 100000), fee: integer(body.fee, 0, 0, 100000),
    etaMinutes: integer(body.etaMinutes, 40, 5, 240), slotCapacity: integer(body.slotCapacity, 10, 1, 500),
    phone: inputText(body.phone, 50), line: inputText(body.line, 180), opening, closedDates: body.closedDates };
}

function collectionValue(collection: string, body: RecordValue) {
  if (collection === "delivery-zones") {
    const prefixes = body.prefixes;
    if (!Array.isArray(prefixes) || !prefixes.length || prefixes.some(value => typeof value !== "string" || !/^\d{1,4}$/.test(value))) {
      throw new CommerceError(400, "Enter valid Austrian postcode prefixes.");
    }
    return { name: inputText(body.name, 150), prefixes, active: body.active !== false,
      ...(body.minimum !== undefined && { minimum: integer(body.minimum, 0, 0, 100000) }),
      ...(body.fee !== undefined && { fee: integer(body.fee, 0, 0, 100000) }),
      ...(body.etaMinutes !== undefined && { etaMinutes: integer(body.etaMinutes, 40, 5, 240) }) };
  }
  if (collection === "menu-items" || collection === "toppings") {
    return { ...body, name: inputText(body.name, 120) || undefined,
      price: integer(body.price, 0, collection === "toppings" ? 0 : 1, 100000), available: body.available !== false };
  }
  if (collection === "promotions") return { name: inputText(body.name, 120), code: inputText(body.code, 80, true),
    amount: integer(body.amount, 0, 1, 100000), minimum: integer(body.minimum, 0, 0, 100000), active: body.active !== false };
  return body;
}

export async function staffCommerce(request: Request, path: string[], owner?: string) {
  const [collection, id, action, ...rest] = path;
  const method = request.method;
  const admin = owner === undefined;
  const scope = owner ?? "admin";
  const query = new URL(request.url).searchParams;
  if (rest.length) throw new CommerceError(404, "Endpoint not found.");
  if (collection === "orders") {
    if (!id && method === "GET") return staffOrders(owner).map(order => ({ ...publicOrder(order), name: order.name, phone: order.phone, courierId: order.courierId }));
    if (id) {
      const order = staffOrder(id, owner);
      if (!action && method === "GET") return { ...publicOrder(order), name: order.name, phone: order.phone, courierId: order.courierId };
      if (action === "refunds" && method === "POST" && admin) {
        await refundPayment(order);
        return publicOrder(staffOrder(id));
      }
      if (action === "status" && method === "PATCH") {
        const body = await jsonBody(request);
        const stage = inputText(body.stage, 30, true) as Stage;
        if (!stages.includes(stage) || order.stage === "pending_payment") throw new CommerceError(400, "Invalid order stage.");
        const reason = inputText(body.reason, 500);
        if (["rejected", "cancelled"].includes(stage) && !reason) throw new CommerceError(400, "Enter a reason.");
        const updated = withCommerce(db => {
          const current = findOrder(db, id)!;
          transition(current, stage, reason);
          if (body.etaMinutes !== undefined && stage === "accepted") {
            const minutes = integer(body.etaMinutes, 40, 5, 240);
            current.estimatedAt = new Date(Date.now() + minutes * 60000).toISOString();
          }
          saveOrder(db, current);
          return current;
        }, true);
        if (["rejected", "cancelled"].includes(stage) && ["paid", "refund_failed"].includes(updated.paymentStatus)) await refundPayment(updated);
        return publicOrder(staffOrder(id, owner));
      }
      if (action === "assignment" && method === "POST") {
        const body = await jsonBody(request);
        const courier = inputText(body.courierId, 100, true);
        if (!getRecord(order.owner, "couriers", courier)) throw new CommerceError(404, "Courier not found.");
        return withCommerce(db => {
          const current = findOrder(db, id)!;
          current.courierId = courier;
          saveOrder(db, current);
          return { courierId: courier };
        }, true);
      }
      if (action === "location" && method === "PUT") {
        const { lat, lng } = await jsonBody(request);
        if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
          throw new CommerceError(400, "Invalid location.");
        }
        return withCommerce(db => {
          const current = findOrder(db, id)!;
          if (current.stage !== "out_for_delivery" || !current.courierId) throw new CommerceError(409, "This order is not out for delivery.");
          current.courierLocation = { lat, lng, at: new Date().toISOString() };
          saveOrder(db, current);
          return { ok: true };
        }, true);
      }
    }
  }
  if (collection === "transactions" && method === "GET" && !id) return staffOrders(owner).map(order => ({
    reference: order.reference, total: order.total, currency: order.currency, status: order.paymentStatus, date: order.date,
  }));
  if (collection === "restaurants" && admin && !id && method === "GET") return businesses();
  if (collection === "restaurants" && admin && id && !action && method === "PATCH") {
    if (!businesses().some(shop => shop.owner === id)) throw new CommerceError(404, "Restaurant not found.");
    const body = await jsonBody(request);
    return writeRecord(id, "restaurant", "settings", restaurantSettings({ ...getRecord(id, "restaurant", "settings"), ...body }));
  }
  if (collection === "restaurant" && !admin && !id) {
    if (method === "GET") return getRecord(scope, collection, "settings");
    if (method === "PATCH") return writeRecord(scope, collection, "settings", restaurantSettings({ ...getRecord(scope, collection, "settings"), ...await jsonBody(request) }));
  }
  if (collection === "workspace" && !id) {
    if (method === "GET") return getRecord(scope, collection, "state");
    if (method === "PUT") return writeRecord(scope, collection, "state", await jsonBody(request));
  }
  if (collection === "support" && !action) {
    if (!id && method === "GET") return records("admin", "support").filter(ticket => admin || ticket.owner === owner);
    if (id && method === "PATCH") {
      const ticket = getRecord("admin", "support", id);
      if (!ticket || (!admin && ticket.owner !== owner)) throw new CommerceError(404, "Ticket not found.");
      const body = await jsonBody(request);
      const text = inputText(body.text, 2000);
      const status = inputText(body.status, 30);
      if (status && !["open", "in_progress", "resolved"].includes(status)) throw new CommerceError(400, "Invalid ticket status.");
      const messages = Array.isArray(ticket.messages) ? ticket.messages : [];
      const next = { ...ticket, status: status || ticket.status, assignee: body.assignee === undefined ? ticket.assignee : inputText(body.assignee, 100),
        messages: text ? [...messages, { text, by: "support", at: new Date().toISOString() }] : messages };
      writeRecord("admin", "support", id, next);
      return writeRecord(String(ticket.scope), "support", id, next);
    }
  }
  if (resources.has(collection) && !action) {
    const selected = admin ? query.get("restaurant") || scope : scope;
    if (method === "GET") return id ? getRecord(selected, collection, id) : records(selected, collection);
    if (id && method === "DELETE") return writeRecord(selected, collection, id, null);
    if (["POST", "PUT", "PATCH"].includes(method)) {
      const data = await jsonBody(request);
      const key = id ?? inputText(data.id, 80) ?? crypto.randomUUID();
      const current = id && method === "PATCH" ? getRecord(selected, collection, id) : null;
      return writeRecord(selected, collection, key || crypto.randomUUID(), collectionValue(collection, { ...current, ...data }));
    }
  }
  throw new CommerceError(404, "Endpoint not found.");
}
