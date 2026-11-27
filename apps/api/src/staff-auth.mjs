import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";

const instances = new Map();
export const adminEmail = "hamidyeganeh82@gmail.com";
const digest = (value) => createHash("sha256").update(value).digest("hex");
const secretCode = () => randomBytes(18).toString("base64url");

export function staffStore(role) {
  if (!instances.has(role))
    instances.set(
      role,
      initialize(role).catch((error) => {
        instances.delete(role);
        throw error;
      }),
    );
  return instances.get(role);
}

async function initialize(role) {
  const admin = role === "admin";
  const file = resolve(
    /* turbopackIgnore: true */ admin
      ? process.env.ADMIN_DATABASE_PATH || "../admin/.data/admin.sqlite"
      : process.env.BUSINESS_DATABASE_PATH ||
          "../business/.data/business.sqlite",
  );
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  try {
    db.exec(
      "PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON",
    );
    let secret =
      process.env[admin ? "ADMIN_AUTH_SECRET" : "BUSINESS_AUTH_SECRET"] ||
      process.env.BETTER_AUTH_SECRET;
    if (!secret && process.env.NODE_ENV !== "production") {
      db.exec(
        "CREATE TABLE IF NOT EXISTS dev_secret(id INTEGER PRIMARY KEY, secret TEXT NOT NULL); INSERT OR IGNORE INTO dev_secret VALUES(1,hex(randomblob(32)))",
      );
      secret = db
        .prepare("SELECT secret FROM dev_secret WHERE id=1")
        .get().secret;
    }
    if (!secret) throw Error("Configure the staff authentication secret");
    const options = {
      database: db,
      secret,
      baseURL:
        process.env[admin ? "ADMIN_AUTH_URL" : "BUSINESS_AUTH_URL"] ||
        (admin ? "http://localhost:7032" : "http://localhost:7033"),
      advanced: { cookiePrefix: "yespiz-" + role },
      emailAndPassword: { enabled: true, disableSignUp: true },
      rateLimit: { enabled: true, storage: "database" },
    };
    await (await getMigrations(options)).runMigrations();
    const auth = betterAuth(options);
    db.exec(
      "CREATE TABLE IF NOT EXISTS staff_code(owner TEXT REFERENCES user(id), purpose TEXT, hash TEXT UNIQUE NOT NULL, expires INTEGER NOT NULL, PRIMARY KEY(owner,purpose))",
    );
    if (!admin)
      db.exec(`CREATE TABLE IF NOT EXISTS restaurant_profile(owner TEXT PRIMARY KEY REFERENCES user(id),name TEXT NOT NULL DEFAULT '',city TEXT NOT NULL DEFAULT '',handle TEXT UNIQUE,specialties TEXT NOT NULL DEFAULT '[]');
      CREATE TABLE IF NOT EXISTS restaurant_terms(owner TEXT PRIMARY KEY REFERENCES user(id),commission REAL NOT NULL,latitude REAL NOT NULL,longitude REAL NOT NULL,ovens INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS restaurant_members(member TEXT PRIMARY KEY REFERENCES user(id),owner TEXT NOT NULL REFERENCES user(id),role TEXT NOT NULL CHECK(role IN ('manager','kitchen','dispatch')),active INTEGER NOT NULL DEFAULT 1);
      CREATE INDEX IF NOT EXISTS restaurant_members_owner ON restaurant_members(owner)`);
    if (
      admin &&
      !db.prepare("SELECT id FROM user WHERE email=?").get(adminEmail)
    ) {
      const hash = process.env.ADMIN_PASSWORD
        ? await (await auth.$context).password.hash(process.env.ADMIN_PASSWORD)
        : null;
      transaction(db, () => {
        if (db.prepare("SELECT id FROM user WHERE email=?").get(adminEmail))
          return;
        const owner = addUser(db, adminEmail, "Administrator");
        if (hash) credential(db, owner, hash);
      });
    }
    return { auth, db };
  } catch (error) {
    db.close();
    throw error;
  }
}

function transaction(db, work) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function addUser(db, email, name) {
  const id = randomUUID();
  db.prepare(
    "INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
  ).run(id, name, email);
  return id;
}
function credential(db, owner, hash) {
  const changed = db
    .prepare(
      "UPDATE account SET password=?,updatedAt=CURRENT_TIMESTAMP WHERE userId=? AND providerId='credential'",
    )
    .run(hash, owner);
  if (!changed.changes)
    db.prepare(
      "INSERT INTO account(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES(?,?,'credential',?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
    ).run(randomUUID(), owner, owner, hash);
}
function issue(db, owner, purpose) {
  const code = secretCode();
  db.prepare("INSERT OR REPLACE INTO staff_code VALUES(?,?,?,?)").run(
    owner,
    purpose,
    digest(code),
    Date.now() + 15 * 60000,
  );
  return code;
}
async function mail(email, subject, message) {
  if (!process.env.RESEND_API_KEY || !process.env.AUTH_EMAIL_FROM)
    throw Error("Email delivery is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.RESEND_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.AUTH_EMAIL_FROM,
      to: [email],
      subject,
      text: message,
    }),
  });
  if (!response.ok) throw Error("Email delivery failed");
}
export async function provision(input, resend) {
  const { db } = await staffStore("business");
  const email = String(input.email ?? "")
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return fail("Enter a valid email.");
  const { name, commission, latitude, longitude, ovens } = input;
  if (
    !resend &&
    (typeof name !== "string" ||
      !name.trim() ||
      name.length > 200 ||
      ![commission, latitude, longitude, ovens].every(Number.isFinite) ||
      commission < 0 ||
      commission > 100 ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180 ||
      !Number.isSafeInteger(ovens) ||
      ovens < 1)
  )
    return fail("Check the restaurant details.");
  const result = transaction(db, () => {
    let owner = db.prepare("SELECT id FROM user WHERE email=?").get(email)?.id;
    if (resend) {
      if (
        !owner ||
        !db
          .prepare("SELECT owner FROM restaurant_terms WHERE owner=?")
          .get(owner) ||
        db
          .prepare(
            "SELECT id FROM account WHERE userId=? AND providerId='credential'",
          )
          .get(owner)
      )
        return null;
    } else {
      if (owner) return null;
      owner = addUser(db, email, name.trim());
      db.prepare("INSERT INTO restaurant_profile(owner,name) VALUES(?,?)").run(
        owner,
        name.trim(),
      );
      db.prepare("INSERT INTO restaurant_terms VALUES(?,?,?,?,?)").run(
        owner,
        commission,
        latitude,
        longitude,
        ovens,
      );
    }
    db.prepare("DELETE FROM staff_code WHERE owner=?").run(owner);
    return issue(db, owner, "invite");
  });
  if (!result)
    return fail("Account already exists or has no pending invitation.", 409);
  let delivered = true;
  try {
    await mail(
      email,
      "Your Yespiz restaurant invitation",
      "Sign in with your email and this one-time password within 15 minutes: " +
        result,
    );
  } catch {
    delivered = false;
  }
  return Response.json(
    { oneTimePassword: result, delivered },
    { headers: { "Cache-Control": "no-store" } },
  );
}
const fail = (error, status = 400) => Response.json({ error }, { status });

export function businessAccess(db, member) {
  const row = db.prepare("SELECT owner,role,active FROM restaurant_members WHERE member=?").get(member);
  if (!row) return { owner: member, role: "owner" };
  return row.active ? { owner: String(row.owner), role: String(row.role) } : null;
}

export async function manageTeam(owner, method, input = {}) {
  const { db } = await staffStore("business");
  if (!db.prepare("SELECT 1 FROM restaurant_terms WHERE owner=?").get(owner)) return fail("Restaurant access is required.", 403);
  if (method === "GET") {
    return Response.json(db.prepare(`SELECT members.member id,user.name,user.email,members.role,members.active FROM restaurant_members members
      JOIN user ON user.id=members.member WHERE members.owner=? ORDER BY user.name`).all(owner));
  }
  const role = typeof input.role === "string" ? input.role : "";
  if (!["manager", "kitchen", "dispatch"].includes(role)) return fail("Select a valid staff role.");
  if (typeof input.id === "string") {
    if (typeof input.active !== "boolean") return fail("Select whether the account is active.");
    const changed = transaction(db, () => {
      const result = db.prepare("UPDATE restaurant_members SET role=?,active=? WHERE owner=? AND member=?")
        .run(role, Number(input.active), owner, input.id);
      if (result.changes && !input.active) db.prepare("DELETE FROM session WHERE userId=?").run(input.id);
      return result.changes;
    });
    return changed ? Response.json({ ok: true }) : fail("Team member not found.", 404);
  }
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 100 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return fail("Enter the team member’s name and email.");
  }
  const code = transaction(db, () => {
    let member = db.prepare("SELECT id FROM user WHERE email=?").get(email)?.id;
    if (member) {
      const existing = db.prepare("SELECT 1 FROM restaurant_members WHERE owner=? AND member=?").get(owner, member);
      const credential = db.prepare("SELECT 1 FROM account WHERE userId=? AND providerId='credential'").get(member);
      if (!existing || credential) return null;
      db.prepare("UPDATE restaurant_members SET role=?,active=1 WHERE member=?").run(role, member);
    } else {
      member = addUser(db, email, name);
      db.prepare("INSERT INTO restaurant_members(member,owner,role) VALUES(?,?,?)").run(member, owner, role);
    }
    return issue(db, member, "invite");
  });
  if (!code) return fail("This account cannot be invited.", 409);
  try {
    await mail(email, "Your Yespizz team invitation", "Use this one-time password within 15 minutes to sign in to the restaurant panel: " + code);
    return Response.json({ delivered: true });
  } catch {
    return Response.json({ delivered: false, oneTimePassword: code });
  }
}

export async function staffAction(role, action, req) {
  if (
    !req.headers.get("content-type")?.includes("application/json") ||
    (req.headers.get("origin") &&
      req.headers.get("origin") !== new URL(req.url).origin)
  )
    return fail("Invalid request.", 403);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return fail("Invalid request.");
  const { auth, db } = await staffStore(role);
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const owner = db.prepare("SELECT id FROM user WHERE email=?").get(email)?.id;
  if (action === "sign-in") {
    if (role === "business" && owner && typeof body.password === "string") {
      const setup = transaction(db, () => {
        const consumed = db
          .prepare(
            "DELETE FROM staff_code WHERE owner=? AND purpose='invite' AND hash=? AND expires>?",
          )
          .run(owner, digest(body.password), Date.now());
        return consumed.changes ? issue(db, owner, "setup") : null;
      });
      if (setup)
        return Response.json(
          { setupToken: setup },
          { headers: { "Cache-Control": "no-store" } },
        );
    }
    const url = new URL("/api/auth/sign-in/email", req.url);
    return auth.handler(
      new Request(url, {
        method: "POST",
        headers: req.headers,
        body: JSON.stringify({ email, password: body.password }),
      }),
    );
  }
  if (action === "forgot-password") {
    if (owner) {
      const code = transaction(db, () => {
        const recent = db
          .prepare(
            "SELECT expires FROM staff_code WHERE owner=? AND purpose='reset'",
          )
          .get(owner);
        return recent?.expires > Date.now() + 14 * 60000
          ? null
          : issue(db, owner, "reset");
      });
      if (code)
        try {
          await mail(
            email,
            "Reset your Yespiz " + role + " password",
            "Your password reset code expires in 15 minutes: " + code,
          );
        } catch {
          console.error("Staff password reset email delivery failed");
        }
    }
    return Response.json({ ok: true });
  }
  if (action === "set-password") {
    if (
      typeof body.token !== "string" ||
      typeof body.password !== "string" ||
      body.password.length < 8 ||
      body.password.length > 128
    )
      return fail("Enter a valid code and an 8–128 character password.");
    const lookup = db.prepare(
      "SELECT owner FROM staff_code WHERE hash=? AND purpose IN ('setup','reset') AND expires>?",
    );
    const key = digest(body.token.trim());
    if (!lookup.get(key, Date.now())) return fail("Invalid or expired code.");
    const hash = await (await auth.$context).password.hash(body.password);
    const changed = transaction(db, () => {
      const row = lookup.get(key, Date.now());
      if (!row) return false;
      credential(db, row.owner, hash);
      db.prepare("DELETE FROM staff_code WHERE owner=?").run(row.owner);
      db.prepare("DELETE FROM session WHERE userId=?").run(row.owner);
      return true;
    });
    return changed
      ? Response.json({ ok: true })
      : fail("Invalid or expired code.");
  }
  if (action === "sign-out")
    return auth.handler(
      new Request(new URL("/api/auth/sign-out", req.url), {
        method: "POST",
        headers: req.headers,
        body: "{}",
      }),
    );
  return fail("Unknown operation.", 404);
}
