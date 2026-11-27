import "server-only";
import {plan,shiftCode} from "./couriers";
import { businesses } from "./order-store";
import { CommerceError, hasOffer, findOrder, getRecord, publicOrder, records, saveOrder, staffOrders, transition, withCommerce,
  writeRecord, type Order, type RecordValue, type Stage } from "./commerce-store";
import { inputText, jsonBody } from "./commerce-http";
import { connectRestaurant, connectStatus, settleDelivery, refundPayment } from "./commerce-payment";
import { supportFile, ticketsFor, updateTicket } from "./commerce-support";
import { sendOrderPush } from "./commerce-push";
import { courierEta } from "./commerce-routing";

const resources = new Set(["menus", "menu-items", "categories", "toppings", "ingredients", "delivery-zones", "couriers",
  "shifts", "team", "promotions", "review-options", "cancellation-reasons", "content", "ads", "crm", "follow-ups",
  "notification-templates", "reports", "kpis", "payouts", "reviews"]);
const stages: Stage[] = ["accepted", "preparing", "ready", "out_for_delivery", "delivered", "rejected", "cancelled"];

function staffOrder(reference: string, owner?: string) {
  const order = withCommerce(db => findOrder(db, reference));
  if (!order || (owner !== undefined && order.owner !== owner)) throw new CommerceError(404, "Order not found.");
  return order;
}

function staffOrderView(order: Order, role: string) {
  const orderView = publicOrder(order);
  if (order.owner === "yespizz") return { ...orderView, address: { line: "", postalCode: order.address.postalCode, city: order.address.city }, name: "", phone: "", courierId: null };
  if (role === "kitchen") return { ...orderView, address: { line: "", city: "", postalCode: "" },
    courierLocation: undefined, name: "", phone: "", courierId: null };
  return { ...orderView, name: order.name, phone: order.phone, courierId: order.courierId };
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
    deliveryTaxRate: body.deliveryTaxRate === undefined ? undefined : integer(body.deliveryTaxRate, 0, 0, 10000),
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
      ...(body.taxRate !== undefined && { taxRate: integer(body.taxRate, 0, 0, 10000) }),
      price: integer(body.price, 0, collection === "toppings" ? 0 : 1, 100000), available: body.available !== false };
  }
  if (collection === "promotions") return { name: inputText(body.name, 120), code: inputText(body.code, 80, true),
    amount: integer(body.amount, 0, 1, 100000), minimum: integer(body.minimum, 0, 0, 100000), active: body.active !== false };
  return body;
}

export async function staffCommerce(request: Request, path: string[], owner?: string, role = "owner") {
  const [collection, id, action, ...rest] = path;
  const method = request.method;
  const admin = owner === undefined;
  const scope = owner ?? "admin";
  const query = new URL(request.url).searchParams;
  if (rest.length) throw new CommerceError(404, "Endpoint not found.");
  if (owner !== undefined && role !== "owner") {
    if (role === "manager" && ["connect", "team"].includes(collection)) throw new CommerceError(403, "This requires the restaurant owner.");
    if (role !== "manager") {
      const canRead = method === "GET" && ["orders", "restaurant"].includes(collection);
      const canOperate = collection === "orders" && (action === "status" && method === "PATCH" ||
        role === "dispatch" && (action === "location" && method === "PUT" || action === "assignment" && method === "POST"));
      if (!canRead && !canOperate && !(role==="dispatch" && collection==="courier-dispatch")) throw new CommerceError(403, "Your role cannot use this operation.");
    }
  }
  if(collection==="courier-dispatch" && owner && ["owner","manager","dispatch"].includes(role)){
    if(method==="GET")return plan(owner,query.get("courier") || "");
    const body=await jsonBody(request), courier=inputText(body.courier,100,true);
    if(method==="POST" && id==="code")return {code:shiftCode(owner,courier)};
    if(method==="POST" && id==="assign" && Array.isArray(body.references))return plan(owner,courier,body.references.map(String));
  }
  if (collection === "orders") {
    const inbox = () => staffOrders(owner, true).map(order => staffOrderView(order, role));
    if (id === "stream" && !action && method === "GET" && owner) {
      let timer: ReturnType<typeof setInterval>;
      const stream = new ReadableStream({
        start(controller) {
          let previous = "";
          const encoder = new TextEncoder();
          const started = Date.now();
          const publish = () => {
            try {
              if (request.signal.aborted || Date.now()-started > 60000) {
                clearInterval(timer); controller.close(); return;
              }
              const snapshot = JSON.stringify(inbox());
              if (previous !== snapshot) controller.enqueue(encoder.encode("data: "+snapshot+"\n\n"));
              previous = snapshot;
            } catch (error) { clearInterval(timer); controller.error(error); }
          };
          timer = setInterval(publish, 1000);
          publish();
        },
        cancel() { clearInterval(timer); }
      });
      return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
    }
    if (!id && method === "GET") return inbox();
    if (id) {
      const offer = action === "status" && method === "PATCH" && owner && withCommerce(db => hasOffer(db,id,owner));
      const order = staffOrder(id, offer ? undefined : owner);
      if (!action && method === "GET") return staffOrderView(order, role);
      if (action === "refunds" && method === "POST" && admin) {
        await jsonBody(request);
        if (!["delivered", "rejected", "cancelled"].includes(order.stage)) throw new CommerceError(409, "Cancel the order before refunding it.");
        await refundPayment(order);
        return publicOrder(staffOrder(id));
      }
      if (action === "status" && method === "PATCH") {
        const body = await jsonBody(request);
        const stage = inputText(body.stage, 30, true) as Stage;
        if (!stages.includes(stage) || order.stage === "pending_payment") throw new CommerceError(400, "Invalid order stage.");
        if (role === "kitchen" && !["accepted", "preparing", "ready", "rejected"].includes(stage) ||
          role === "dispatch" && !["out_for_delivery", "delivered"].includes(stage)) throw new CommerceError(403, "Your role cannot apply this order stage.");
        const reason = inputText(body.reason, 500);
        if (!offer && ["rejected", "cancelled"].includes(stage) && !reason) throw new CommerceError(400, "Enter a reason.");
        if (["out_for_delivery","delivered"].includes(stage) && (order.sharedPayout !== undefined || order.courierId)) throw new CommerceError(409,"Confirm pickup and delivery in the courier app.");
        if (stage === "delivered" && ["ready","out_for_delivery"].includes(order.stage)) await settleDelivery(order);
        const updated = withCommerce(db => {
          const current = findOrder(db, id)!;
          if (current.owner === "yespizz") {
            if (admin && stage === "accepted") throw new CommerceError(409, "A restaurant must accept this offer.");
            if (owner) {
              if (!hasOffer(db,id,owner) || !["accepted","rejected"].includes(stage)) throw new CommerceError(409, "This offer is unavailable.");
              if (stage === "rejected") {
                db.prepare("UPDATE commerce_offers SET declined=1 WHERE reference=? AND owner=?").run(id,owner);
                if (db.prepare("SELECT 1 FROM commerce_offers WHERE reference=? AND declined=0").get(id)) return null;
              } else {
                if (current.scheduledAt) {
                  const settings = db.prepare("SELECT json_extract(data,'$.slotCapacity') AS capacity FROM commerce_records WHERE scope=? AND collection='restaurant' AND id='settings'").get(owner);
                  const used = db.prepare("SELECT COUNT(*) AS n FROM commerce_orders WHERE owner=? AND json_extract(data,'$.scheduledAt')=? AND stage IN ('received','accepted','preparing','ready','out_for_delivery','delivered')").get(owner,current.scheduledAt);
                  if (Number(used?.n) >= Number(settings?.capacity ?? 10)) throw new CommerceError(409, "This delivery slot is full. Decline the offer.");
                }
                db.prepare("UPDATE commerce_orders SET owner=? WHERE reference=?").run(owner,id);
                current.owner = owner;
              }
            }
          } else if (owner && current.owner !== owner) throw new CommerceError(409, "This offer is unavailable.");
          transition(current, stage, reason);
          if (offer && stage === "accepted") transition(current, "preparing");
          if (body.etaMinutes !== undefined && stage === "accepted") {
            const minutes = integer(body.etaMinutes, 40, 5, 240);
            current.estimatedAt = new Date(Date.now() + minutes * 60000).toISOString();
          }
          saveOrder(db, current);
          return current;
        }, true);
        if (!updated) return { ok: true };
        if (["rejected", "cancelled"].includes(stage) && ["paid", "refund_failed"].includes(updated.paymentStatus)) await refundPayment(updated);
        await sendOrderPush(updated, updated.stage);
        return staffOrderView(updated, role);
      }
      if (action === "assignment" && method === "POST") {
        throw new CommerceError(409,"Use the courier dispatch suggestion.");
      }
      if (action === "location" && method === "PUT") {
        const { lat, lng } = await jsonBody(request);
        if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
          throw new CommerceError(400, "Invalid location.");
        }
        if (order.stage !== "out_for_delivery" || !order.courierId) throw new CommerceError(409, "This order is not out for delivery.");
        const estimatedAt = order.address.point ? await courierEta({ lat, lng }, order.address.point) : null;
        return withCommerce(db => {
          const current = findOrder(db, id)!;
          if (current.stage !== "out_for_delivery" || !current.courierId) throw new CommerceError(409, "This order is not out for delivery.");
          current.courierLocation = { lat, lng, at: new Date().toISOString() };
          if (estimatedAt) current.estimatedAt = estimatedAt;
          saveOrder(db, current);
          return { ok: true };
        }, true);
      }
    }
  }
  if (collection === "transactions" && method === "GET" && !id) return staffOrders(owner).map(order => ({
    reference: order.reference, total: order.total, currency: order.currency, status: order.paymentStatus, date: order.date,
  }));
  if (collection === "reports" && id === "sales" && !action && method === "GET") {
    const filter = /^\d{4}-\d{2}-\d{2}$/;
    const from = query.get("from") ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const through = query.get("through") ?? new Date().toISOString().slice(0, 10);
    if (!filter.test(from) || !filter.test(through) || from > through) throw new CommerceError(400, "Invalid reporting period.");
    const daily = withCommerce(db => db.prepare(`SELECT substr(date,1,10) day, COUNT(*) orders,
      SUM(CASE WHEN payment='paid' THEN json_extract(data,'$.total') ELSE 0 END) net,
      SUM(CASE WHEN payment='refunded' THEN json_extract(data,'$.total') ELSE 0 END) refunded
      FROM commerce_orders WHERE (? IS NULL OR owner=?) AND substr(date,1,10) BETWEEN ? AND ? AND stage!='pending_payment'
      GROUP BY day ORDER BY day`).all(owner ?? null, owner ?? null, from, through));
    return { from, through, daily };
  }
  if (collection === "connect" && owner !== undefined && !id) {
    if (method === "GET") return connectStatus(owner);
    if (method === "POST") { await jsonBody(request); return connectRestaurant(owner, new URL(request.url).origin); }
  }
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
  if (collection === "support") {
    if (id === "attachments" && action && method === "GET") return supportFile(action, { owner });
    if (!id && method === "GET") return ticketsFor(undefined, owner);
    if (id && !action && method === "PATCH") {
      const body = await jsonBody(request);
      const text = inputText(body.text, 2000);
      const status = inputText(body.status, 30);
      if (status && !["open", "in_progress", "resolved"].includes(status)) throw new CommerceError(400, "Invalid ticket status.");
      return updateTicket(id, owner, { text, status, assignee: body.assignee === undefined ? undefined : inputText(body.assignee, 100) });
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
