export function signInHref(destination: string) {
  return withSignInReturn("/auth/methods", destination);
}

export function withSignInReturn(path: string, destination: string) {
  return destination ? path + (path.includes("?") ? "&" : "?") +
    new URLSearchParams({ next: destination }) : path;
}

export function signInReturn() {
  const next = new URLSearchParams(window.location.search).get("next") ?? "";
  return /^\/(?:payment|menu(?:\/[\w-]+)?|profile\/(?:account|address|payment|security|favorites|invite))?(?:\?[^#\\\r\n]*)?$/.test(next)
    ? next : "";
}
