// Inch Ka · Supabase client (read-only, public anon key).
// The app reads the inch_ka.v_product_comparison view.
//
// Supabase setup required once:
//   1. Settings → API → "Exposed schemas": add `inch_ka`.
//   2. grant usage on schema inch_ka to anon;
//      grant select on inch_ka.v_product_comparison to anon;

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Surfaced at runtime so misconfiguration is obvious during dev.
  console.warn(
    "[inch_ka] Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

export const supabase = createClient(url ?? "", anonKey ?? "", {
  auth: { persistSession: false },
});
