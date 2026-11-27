import { proxyAuth } from "../../../../../../../../packages/staff/api-client";

function team(request: Request) { return proxyAuth(request); }

export { team as GET, team as POST };
