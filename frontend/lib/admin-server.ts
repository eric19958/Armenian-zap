import { createClient } from "@supabase/supabase-js";

function formatSupabaseError(error: unknown): string {
  if (!error) return "Unknown error";
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return JSON.stringify(error);
}

export function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL required for admin"
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false },
    global: {
      // Next.js 14 caches fetch by default — bypass for admin mutations/reads.
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...(init ?? {}), cache: "no-store" }),
    },
  });
}

export async function adminRpc<T = unknown>(
  fn: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  const sb = adminSupabase();
  const { data, error } = await sb.rpc(fn, args);
  if (error) {
    throw new Error(formatSupabaseError(error));
  }
  return data as T;
}
