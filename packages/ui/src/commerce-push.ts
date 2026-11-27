import "server-only";
import { createSign, sign } from "node:crypto";
import { connect } from "node:http2";
import { getRecord, records, withCommerce, type Order } from "./commerce-store";
import type { Stage } from "./commerce-store";

function encode(value: unknown) { return Buffer.from(JSON.stringify(value)).toString("base64url"); }
const appleHost = () => process.env.APNS_PRODUCTION === "1" ? "https://api.push.apple.com" : "https://api.sandbox.push.apple.com";
const fcmScope = "https://www.googleapis.com/auth/firebase.messaging";
const googleTokenUrl = "https://oauth2.googleapis.com/token";
let googleToken: { value: string; until: number } | undefined;

export function pushAvailable(platform: string) {
  return platform === "android"
    ? Boolean(process.env.FCM_PROJECT_ID && process.env.FCM_CLIENT_EMAIL && process.env.FCM_PRIVATE_KEY)
    : platform === "ios" && Boolean(process.env.APNS_TEAM_ID && process.env.APNS_KEY_ID && process.env.APNS_PRIVATE_KEY && process.env.APNS_TOPIC);
}

async function androidPush(token: string, text: string, reference: string) {
  const now = Math.floor(Date.now() / 1000);
  if (!googleToken || googleToken.until <= now + 60) {
    const source = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iss: process.env.FCM_CLIENT_EMAIL, aud: googleTokenUrl, scope: fcmScope, iat: now, exp: now + 3600 })}`;
    const signature = createSign("RSA-SHA256").update(source).sign(process.env.FCM_PRIVATE_KEY!.replace(/\\n/g, "\n"), "base64url");
    const response = await fetch(googleTokenUrl, { method: "POST", signal: AbortSignal.timeout(5000),
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${source}.${signature}` }) });
    if (!response.ok) throw new Error("FCM credentials are unavailable.");
    const data = await response.json() as { access_token: string; expires_in: number };
    googleToken = { value: data.access_token, until: now + data.expires_in };
  }
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(process.env.FCM_PROJECT_ID!)}/messages:send`, {
    method: "POST", headers: { Authorization: `Bearer ${googleToken.value}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(5000),
    body: JSON.stringify({ message: { token, notification: { title: "Yespizz", body: text }, data: { reference } } }),
  });
  return response.ok;
}

async function applePush(token: string, text: string, reference: string) {
  const source = `${encode({ alg: "ES256", kid: process.env.APNS_KEY_ID })}.${encode({ iss: process.env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) })}`;
  const signature = sign("sha256", Buffer.from(source), { key: process.env.APNS_PRIVATE_KEY!.replace(/\\n/g, "\n"), dsaEncoding: "ieee-p1363" }).toString("base64url");
  const client = connect(appleHost());
  return new Promise<boolean>((resolve, reject) => {
    let status: number | undefined;
    const stream = client.request({ ":method": "POST", ":path": `/3/device/${encodeURIComponent(token)}`,
      authorization: `bearer ${source}.${signature}`, "apns-topic": process.env.APNS_TOPIC,
      "apns-push-type": "alert", "apns-priority": "10", "content-type": "application/json" });
    const abort = setTimeout(() => { client.destroy(); reject(new Error("APNs timed out.")); }, 5000);
    const complete = (error?: Error) => {
      clearTimeout(abort); client.close();
      if (error) reject(error); else resolve(status === 200);
    };
    client.once("error", complete);
    stream.once("error", complete);
    stream.on("response", headers => { status = headers[":status"]; });
    stream.resume();
    stream.once("end", () => complete());
    stream.end(JSON.stringify({ aps: { alert: { title: "Yespizz", body: text }, sound: "default" }, reference }));
  });
}

export async function sendOrderPush(order: Order, stage: Stage) {
  if (!order.shopper || order.shopper === "deleted" || (!pushAvailable("android") && !pushAvailable("ios"))) return;
  const scope = `customer:${order.shopper}`;
  const preferences = getRecord(scope, "preferences", "sounds")?.value;
  if (preferences && typeof preferences === "object" && "general" in preferences && preferences.general === false) return;
  const devices = records(scope, "devices").slice(0, 20);
  const template = [...records(order.owner, "notification-templates"), ...records("admin", "notification-templates")]
    .find(row => row.active === true && row.event === stage && row.channel === "push");
  const message = typeof template?.message === "string" ? template.message.slice(0, 300) : `Order update: ${stage.replaceAll("_", " ")}`;
  await Promise.allSettled(devices.map(async device => {
    if (typeof device.token !== "string" || typeof device.platform !== "string" || !pushAvailable(device.platform)) return;
    const key = `${order.reference}:${stage}:${device.id}`;
    const claimed = withCommerce(db => db.prepare("INSERT OR IGNORE INTO commerce_records VALUES(?,?,?,'{}')").run(scope, "push-sends", key).changes, true);
    if (!claimed) return;
    let success = false;
    try {
      success = await (device.platform === "android" ? androidPush(device.token, message, order.reference) : applePush(device.token, message, order.reference));
    } finally {
      if (!success) withCommerce(db => db.prepare("DELETE FROM commerce_records WHERE scope=? AND collection='push-sends' AND id=?").run(scope, key), true);
    }
  }));
}
