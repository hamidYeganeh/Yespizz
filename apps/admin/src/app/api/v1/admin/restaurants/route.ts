import { signedIn } from "../../../../admin-session";
import { provision } from "../../../../../../../../packages/staff/store.mjs";
export async function POST(request: Request) {
  if (!(await signedIn())) return new Response(null, { status: 401 });
  if (
    !request.headers.get("content-type")?.includes("application/json") ||
    (request.headers.get("origin") &&
      request.headers.get("origin") !== new URL(request.url).origin)
  )
    return new Response(null, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object")
    return new Response(null, { status: 400 });
  return provision(body, body.resend === true);
}
