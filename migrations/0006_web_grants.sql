-- ============================================================================
-- Inch Ka · Migration 0006 — read-only grants for the public web app
-- Lets the Supabase `anon` role read the comparison + price-drop views.
-- (You must ALSO add `inch_ka` to Settings → API → Exposed schemas.)
-- Idempotent.
-- ============================================================================

grant usage on schema inch_ka to anon, authenticated;
grant select on inch_ka.v_product_comparison to anon, authenticated;
grant select on inch_ka.v_price_drops       to anon, authenticated;
