import { store } from "@/lib/store";
import { respond } from "../../../../../../../../packages/ui/src/commerce-http";
import { staffCommerce } from "../../../../../../../../packages/ui/src/commerce-staff";
import { CommerceError } from "../../../../../../../../packages/ui/src/commerce-store";

type Context = { params: Promise<{ path: string[] }> };
function route(request: Request, context: Context) {
  return respond(async () => {
    const { auth } = await store();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw new CommerceError(401, "Sign in to manage this restaurant.");
    return staffCommerce(request, (await context.params).path, session.user.id);
  });
}

export { route as GET, route as POST, route as PATCH, route as PUT, route as DELETE };
