import {
  businesses,
  place,
  updateOrder,
} from "../../../../../../packages/ui/src/order-store";
import { menu } from "../../menu/[id]/catalog";
import { offerAmount, offerCode } from "../../payment/discount";
import { cookies } from "next/headers";
export function GET() {
  return Response.json(businesses(), {
    headers: { "Cache-Control": "no-store" },
  });
}
export async function POST(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin)
    return new Response(null, { status: 403 });
  const b = await req.json();
  const jar = await cookies();
  const customer = jar.get("yespiz-order-owner")?.value || crypto.randomUUID();
  if (b.status === "cancelled" || b.status === "completed") {
    updateOrder(String(b.reference), customer, b.status);
    return Response.json({ ok: true });
  }
  if (
    !businesses().some((x) => x.owner === b.owner) ||
    !/^FIT[0-9a-f-]{36}$/.test(b.reference) ||
    !Number.isFinite(b.point?.lat) ||
    Math.abs(b.point.lat) > 90 ||
    !Number.isFinite(b.point?.lng) ||
    Math.abs(b.point.lng) > 180
  )
    return new Response(null, { status: 400 });
  let total = 0;
  for (const [id, qty] of Object.entries(b.items ?? {})) {
    const dish = menu.find((m) => m.id === id);
    if (
      !dish ||
      typeof qty !== "number" ||
      !Number.isSafeInteger(qty) ||
      qty < 1 ||
      qty > 999
    )
      return new Response(null, { status: 400 });
    total += qty * dish.price;
  }
  if (!total) return new Response(null, { status: 400 });
  place(b.owner, customer, {
    reference: b.reference,
    total: Math.max(0, total - (b.code === offerCode ? offerAmount : 0)),
    district: String(b.city || "Delivery").slice(0, 100),
    lat: b.point.lat,
    lng: b.point.lng,
    placedAt: new Date().toISOString(),
    status: "active",
  });
  jar.set("yespiz-order-owner", customer, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 31536000,
  });
  return Response.json({ ok: true });
}
