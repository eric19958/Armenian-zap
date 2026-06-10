-- ============================================================================
-- Inch Ka · Migration 0011 — public RPC wrappers for the scraper
--
-- Supabase REST only talks to exposed schemas (usually public). These wrappers
-- delegate to inch_ka so scrapers work without exposing the whole inch_ka schema.
-- Also add inch_ka to Dashboard → Settings → API → Exposed schemas for the
-- matcher and the Next.js app.
-- Idempotent.
-- ============================================================================

create or replace function public.inchka_ensure_retailer(
  p_slug      text,
  p_name      text,
  p_base_url  text,
  p_currency  text default 'AMD'
)
returns void
language plpgsql
security definer
set search_path = inch_ka, public
as $$
begin
  insert into inch_ka.retailers (slug, name, base_url, country, currency)
  values (p_slug, p_name, p_base_url, 'AM', p_currency)
  on conflict (slug) do update set
    name     = excluded.name,
    base_url = excluded.base_url;
end;
$$;

create or replace function public.inchka_upsert_offer(
  p_retailer_slug text,
  p_retailer_sku  text,
  p_title         text,
  p_product_url   text,
  p_image_url     text,
  p_price         numeric,
  p_old_price     numeric,
  p_currency      text,
  p_in_stock      boolean,
  p_raw           jsonb default '{}'::jsonb
)
returns bigint
language sql
security definer
set search_path = inch_ka, public
as $$
  select inch_ka.upsert_offer(
    p_retailer_slug, p_retailer_sku, p_title, p_product_url, p_image_url,
    p_price, p_old_price, p_currency, p_in_stock, p_raw
  );
$$;

grant execute on function public.inchka_ensure_retailer(text, text, text, text)
  to service_role;
grant execute on function public.inchka_upsert_offer(
  text, text, text, text, text, numeric, numeric, text, boolean, jsonb
) to service_role;
