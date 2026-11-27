import { store } from "@/lib/store";
async function handler(request:Request) {
  return (await store()).auth.handler(request);
}
export { handler as GET, handler as POST };
