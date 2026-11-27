import { proxyAuth } from "../../../../../../../../packages/staff/api-client";
async function forward(request: Request) { return proxyAuth(request); }
export { forward as GET, forward as POST };
