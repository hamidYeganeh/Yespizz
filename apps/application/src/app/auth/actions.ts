"use server";

import { cookies, headers } from "next/headers";
import { getAuth } from "@/lib/auth";

export async function needsPassword() {
  const auth = await getAuth();
  const accounts = await auth.api.listUserAccounts({ headers: await headers() });
  return !accounts.some(account => account.providerId === "credential");
}

export async function registerPassword(password: string) {
  if (typeof password !== "string" || password.length < 8 || password.length > 128 ||
    !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
    return { error: "Use 8–128 characters with uppercase and lowercase letters and a number." };
  }
  const auth = await getAuth();
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user.emailVerified) return { error: "Verify your email again to continue." };
  await auth.api.setPassword({ headers: requestHeaders, body: { newPassword: password } });
  return { error: null };
}

export async function saveContactPhone(value: string) {
  const phone = typeof value === "string" ? value.replace(/[\s()-]/g, "") : "";
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) return { error: "Include your country code and phone number." };
  const auth = await getAuth();
  const requestHeaders = await headers();
  if (!(await auth.api.getSession({ headers: requestHeaders }))?.user.emailVerified) {
    return { error: "Verify your email again to continue." };
  }
  await auth.api.updateUser({ headers: requestHeaders, body: { contactPhone: phone } });
  return { error: null };
}

const recoveryCookie = "yespiz-password-recovery";
const recoveryPath = "/auth/set-password";

export async function verifyRecoveryCode(email: string, otp: string) {
  const auth = await getAuth();
  try {
    await auth.api.checkVerificationOTP({ body: { email, otp, type: "forget-password" }, headers: await headers() });
  } catch {
    return { error: "This reset code is invalid or has expired." };
  }
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
  const auth = await getAuth();
  try {
    await auth.api.resetPasswordEmailOTP({ body: { email, otp, password }, headers: await headers() });
  } catch {
    return { error: "Could not reset your password. Request a new code and try again." };
  }
  jar.delete({ name: recoveryCookie, path: recoveryPath });
  return { error: null };
}
