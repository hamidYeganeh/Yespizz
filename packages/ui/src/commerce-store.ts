import "server-only";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";

const sqlite = (process as NodeJS.Process & { getBuiltinModule(name: string): unknown })
  .getBuiltinModule("node:sqlite") as typeof import("node:sqlite");

export type Stage = "pending_payment" | "received" | "accepted" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "rejected" | "cancelled";
export type PaymentStatus = "pending" | "paid" | "failed" | "refund_pending" | "refunded" | "refund_failed";
export type Point = { lat: number; lng: number };
export type DeliveryAddress = { line: string; city: string; postalCode: string; unit?: string; country?: string; deliveryNotes?: string; point?: Point };
export type OrderLine = { id: string; name: string; quantity: number; unitPrice: number; size?: string; toppings: string[]; removed: string[] };
export type OrderQuote = { lines: OrderLine[]; subtotal: number; discount: number; deliveryFee: number; total: number; currency: "eur"; scheduledAt?: string; etaMinutes: number };
export type PublicOrder = OrderQuote & {
  reference: string; owner: string; date: string; address: DeliveryAddress; stage: Stage;
  paymentStatus: PaymentStatus; events: { stage: Stage; at: string; reason?: string }[];
  courierLocation?: Point & { at: string }; estimatedAt?: string;
};
export type Order = PublicOrder & {
  shopper: string; guest: string; email: string; name: string; phone: string; fingerprint: string; accessToken: string;
  sessionId: string | null; paymentIntent: string | null; attempt: number; courierId: string | null;
};

export class CommerceError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function database() {
  const file = resolve(/* turbopackIgnore: true */ process.env.ORDER_DATABASE_PATH || "../../.data/orders.sqlite");
  mkdirSync(dirname(file), { recursive: true });
  const db = new sqlite.DatabaseSync(file);
  db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS commerce_orders (
      reference TEXT PRIMARY KEY, owner TEXT NOT NULL, shopper TEXT NOT NULL, guest TEXT NOT NULL,
      date TEXT NOT NULL, stage TEXT NOT NULL, payment TEXT NOT NULL, sessionId TEXT,
      paymentIntent TEXT, attempt INTEGER NOT NULL DEFAULT 0, courierId TEXT,
      data TEXT NOT NULL, events TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS commerce_owner ON commerce_orders(owner,date DESC);
    CREATE INDEX IF NOT EXISTS commerce_shopper ON commerce_orders(shopper,date DESC);
    CREATE INDEX IF NOT EXISTS commerce_guest ON commerce_orders(guest,date DESC);
    CREATE TABLE IF NOT EXISTS commerce_records (
      scope TEXT NOT NULL, collection TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL,
      PRIMARY KEY(scope,collection,id)
    );`);
  return db;
}

export function withCommerce<T>(work: (db: DatabaseSync) => T, write = false): T {
  const db = database();
  try {
    if (write) db.exec("BEGIN IMMEDIATE");
    const result = work(db);
    if (write) db.exec("COMMIT");
    return result;
  } catch (error) {
    if (write && db.isTransaction) db.exec("ROLLBACK");
    throw error;
  } finally { db.close(); }
}

function read(row: Record<string, unknown>): Order {
  return { ...JSON.parse(String(row.data)), reference: row.reference, owner: row.owner, shopper: row.shopper,
    guest: row.guest, date: row.date, stage: row.stage, paymentStatus: row.payment,
    sessionId: row.sessionId, paymentIntent: row.paymentIntent, attempt: row.attempt, courierId: row.courierId,
    events: JSON.parse(String(row.events)) } as Order;
}

export function findOrder(db: DatabaseSync, reference: string) {
  const row = db.prepare("SELECT * FROM commerce_orders WHERE reference=?").get(reference);
  return row && read(row);
}

export function customerOrders(shopper: string, guest: string) {
  return withCommerce(db => db.prepare(`SELECT * FROM commerce_orders WHERE (shopper <> '' AND shopper=?)
    OR (shopper='' AND guest <> '' AND guest=?) ORDER BY date DESC LIMIT 100`).all(shopper, guest).map(read));
}

export function staffOrders(owner?: string) {
  return withCommerce(db => owner === undefined
    ? db.prepare("SELECT * FROM commerce_orders ORDER BY date DESC LIMIT 250").all().map(read)
    : db.prepare("SELECT * FROM commerce_orders WHERE owner=? AND stage <> 'pending_payment' ORDER BY date DESC LIMIT 250").all(owner).map(read));
}

export function publicOrder(order: Order): PublicOrder {
  const { reference, owner, date, address, stage, paymentStatus, events, courierLocation, estimatedAt,
    lines, subtotal, discount, deliveryFee, total, currency, scheduledAt, etaMinutes } = order;
  return { reference, owner, date, address, stage, paymentStatus, events, courierLocation, estimatedAt,
    lines, subtotal, discount, deliveryFee, total, currency, scheduledAt, etaMinutes };
}

type NewOrder = Omit<Order, "date" | "stage" | "events" | "paymentStatus" | "sessionId" | "paymentIntent" | "attempt" | "courierId">;

export function insertOrder(db: DatabaseSync, input: NewOrder) {
  const { reference, owner, shopper, guest, ...data } = input;
  const at = new Date().toISOString();
  const events = JSON.stringify([{ stage: "pending_payment", at }]);
  db.prepare(`INSERT INTO commerce_orders(reference,owner,shopper,guest,date,stage,payment,data,events)
    VALUES(?,?,?,?,?,'pending_payment','pending',?,?)`).run(reference, owner, shopper, guest, at, JSON.stringify(data), events);
  return findOrder(db, reference)!;
}

export function saveOrder(db: DatabaseSync, order: Order) {
  const { reference, owner, shopper, guest, date, stage, events, paymentStatus,
    sessionId, paymentIntent, attempt, courierId, ...data } = order;
  db.prepare(`UPDATE commerce_orders SET stage=?,payment=?,sessionId=?,paymentIntent=?,attempt=?,courierId=?,data=?,events=?
    WHERE reference=? AND owner=? AND shopper=? AND guest=? AND date=?`).run(stage, paymentStatus, sessionId,
    paymentIntent, attempt, courierId, JSON.stringify(data), JSON.stringify(events), reference, owner, shopper, guest, date);
}

const next: Record<Stage, Stage[]> = {
  pending_payment: ["received", "cancelled"], received: ["accepted", "rejected", "cancelled"],
  accepted: ["preparing", "cancelled"], preparing: ["ready"], ready: ["out_for_delivery", "delivered"],
  out_for_delivery: ["delivered"], delivered: [], rejected: [], cancelled: [],
};

export function transition(order: Order, stage: Stage, reason?: string) {
  if (order.stage === stage) return;
  if (!next[order.stage].includes(stage)) throw new CommerceError(409, "This order cannot move to that stage.");
  order.stage = stage;
  order.events.push({ stage, at: new Date().toISOString(), ...(reason && { reason }) });
}

export type RecordValue = Record<string, unknown>;
export function records(scope: string, collection: string) {
  return withCommerce(db => db.prepare("SELECT id,data FROM commerce_records WHERE scope=? AND collection=? ORDER BY id")
    .all(scope, collection).map(row => ({ ...JSON.parse(String(row.data)), id: String(row.id) }) as RecordValue & { id: string }));
}

export function getRecord(scope: string, collection: string, id: string) {
  return withCommerce(db => {
    const row = db.prepare("SELECT data FROM commerce_records WHERE scope=? AND collection=? AND id=?").get(scope, collection, id);
    return row ? { ...JSON.parse(String(row.data)), id } as RecordValue & { id: string } : null;
  });
}

export function writeRecord(scope: string, collection: string, id: string, data: RecordValue | null, merge = false) {
  return withCommerce(db => {
    if (!data) {
      db.prepare("DELETE FROM commerce_records WHERE scope=? AND collection=? AND id=?").run(scope, collection, id);
      return null;
    }
    const previous = merge && db.prepare("SELECT data FROM commerce_records WHERE scope=? AND collection=? AND id=?").get(scope, collection, id);
    const value = { ...(previous ? JSON.parse(String(previous.data)) : {}), ...data, id };
    db.prepare(`INSERT INTO commerce_records VALUES(?,?,?,?) ON CONFLICT(scope,collection,id)
      DO UPDATE SET data=excluded.data`).run(scope, collection, id, JSON.stringify(value));
    return value as RecordValue & { id: string };
  }, true);
}

export function eraseCustomer(shopper: string) {
  withCommerce(db => {
    db.prepare("DELETE FROM commerce_records WHERE scope=?").run(`customer:${shopper}`);
    for (const row of db.prepare("SELECT * FROM commerce_orders WHERE shopper=?").all(shopper)) {
      const order = read(row);
      const { reference, owner, shopper: _, guest, date, stage, events, paymentStatus,
        sessionId, paymentIntent, attempt, courierId, ...data } = order;
      db.prepare(`UPDATE commerce_orders SET shopper='deleted',guest='',data=? WHERE reference=?`).run(JSON.stringify({
        ...data, name: "", email: "", phone: "", accessToken: "", address: { line: "", city: "", postalCode: "" },
      }), reference);
    }
  }, true);
}
