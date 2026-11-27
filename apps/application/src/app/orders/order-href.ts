export function orderHref(reference: string, cancel = false) {
  const path = cancel ? "/cancel" : "";
  return process.env.NEXT_PUBLIC_YESPIZ_OFFLINE === "1"
    ? `/orders/demo${path}?ref=${encodeURIComponent(reference)}`
    : `/orders/${encodeURIComponent(reference)}${path}`;
}
