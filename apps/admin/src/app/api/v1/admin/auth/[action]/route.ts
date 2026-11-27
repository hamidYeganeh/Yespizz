import {
  staffAction,
  staffStore,
} from "../../../../../../../../../packages/staff/store.mjs";
type Context = { params: Promise<{ action: string }> };
export async function POST(request: Request, { params }: Context) {
  return staffAction("admin", (await params).action, request);
}
export async function GET(request: Request, { params }: Context) {
  if ((await params).action !== "me")
    return new Response(null, { status: 404 });
  const { auth } = await staffStore("admin");
  const session = await auth.api.getSession({ headers: request.headers });
  return Response.json(session?.user ?? null, { status: session ? 200 : 401 });
}
