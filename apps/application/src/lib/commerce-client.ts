export async function commerceApi<T>(path: string, method = "GET", data?: unknown): Promise<T> {
  const response = await fetch(`/api/v1/${path}`, {
    method, cache: "no-store", ...(data !== undefined && { headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || "The request could not be completed.");
  return result as T;
}
