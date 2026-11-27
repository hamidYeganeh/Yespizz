import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { getAuth } from "./auth.ts";

test("customer verifies email, sets password, logs in and resets password", async (t) => {
  Object.assign(process.env, {
    AUTH_DATABASE_PATH: join(
      mkdtempSync(join(tmpdir(), "yespiz-customer-")),
      "test.sqlite",
    ),
    BETTER_AUTH_URL: "http://localhost:7031",
    BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
    RESEND_API_KEY: "fixture",
    AUTH_EMAIL_FROM: "yespiz@example.test",
  });
  let code;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url, "https://api.resend.com/emails");
    code = JSON.parse(init.body).text.match(/\b\d{5}\b/)[0];
    return new Response("{}");
  });
  const { api } = await getAuth(),
    email = "customer@example.test",
    password = "MyCustomerPass1";
  await api.sendVerificationOTP({ body: { email, type: "sign-in" } });
  const verified = await api.signInEmailOTP({
    body: { email, otp: code },
    asResponse: true,
  });
  const cookie = verified.headers
    .getSetCookie()
    .map((raw) => raw.split(";")[0])
    .join("; ");
  await api.setPassword({
    headers: { cookie },
    body: { newPassword: password },
  });
  await api.signInEmail({ body: { email, password } });
  await api.requestPasswordResetEmailOTP({ body: { email } });
  await api.resetPasswordEmailOTP({
    body: { email, otp: code, password: password + "2" },
  });
  await assert.rejects(api.signInEmail({ body: { email, password } }));
  await api.signInEmail({ body: { email, password: password + "2" } });
});
