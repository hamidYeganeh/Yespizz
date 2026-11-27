import { getAuth } from "@/lib/auth";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;
  const paths: Record<string, string> = {
    "sign-in": "sign-in/email",
    "sign-up": "email-otp/send-verification-otp",
    "verify-code": "sign-in/email-otp",
    "forgot-password": "email-otp/request-password-reset",
    "reset-password": "email-otp/reset-password",
    "sign-out": "sign-out",
  };
  if (!Object.hasOwn(paths, action) && action !== "set-password")
    return new Response(null, { status: 404 });
  if (
    !request.headers.get("content-type")?.includes("application/json") ||
    (request.headers.get("origin") &&
      request.headers.get("origin") !== new URL(request.url).origin)
  )
    return new Response(null, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object")
    return new Response(null, { status: 400 });
  const auth = await getAuth();
  if (action === "set-password") {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user.emailVerified)
      return new Response(null, { status: 401 });
    if (
      typeof body.password !== "string" ||
      body.password.length < 8 ||
      body.password.length > 128 ||
      !/[A-Z]/.test(body.password) ||
      !/[a-z]/.test(body.password) ||
      !/\d/.test(body.password)
    )
      return Response.json(
        {
          message:
            "Use 8–128 characters with uppercase, lowercase and a number.",
        },
        { status: 400 },
      );
    try {
      await auth.api.setPassword({
        headers: request.headers,
        body: { newPassword: body.password },
      });
    } catch {
      return Response.json(
        { message: "Unable to set password." },
        { status: 400 },
      );
    }
    return Response.json({ ok: true });
  }
  return auth.handler(
    new Request(new URL("/api/auth/" + paths[action], request.url), {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(
        action === "sign-up" ? { email: body.email, type: "sign-in" } : body,
      ),
    }),
  );
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  if ((await params).action !== "me")
    return new Response(null, { status: 404 });
  const session = await (
    await getAuth()
  ).api.getSession({ headers: request.headers });
  return Response.json(session?.user ?? null, { status: session ? 200 : 401 });
}
