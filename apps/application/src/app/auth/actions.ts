"use server";

import { cookies, headers } from "next/headers";
import { apiFetch, authSession, authPost } from "../../../../../packages/staff/api-client";

export async function needsPassword() {
  const result = await apiFetch("/api/auth/list-accounts", await headers());
  if (!result.ok) throw new Error("Could not check your account.");
  const accounts: { providerId: string }[] = await result.json();
  return !accounts.some(account => account.providerId === "credential");
}

export async function saveContactPhone(value: string) {
  const phone = typeof value === "string" ? value.replace(/[\s()-]/g, "") : "";
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) return { error: "Include your country code and phone number." };
  const incoming = await headers();
  if (!(await authSession("customer", incoming))?.user.emailVerified) {
    return { error: "Verify your email again to continue." };
  }
  const result = await authPost("/api/auth/update-user", { contactPhone: phone }, incoming);
  return { error: result.ok ? null : "Could not save your phone number." };
}

const recoveryCookie = "yespiz-password-recovery";
const recoveryPath = "/auth/set-password";

export async function verifyRecoveryCode(email: string, otp: string) {
  const result = await authPost("/api/v1/auth/check-reset-code", { email, otp, type: "forget-password" }, await headers());
  if (!result.ok) return { error: "This reset code is invalid or has expired." };
  (await cookies()).set(recoveryCookie, JSON.stringify({ email, otp }), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: recoveryPath, maxAge: 300,
  });
  return { error: null };
}

export async function resetVerifiedPassword(password: string) {
  const jar = await cookies();
  const saved = jar.get(recoveryCookie)?.value;
  if (!saved) return { error: "Request a new reset code to continue." };
  const { email, otp } = JSON.parse(saved);
  const result = await authPost("/api/v1/auth/reset-password", { email, otp, password }, await headers());
  if (!result.ok) return { error: "Could not reset your password. Request a new code and try again." };
  jar.delete({ name: recoveryCookie, path: recoveryPath });
  return { error: null };
}
