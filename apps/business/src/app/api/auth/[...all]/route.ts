import { proxyAuth } from "../../../../../../../packages/staff/api-client";
async function forward(request: Request) {
  return proxyAuth(request, new URL(request.url).pathname.replace("/api/auth/", "/api/v1/business/legacy-auth/"));
}
export { forward as GET, forward as POST };
