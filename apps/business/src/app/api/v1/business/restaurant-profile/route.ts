import { proxyAuth } from "../../../../../../../../packages/staff/api-client";

function profile(request: Request) { return proxyAuth(request); }

export { profile as GET, profile as POST };
