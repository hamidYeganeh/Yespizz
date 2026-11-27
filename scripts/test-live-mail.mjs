import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Explicitly invoked smoke test. All accounts, credentials and orders belong to temporary databases.
const email = process.env.MAIL_TEST_RECIPIENT;
assert(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
assert(process.env.RESEND_API_KEY && process.env.AUTH_EMAIL_FROM, "Configure the test sender first");
const dir = mkdtempSync(join(tmpdir(), "yespizz-mail-"));
for (const name of ["AUTH","BUSINESS","ADMIN","ORDER"]) process.env[name+"_DATABASE_PATH"] = join(dir,name+".sqlite");
const origin = "http://localhost:7031";
Object.assign(process.env, {BETTER_AUTH_URL:origin, BUSINESS_AUTH_URL:origin, ADMIN_AUTH_URL:origin,
  BETTER_AUTH_SECRET:randomUUID()+randomUUID(), STRIPE_WEBHOOK_SECRET:randomUUID()});
registerHooks({resolve(specifier, context, next) {
  if (specifier === "server-only") return {url:"data:text/javascript,export%20%7B%7D",shortCircuit:true};
  if (specifier.endsWith(".json")) return {...next(specifier,context),importAttributes:{type:"json"}};
  try { return next(specifier,context); } catch(error) {
    if (error.code === "ERR_MODULE_NOT_FOUND" && specifier.startsWith(".") && !specifier.split("/").at(-1).includes(".")) return next(specifier+".ts",context);
    throw error;
  }
}});
const originalFetch = globalThis.fetch;
let accepted = 0, rejected = 0, current;
globalThis.fetch = async (url, init) => {
  assert.equal(String(url), "https://api.resend.com/emails");
  assert.deepEqual(JSON.parse(init.body).to, [email]);
  const response = await originalFetch(url,init);
  const result = await response.clone().json().catch(()=>({}));
  if (response.ok && result.id) { accepted++; console.log("MAIL_ACCEPTED", current, result.id); }
  else { rejected++; console.log("MAIL_REJECTED",current,response.status,String(result.name||"unknown").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80)); }
  return response;
};
const {getAuth,handleCustomerAuth} = await import("../apps/api/src/customer-auth.ts");
const {adminEmail,provision,manageTeam,staffStore,staffAction} = await import("../apps/api/src/staff-auth.mjs");
const auth = await getAuth();
const post = (path, body) => new Request(new URL(path,origin),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
async function check(name, send) {
  current = name;
  const before = accepted;
  await send();
  assert.equal(accepted,before+1,"Provider did not accept "+name);
  await new Promise(resolve=>setTimeout(resolve,650));
}
await check("customer-login",()=>handleCustomerAuth(post("/api/auth/email-otp/send-verification-otp",{email,type:"sign-in"})));
const customer = (await auth.$context).internalAdapter;
await customer.createUser({name:"Mail test",email,emailVerified:true});
await check("customer-recovery",()=>auth.api.requestPasswordResetEmailOTP({body:{email}}));
const password = randomUUID()+"Aa1";
const user = (await customer.findUserByEmail(email)).user;
await customer.linkAccount({userId:user.id,accountId:user.id,providerId:"credential",password:await (await auth.$context).password.hash(password)});
const signIn = await auth.api.signInEmail({body:{email,password},asResponse:true});
const cookie=signIn.headers.getSetCookie().map(raw=>raw.split(";")[0]).join("; ");
await check("customer-deletion-confirmation",()=>auth.api.deleteUser({headers:{cookie},body:{callbackURL:"/"}}));
await check("restaurant-invitation",()=>provision({email,name:"Mail test",ovens:1,commission:0,latitude:48,longitude:16},false));
await check("restaurant-reinvite",()=>provision({email},true));
await check("restaurant-recovery",()=>staffAction("business","forgot-password",post("/forgot-password",{email})));
assert.equal(adminEmail,email,"Administrator recovery requires the administrator's test mailbox");
await check("admin-recovery",()=>staffAction("admin","forgot-password",post("/forgot-password",{email})));
const {db}=await staffStore("business");
// Use a different isolated team fixture so the invited restaurant owner is not also its employee.
db.prepare("UPDATE user SET email=? WHERE email=?").run("owner@example.test",email);
const owner=db.prepare("SELECT owner FROM restaurant_terms").get().owner;
await check("team-invitation",()=>manageTeam(owner,"POST",{email,name:"Mail tester",role:"kitchen"}));
const {withCommerce,insertOrder,saveOrder} = await import("../packages/ui/src/commerce-store.ts");
const {stripeWebhook}=await import("../packages/ui/src/commerce-payment.ts");
const reference="EMAIL-TEST-"+randomUUID().slice(0,8);
withCommerce(db=>{const o=insertOrder(db,{reference,owner,shopper:user.id,guest:"",email,total:1700,lines:[{quantity:1,name:"Demo Margherita (email test)"}]});o.sessionId="cs_fixture";saveOrder(db,o)},true);
const payload=JSON.stringify({type:"checkout.session.completed",data:{object:{client_reference_id:reference,id:"cs_fixture",amount_total:1700,currency:"eur",payment_status:"paid",payment_intent:"pi_fixture"}}});
const now=Math.floor(Date.now()/1000);
const sig=createHmac("sha256",process.env.STRIPE_WEBHOOK_SECRET).update(now+"."+payload).digest("hex");
await check("receipt",()=>stripeWebhook(new Request(origin,{method:"POST",headers:{"stripe-signature":"t="+now+",v1="+sig},body:payload})));
assert.equal(rejected,0);
