import { proxyAuth } from "../../../../../../../../packages/staff/api-client";
import { signedIn } from "../../../../admin-session";
import { businesses } from "../../../../../../../../packages/ui/src/order-store";
export async function GET() {
  if (!await signedIn()) return new Response(null, { status: 401 });
  return Response.json(businesses(), { headers: { "Cache-Control": "no-store" } });
}
async function forward(request: Request) { return proxyAuth(request); }
export { forward as POST };
