import "server-only";
import { headers } from "next/headers";
import { authSession } from "../../../../packages/staff/api-client";
export async function signedIn() {
  return Boolean(await authSession("admin", await headers()));
}
