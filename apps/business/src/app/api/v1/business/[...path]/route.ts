import { authSession } from "../../../../../../../../packages/staff/api-client";
import { respond } from "../../../../../../../../packages/ui/src/commerce-http";
import { staffCommerce } from "../../../../../../../../packages/ui/src/commerce-staff";
import { CommerceError } from "../../../../../../../../packages/ui/src/commerce-store";

type Context = { params: Promise<{ path: string[] }> };
function route(request: Request, context: Context) {
  return respond(async () => {
    const session = await authSession("business", request.headers);
    if (!session) throw new CommerceError(401, "Sign in to manage this restaurant.");
    return staffCommerce(request, (await context.params).path, session.user.businessOwner ?? session.user.id, session.user.businessRole ?? "owner");
  });
}

export { route as GET, route as POST, route as PATCH, route as PUT, route as DELETE };
