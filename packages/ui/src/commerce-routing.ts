import "server-only";
import type { Point } from "./commerce-store";

export async function courierEta(from: Point, to: Point) {
  const configured = process.env.OSRM_API_URL;
  if (!configured) return null;
  try {
    const url = new URL(`route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}`, `${configured.replace(/\/$/, "")}/`);
    url.searchParams.set("overview", "false");
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(3500) });
    if (!response.ok) return null;
    const result = await response.json() as { routes?: { duration: number }[] };
    const seconds = result.routes?.[0]?.duration;
    return typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0 && seconds < 86400
      ? new Date(Date.now() + seconds * 1000).toISOString() : null;
  } catch { return null; }
}
