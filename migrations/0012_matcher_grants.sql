-- ============================================================================
-- Inch Ka · Migration 0012 — public RPC wrappers for the canonical matcher
-- Same pattern as 0011: matcher talks to public.*, not inch_ka schema directly.
-- Idempotent.
-- ============================================================================

create or replace function public.inchka_unlinked_offers()
returns table (
  id            bigint,
  title         text,
  retailer_sku  text,
  product_url   text,
  image_url     text,
  raw           jsonb,
  product_id    uuid
)
language sql
security definer
set search_path = inch_ka, public
stable
as $$
  select o.id, o.title, o.retailer_sku, o.product_url, o.image_url, o.raw, o.product_id
  from inch_ka.offers o
  where o.product_id is null
  order by o.id;
$$;

create or replace function public.inchka_products_catalog()
returns table (
  id              uuid,
  brand           text,
  mpn             text,
  gtin            text,
  canonical_name  text,
  category        text,
  attributes      jsonb
)
language sql
security definer
set search_path = inch_ka, public
stable
as $$
  select p.id, p.brand, p.mpn, p.gtin, p.canonical_name, p.category, p.attributes
  from inch_ka.products p
  order by p.created_at;
$$;

create or replace function public.inchka_create_product(
  p_brand          text,
  p_mpn            text,
  p_canonical_name text,
  p_category       text,
  p_attributes     jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = inch_ka, public
as $$
declare
  v_id uuid;
begin
  insert into inch_ka.products (brand, mpn, canonical_name, category, attributes)
  values (p_brand, p_mpn, p_canonical_name, p_category, coalesce(p_attributes, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.inchka_link_offer(
  p_offer_id   bigint,
  p_product_id uuid
)
returns void
language sql
security definer
set search_path = inch_ka, public
as $$
  update inch_ka.offers
  set product_id = p_product_id
  where id = p_offer_id;
$$;

create or replace function public.inchka_queue_match_candidate(
  p_offer_id   bigint,
  p_product_id uuid,
  p_score      numeric,
  p_method     text,
  p_rationale  jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = inch_ka, public
as $$
  insert into inch_ka.match_candidates (
    offer_id, product_id, score, method, rationale, status
  )
  values (p_offer_id, p_product_id, p_score, p_method, coalesce(p_rationale, '{}'::jsonb), 'pending')
  on conflict (offer_id, product_id) do update set
    score     = excluded.score,
    method    = excluded.method,
    rationale = excluded.rationale,
    status    = 'pending';
$$;

grant execute on function public.inchka_unlinked_offers() to service_role;
grant execute on function public.inchka_products_catalog() to service_role;
grant execute on function public.inchka_create_product(text, text, text, text, jsonb) to service_role;
grant execute on function public.inchka_link_offer(bigint, uuid) to service_role;
grant execute on function public.inchka_queue_match_candidate(bigint, uuid, numeric, text, jsonb) to service_role;
