import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { adminEmail, provision, staffAction, staffStore } from "../../apps/api/src/staff-auth.mjs";

test("provision, rotate invitation, redeem once, sign in and recover staff credentials", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "yespiz-staff-"));
  Object.assign(process.env, {
    ADMIN_DATABASE_PATH: join(dir, "admin.sqlite"),
    BUSINESS_DATABASE_PATH: join(dir, "business.sqlite"),
    ADMIN_PASSWORD: "Admin-Test-Password1",
    AUTH_EMAIL_FROM: "test@example.test",
    RESEND_API_KEY: "fixture",
  });
  const messages = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url, "https://api.resend.com/emails");
    messages.push(JSON.parse(init.body));
    return new Response("{}");
  });
  const email = "restaurant@example.test",
    restaurant = {
      email,
      name: "Restaurant",
      ovens: 3,
      commission: 10,
      latitude: 48,
      longitude: 16,
    };
  const call = (role, action, body) =>
    staffAction(
      role,
      action,
      new Request(
        "http://localhost:" +
          (role === "admin" ? 7032 : 7033) +
          "/api/v1/" +
          role +
          "/auth/" +
          action,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      ),
    );
  assert.equal(
    (
      await call("admin", "sign-in", {
        email: adminEmail,
        password: process.env.ADMIN_PASSWORD,
      })
    ).status,
    200,
  );
  const first = await (await provision(restaurant, false)).json();
  assert.equal(first.delivered, true);
  assert.equal((await provision(restaurant, false)).status, 409);
  const second = await (await provision({ email }, true)).json();
  assert.ok(messages.at(-1).text.includes(second.oneTimePassword));
  const signIn = (password) => call("business", "sign-in", { email, password });
  assert.equal((await signIn(first.oneTimePassword)).status, 401);
  const { setupToken } = await (await signIn(second.oneTimePassword)).json();
  assert.ok(setupToken);
  assert.equal((await signIn(second.oneTimePassword)).status, 401);
  const password = "New-Restaurant-Password1";
  assert.equal(
    (await call("business", "set-password", { token: setupToken, password }))
      .status,
    200,
  );
  assert.equal(
    (await call("business", "set-password", { token: setupToken, password }))
      .status,
    400,
  );
  assert.equal((await provision({ email }, true)).status, 409);
  delete process.env.RESEND_API_KEY;
  for (const address of [email, "unknown@example.test"]) {
    const response = await call("business", "forgot-password", { email: address });
    assert.equal(response.status, 503);
  }
  process.env.RESEND_API_KEY = "fixture";
  for (const [role, address, old] of [
    ["admin", adminEmail, process.env.ADMIN_PASSWORD],
    ["business", email, password],
  ]) {
    (await staffStore(role)).db.prepare("DELETE FROM rateLimit").run();
    const session = await call(role, "sign-in", {
      email: address,
      password: old,
    });
    assert.equal(session.status, 200);
    await call(role, "forgot-password", { email: address });
    const token = messages.at(-1).text.split(": ").at(-1);
    assert.equal(
      (await call(role, "set-password", { token, password: password + "2" }))
        .status,
      200,
    );
    assert.equal(
      (await call(role, "sign-in", { email: address, password: old })).status,
      401,
    );
    assert.equal(
      (await staffStore(role)).db
        .prepare("SELECT count(*) AS n FROM session")
        .get().n,
      0,
    );
    assert.equal(
      (
        await call(role, "sign-in", {
          email: address,
          password: password + "2",
        })
      ).status,
      200,
    );
  }
});
