import "server-only";

type Session = {
  user: { id: string; email: string; emailVerified: boolean; name: string };
};
type Role = "admin" | "business" | "customer";

export async function apiFetch(
  path: string,
  incoming: Headers,
  init?: RequestInit,
) {
  const headers = new Headers(init?.headers);
  for (const key of [
    "cookie",
    "origin",
    "content-type",
    "accept",
    "user-agent",
    "sec-fetch-site",
    "sec-fetch-mode",
    "sec-fetch-dest",
  ]) {
    const value = incoming.get(key);
    if (value && !headers.has(key)) headers.set(key, value);
  }
  const origin = process.env.YESPIZZ_API_URL ?? "http://localhost:7038";
  const upstream = new URL(path, origin);
  if (upstream.origin !== new URL(origin).origin) {
    throw new Error("Invalid authentication service URL.");
  }
  const bypass = process.env.YESPIZZ_API_VERCEL_BYPASS_SECRET;
  if (upstream.protocol === "https:" && bypass) {
    headers.set("x-vercel-protection-bypass", bypass);
  }
  return fetch(upstream, {
    ...init,
    headers,
    cache: "no-store",
    redirect: "manual",
  });
}

export async function proxyAuth(request: Request, route?: string) {
  const { pathname, search, origin } = new URL(request.url);
  const requestOrigin = request.headers.get("origin");
  if (
    requestOrigin &&
    requestOrigin !== origin &&
    !(
      pathname === "/api/auth/callback/apple" &&
      requestOrigin === "https://appleid.apple.com"
    )
  ) {
    return new Response(null, { status: 403 });
  }
  try {
    const upstream = await apiFetch(
      (route ?? pathname) + search,
      request.headers,
      {
        method: request.method,
        body:
          request.method === "GET" || request.method === "HEAD"
            ? undefined
            : await request.arrayBuffer(),
      },
    );
    const headers = new Headers({ "Cache-Control": "no-store" });
    for (const name of ["content-type", "location", "retry-after"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    for (const cookie of upstream.headers.getSetCookie())
      headers.append("set-cookie", cookie);
    return new Response(upstream.body, { headers, status: upstream.status });
  } catch {
    return Response.json(
      { message: "Authentication service unavailable." },
      { status: 502 },
    );
  }
}

export async function authSession(
  role: Role,
  headers: Headers,
): Promise<Session | null> {
  const scope = role === "customer" ? "" : role + "/";
  const result = await apiFetch("/api/v1/" + scope + "auth/session", headers);
  if (result.status === 401) return null;
  if (!result.ok) throw new Error("Authentication service unavailable.");
  return result.json();
}

export async function authPost(
  path: string,
  data: Record<string, unknown>,
  headers: Headers,
) {
  return apiFetch(path, headers, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
