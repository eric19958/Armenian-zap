/** Client-side helper for admin API calls with clear errors. */
function friendlyHttpError(status: number, text: string): string {
  if (text.trimStart().startsWith("<!DOCTYPE") || text.trimStart().startsWith("<html")) {
    if (status >= 500) {
      return "Server error — restart the dev server (cd frontend && rm -rf .next && npm run dev).";
    }
    return `Unexpected HTML response (${status}). Check the dev server logs.`;
  }
  return text.slice(0, 300);
}

export async function adminFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: friendlyHttpError(res.status, text) };
    }
  }
  if (!res.ok) {
    const err =
      body && typeof body === "object" && body !== null && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(err);
  }
  return body as T;
}
