"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authPost } from "../../../../../packages/staff/api-client";
import type { Step } from "@/lib/restaurant";

export async function saveStep(step: Step, value: string | string[]) {
  const result = await authPost("/api/v1/business/restaurant-profile", { step, value }, await headers());
  if (result.status === 401) redirect("/auth/sign-in");
  if (result.status === 400) return (await result.json()).message as string;
  if (!result.ok) return "Restaurant service unavailable.";
  const { next } = await result.json();
  redirect("/onboarding/" + next);
}
