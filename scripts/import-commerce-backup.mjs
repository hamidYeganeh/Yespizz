import { DatabaseSync } from "node:sqlite";
import { Pool } from "pg";
import { isAbsolute } from "node:path";

const source = process.argv[2];
const connectionString = process.env.COMMERCE_MIGRATION_DATABASE_URL;
if (!source || !isAbsolute(source) || !connectionString) {
  throw new Error("Pass the absolute SQLite backup path and set COMMERCE_MIGRATION_DATABASE_URL.");
}

// Keep JSON as text during import so the original payloads can be compared exactly.
const tables = {
  commerce_orders: {
    key: ["reference"],
    columns: 'reference text, owner text NOT NULL, shopper text NOT NULL, guest text NOT NULL, date text NOT NULL, stage text NOT NULL, payment text NOT NULL, "sessionId" text, "paymentIntent" text, attempt integer NOT NULL DEFAULT 0, "courierId" text, data text NOT NULL, events text NOT NULL',
  },
  commerce_records: {
    key: ["scope", "collection", "id"],
    columns: "scope text, collection text, id text, data text NOT NULL",
  },
  commerce_offers: {
    key: ["reference", "owner"],
    columns: "reference text, owner text, rank integer NOT NULL, declined integer NOT NULL DEFAULT 0",
  },
  commerce_attachments: {
    key: ["id"],
    columns: "id text, ticket text NOT NULL, name text NOT NULL, mime text NOT NULL, bytes bytea NOT NULL",
  },
  dispatch: {
    key: ["reference"],
    columns: 'reference text, owner text NOT NULL, total double precision NOT NULL, district text NOT NULL, lat double precision, lng double precision, "placedAt" text NOT NULL, status text NOT NULL, customer text NOT NULL',
  },
  courier_sessions: {
    key: ["owner", "courier"],
    columns: "owner text, courier text, code text UNIQUE, expires bigint, token text UNIQUE, until bigint",
    // Active credentials aren't migrated. Couriers can start a new shift after cutover.
  },
};
const identifiers = /^[a-zA-Z_][a-zA-Z_0-9]*$/;
function quote(value) {
  if (!identifiers.test(value)) throw new Error("Unexpected column name in the SQLite backup.");
  return '"' + value + '"';
}

const sqlite = new DatabaseSync(source, { readOnly: true });
const pool = new Pool({ connectionString, connectionTimeoutMillis: 10000 });
try {
  const db = await pool.connect();
  try {
    sqlite.exec("BEGIN");
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(138004309, 2)");
    await db.query("CREATE SCHEMA IF NOT EXISTS yespizz_commerce");
    const found = sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?");
    if (!found.get("commerce_orders") || !found.get("commerce_records")) {
      throw new Error("The backup must contain commerce_orders and commerce_records.");
    }
    for (const [table, definition] of Object.entries(tables)) {
      const target = "yespizz_commerce." + quote(table);
      const keys = definition.key.map(quote);
      await db.query(`CREATE TABLE IF NOT EXISTS ${target} (${definition.columns}, PRIMARY KEY (${keys.join(", ")}))`);
      if (table === "courier_sessions" || !found.get(table)) continue;
      const columns = sqlite.prepare(`PRAGMA table_info(${quote(table)})`).all().map(row => row.name);
      const names = columns.map(quote);
      const update = columns.filter(name => !definition.key.includes(name)).map(name =>
        `${quote(name)} = EXCLUDED.${quote(name)}`).join(", ");
      let imported = 0;
      for (const row of sqlite.prepare(`SELECT * FROM ${quote(table)}`).iterate()) {
        const values = columns.map(name => row[name] instanceof Uint8Array ? Buffer.from(row[name]) : row[name]);
        const result = await db.query(`INSERT INTO ${target} AS existing (${names.join(", ")})
          VALUES (${columns.map((_, i) => "$" + (i + 1)).join(", ")})
          ON CONFLICT (${keys.join(", ")}) DO UPDATE SET ${update}
          WHERE (${names.map(name => `existing.${name}`).join(", ")})
            IS NOT DISTINCT FROM (${names.map(name => `EXCLUDED.${name}`).join(", ")})`, values);
        if (result.rowCount !== 1) throw new Error(`Conflicting data in ${table}. Import rolled back.`);
        imported++;
      }
      console.log(`${table}: ${imported} rows verified`);
    }
    await db.query(`
      CREATE INDEX IF NOT EXISTS commerce_offer_rank ON yespizz_commerce.commerce_offers(reference, declined, rank);
      CREATE INDEX IF NOT EXISTS commerce_owner ON yespizz_commerce.commerce_orders(owner, date DESC);
      CREATE INDEX IF NOT EXISTS commerce_shopper ON yespizz_commerce.commerce_orders(shopper, date DESC);
      CREATE INDEX IF NOT EXISTS commerce_guest ON yespizz_commerce.commerce_orders(guest, date DESC);
    `);
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
} finally {
  sqlite.close();
  await pool.end();
}
