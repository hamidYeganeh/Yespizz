import { signedIn } from "../../../../admin-session";
import { respond } from "../../../../../../../../packages/ui/src/commerce-http";
import { staffCommerce } from "../../../../../../../../packages/ui/src/commerce-staff";
import { CommerceError } from "../../../../../../../../packages/ui/src/commerce-store";

type Context = { params: Promise<{ path: string[] }> };
function route(request: Request, context: Context) {
  return respond(async () => {
    if (!await signedIn()) throw new CommerceError(401, "Sign in as administrator.");
    return staffCommerce(request, (await context.params).path);
  });
}

export { route as GET, route as POST, route as PATCH, route as PUT, route as DELETE };
