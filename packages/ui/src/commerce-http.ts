import "server-only";
import { CommerceError } from "./commerce-store";

export async function respond(work: () => unknown | Promise<unknown>) {
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
  try {
    return Response.json(await work(), { headers });
  } catch (error) {
    if (error instanceof CommerceError) return Response.json({ error: error.message }, { status: error.status, headers });
    console.error("Commerce request failed", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ error: "This request could not be completed." }, { status: 500, headers });
  }
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new CommerceError(403, "Invalid request origin.");
}

export async function jsonBody(request: Request) {
  sameOrigin(request);
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new CommerceError(415, "This endpoint requires JSON.");
  }
  const text = await request.text();
  if (text.length > 400_000) throw new CommerceError(413, "The request is too large.");
  const data: unknown = JSON.parse(text || "null", (_, value) => value);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new CommerceError(400, "Invalid request data.");
  return data as Record<string, unknown>;
}

export function inputText(value: unknown, limit: number, required = false) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length > limit || (required && !text)) throw new CommerceError(400, "A required field is missing or too long.");
  return text;
}
