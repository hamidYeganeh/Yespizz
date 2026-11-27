import { proxyAuth } from "../../../../../../../../packages/staff/api-client";
import { cookies } from "next/headers";

async function forward(request: Request) {
  if (request.method === "GET" && /\/(?:me|session)$/.test(new URL(request.url).pathname)) {
    const jar = await cookies();
    if (!jar.has("better-auth.session_token") && !jar.has("__Secure-better-auth.session_token")) {
      return Response.json(null, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
  }
  return proxyAuth(request);
}
export { forward as GET, forward as POST };
