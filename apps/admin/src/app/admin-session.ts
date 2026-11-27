import "server-only";
import { headers } from "next/headers";
import { staffStore, adminEmail } from "../../../../packages/staff/store.mjs";
export async function signedIn() {
  const { auth } = await staffStore("admin");
  return (
    (await auth.api.getSession({ headers: await headers() }))?.user.email ===
    adminEmail
  );
}
