import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { staffStore, adminEmail } from "../apps/api/src/staff-auth.mjs";

const root = join(import.meta.dirname, "..");
const databases = mkdtempSync(join(tmpdir(), "yespizz-demo-"));
const data = join(root, ".data");
mkdirSync(data, { recursive: true });
const storage = mkdtempSync(join(data, "demo-"));
const host = "127.0.0.1";
const ports = { application: 17331, admin: 17332, business: 17333, courier: 17334, api: 17338 };
const urls = Object.fromEntries(Object.entries(ports).map(([app, port]) => [app, `http://${host}:${port}`]));
const mobile = process.argv.includes("--mobile");
const publicUrls = { ...urls };
if (mobile) {
  for (const app of ["application", "business", "courier"]) {
    const url = new URL(process.env[`DEMO_${app.toUpperCase()}_ORIGIN`]);
    if (url.protocol !== "https:" || url.href !== url.origin + "/") throw Error("Expected an HTTPS demo origin.");
    publicUrls[app] = url.origin;
  }
}
const password = randomBytes(12).toString("base64url");
const demoMailer = {
  RESEND_API_KEY: process.env.DEMO_RESEND_API_KEY || "",
  AUTH_EMAIL_FROM: process.env.DEMO_AUTH_EMAIL_FROM || "",
};
if (Boolean(demoMailer.RESEND_API_KEY) !== Boolean(demoMailer.AUTH_EMAIL_FROM))
  throw Error("Configure both DEMO_RESEND_API_KEY and DEMO_AUTH_EMAIL_FROM for demo mail.");
const env = {
  NODE_ENV: mobile ? "production" : "development",
  YESPIZZ_MOBILE_DEMO_ORIGIN: mobile ? publicUrls.application : "",
  YESPIZZ_LOCAL_DEMO: "1",
  NEXT_PUBLIC_YESPIZ_OFFLINE: "0",
  YESPIZZ_API_URL: urls.api,
  BETTER_AUTH_URL: publicUrls.application,
  ADMIN_AUTH_URL: urls.admin,
  BUSINESS_AUTH_URL: publicUrls.business,
  BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
  ADMIN_PASSWORD: password,
};
for (const name of ["ORDER", "BUSINESS", "ADMIN", "AUTH"]) {
  env[`${name}_DATABASE_PATH`] = join(databases, `${name.toLowerCase()}.sqlite`);
}
// Prevent local environment files from enabling external integrations during the demo.
for (const name of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_CONNECT_ENABLED",
  "RESEND_API_KEY", "AUTH_EMAIL_FROM", "GOOGLE_PLACES_API_KEY", "OSRM_API_URL", "APNS_PRIVATE_KEY",
  "FCM_PRIVATE_KEY", "GOOGLE_CLIENT_ID", "APPLE_CLIENT_ID", "ADMIN_AUTH_SECRET",
  "BUSINESS_AUTH_SECRET", "OBSERVE_APP_KEY", "OBSERVE_APP_SECRET",
  "YESPIZZ_API_VERCEL_BYPASS_SECRET", "VERCEL"]) env[name] = "";
Object.assign(process.env, env);

const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
const children = [];
let stopping = false;
function stop() {
  stopping = true;
  for (const child of children) child.kill();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
function launch(app) {
  const bind = mobile && app !== "admin" ? "0.0.0.0" : host;
  const args = app === "api" ? ["dist/main.js"] : [next, mobile ? "start" : "dev", "-H", bind, "-p", String(ports[app])];
  const child = spawn(process.execPath, args, {
    cwd: join(root, "apps", app),
    env: { ...process.env, DEMO_RESEND_API_KEY: "", DEMO_AUTH_EMAIL_FROM: "",
      ...(app === "api" ? demoMailer : {}), PORT: String(ports[app]), HOST: host },
    stdio: "inherit",
  });
  children.push(child);
  child.on("exit", (code) => {
    if (stopping) return;
    console.error(`${app} exited (${code}).`);
    process.exitCode = 1;
    stop();
  });
}

async function waitFor(app, path = "/") {
  for (let attempt = 0; attempt < 60 && !stopping; attempt++) {
    try {
      if ((await fetch(urls[app] + path, { signal: AbortSignal.timeout(4000) })).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw Error(`Could not start ${app} at ${urls[app]}.`);
}

async function seed() {
  const { auth, db } = await staffStore("business");
  const hash = await (await auth.$context).password.hash(password);
  const orders = new DatabaseSync(env.ORDER_DATABASE_PATH);
  const record = orders.prepare("INSERT INTO commerce_records(scope,collection,id,data) VALUES(?,?,?,?)");
  try {
    const restaurants = ["Central", "Danube", "Market", "Park"].map((name, index) => {
      const owner = randomUUID();
      const email = `${name.toLowerCase()}@yespizz.demo`;
      db.prepare("INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").run(owner, name, email);
      db.prepare("INSERT INTO account(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES(?,?,'credential',?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").run(randomUUID(), owner, owner, hash);
      db.prepare("INSERT INTO restaurant_profile VALUES(?,?,'Vienna',?,'[\"pizza\"]')").run(owner, `Yespizz ${name}`, name.toLowerCase());
      db.prepare("INSERT INTO restaurant_terms VALUES(?,10,?,16.3738,2)").run(owner, 48.2082 + index * 0.014);
      record.run(owner, "restaurant", "settings", JSON.stringify({ accepting: true, minimum: 0, etaMinutes: 30, slotCapacity: 20 }));
      record.run(owner, "delivery-zones", "vienna", JSON.stringify({ name: "Vienna", prefixes: ["1"], active: true }));
      record.run(owner, "couriers", "demo-rider", JSON.stringify({ name: "Demo rider" }));
      const feedback = ["Crisp crust and fresh basil.", "Arrived warm, with plenty of mozzarella.", "Good flavour. I would prefer a thinner crust.", "The courier found the entrance easily."];
      record.run(owner, "reviews", "demo-rating", JSON.stringify({ rating: [5, 5, 4, 3][index], text: feedback[index], items: [String(index + 1)], at: new Date().toISOString(), published: true, demo: true }));
      return { email };
    });
    record.run("system", "configuration", "local-demo", "{}");
    return restaurants;
  } finally {
    orders.close();
  }
}

try {
  await staffStore("admin");
  launch("application");
  await waitFor("application", "/api/v1/health");
  const restaurants = await seed();
  for (const app of ["api", "admin", "business", "courier"]) launch(app);
  await Promise.all(Object.keys(ports).map((app) => waitFor(app)));
  const config = { urls: publicUrls, adminEmail, restaurants, password };
  writeFileSync(join(storage, "demo.json"), JSON.stringify(config, null, 2));
  console.log("\nDemo ready\n", publicUrls, "\nCredentials:", join(storage, "demo.json"));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
  stop();
}
