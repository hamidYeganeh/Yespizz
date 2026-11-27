import { businesses } from "../../../../../../packages/ui/src/order-store";

export function GET() {
  return Response.json(businesses(), { headers: { "Cache-Control": "no-store" } });
}

export function POST() {
  return Response.json({ error: "Use the current checkout to place or change an order." }, { status: 410 });
}
