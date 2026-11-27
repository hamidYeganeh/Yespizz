import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { apiFetch } from "../../../../packages/staff/api-client";
import type { Profile } from "./restaurant";

type Terms = { commission: number; latitude: number; longitude: number; ovens: number };

export async function restaurant(): Promise<{ owner: string; profile: Profile; terms?: Terms }> {
  const result = await apiFetch("/api/v1/business/restaurant-profile", await headers());
  if (result.status === 401) redirect("/auth/sign-in");
  if (!result.ok) throw new Error("Restaurant service unavailable.");
  return result.json();
}
