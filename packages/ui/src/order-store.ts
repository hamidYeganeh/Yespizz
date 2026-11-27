import "server-only";
const { DatabaseSync } = (process as NodeJS.Process & {getBuiltinModule(name:string):unknown}).getBuiltinModule("node:sqlite") as {
  DatabaseSync: new (
    path: string,
    options?: { readOnly: boolean },
  ) => {
    exec: (sql: string) => void;
    prepare: (sql: string) => {
      all: (...args: string[]) => unknown[];
      get: (...args: string[]) => Record<string, unknown> | undefined;
      run: (...args: (string | number | null)[]) => unknown;
    };
    close: () => void;
  };
};
import { mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type { DispatchOrder } from "./dispatch-data";

function db() {
  const file = resolve(
    /* turbopackIgnore: true */ process.env.ORDER_DATABASE_PATH ||
      "../../.data/orders.sqlite",
  );
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(
    "PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS dispatch(reference TEXT PRIMARY KEY, owner TEXT NOT NULL, total REAL NOT NULL, district TEXT NOT NULL, lat REAL NOT NULL,lng REAL NOT NULL,placedAt TEXT NOT NULL,status TEXT NOT NULL, customer TEXT NOT NULL); CREATE INDEX IF NOT EXISTS dispatch_owner ON dispatch(owner)",
  );
  return db;
}
export function businesses() {
  const file = resolve(
    /* turbopackIgnore: true */ process.env.BUSINESS_DATABASE_PATH ||
      "../business/.data/business.sqlite",
  );
  if (!existsSync(file)) return [];
  const store = new DatabaseSync(file, { readOnly: true });
  try {
    return store
      .prepare(
        "SELECT owner,name FROM restaurant_profile WHERE handle IS NOT NULL AND name <> '' ORDER BY name",
      )
      .all() as { owner: string; name: string }[];
  } finally {
    store.close();
  }
}
export function place(owner: string, customer: string, order: DispatchOrder) {
  const store = db();
  try {
    store
      .prepare(
        "INSERT INTO dispatch VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(reference) DO NOTHING",
      )
      .run(
        order.reference,
        owner,
        order.total,
        order.district,
        order.lat,
        order.lng,
        order.placedAt,
        "active",
        customer,
      );
    const row = store
      .prepare("SELECT customer,owner FROM dispatch WHERE reference=?")
      .get(order.reference);
    if (row?.customer !== customer || row.owner !== owner)
      throw Error("Order reference unavailable");
  } finally {
    store.close();
  }
}
export function listOrders(owner?: string) {
  const store = db();
  try {
    return (store
      .prepare(
        "SELECT reference,total,district,lat,lng,placedAt,status FROM dispatch " +
          (owner === undefined ? "" : "WHERE owner=?") +
          " ORDER BY placedAt DESC",
      )
      .all(...(owner === undefined ? [] : [owner])) as DispatchOrder[]).map(row => ({ ...row }));
  } finally {
    store.close();
  }
}
export function updateOrder(
  reference: string,
  customer: string,
  status: "completed" | "cancelled",
) {
  const store = db();
  try {
    store
      .prepare(
        "UPDATE dispatch SET status=? WHERE reference=? AND customer=? AND status='active'",
      )
      .run(status, reference, customer);
  } finally {
    store.close();
  }
}

