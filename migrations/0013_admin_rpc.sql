-- ============================================================================
-- Inch Ka · Migration 0013 — admin dashboard RPCs (service_role only)
-- Used by /admin in the Next.js app via server-side API routes.
-- Idempotent.
-- ============================================================================

create or replace function public.inchka_admin_stats()
returns jsonb
language sql
security definer
set search_path = inch_ka, public
stable
as $$
  select jsonb_build_object(
    'products',        (select count(*)::int from inch_ka.products),
    'offers',          (select count(*)::int from inch_ka.offers),
    'linked_offers',   (select count(*)::int from inch_ka.offers where product_id is not null),
    'unlinked_offers', (select count(*)::int from inch_ka.offers where product_id is null),
    'pending_matches', (select count(*)::int from inch_ka.match_candidates where status = 'pending'),
    'retailers',       (select count(*)::int from inch_ka.retailers)
  );
$$;

create or replace function public.inchka_admin_pending_matches()
returns table (
  id              bigint,
  score           numeric,
  method          text,
  rationale       jsonb,
  created_at      timestamptz,
  offer_id        bigint,
  offer_title     text,
  offer_sku       text,
  offer_price     numeric,
  offer_url       text,
  offer_image     text,
  retailer_slug   text,
  retailer_name   text,
  product_id      uuid,
  product_name    text,
  product_brand   text,
  product_mpn     text
)
language sql
security definer
set search_path = inch_ka, public
stable
as $$
  select
    mc.id,
    mc.score,
    mc.method,
    mc.rationale,
    mc.created_at,
    o.id,
    o.title,
    o.retailer_sku,
    o.price,
    o.product_url,
    o.image_url,
    r.slug,
    r.name,
    p.id,
    p.canonical_name,
    p.brand,
    p.mpn
  from inch_ka.match_candidates mc
  join inch_ka.offers o on o.id = mc.offer_id
  join inch_ka.retailers r on r.id = o.retailer_id
  join inch_ka.products p on p.id = mc.product_id
  where mc.status = 'pending'
  order by mc.score desc, mc.created_at;
$$;

create or replace function public.inchka_admin_unlinked_offers(p_limit int default 50)
returns table (
  id            bigint,
  title         text,
  retailer_sku  text,
  price         numeric,
  currency      text,
  product_url   text,
  image_url     text,
  retailer_slug text,
  retailer_name text,
  scraped_at    timestamptz
)
language sql
security definer
set search_path = inch_ka, public
stable
as $$
  select
    o.id, o.title, o.retailer_sku, o.price, o.currency,
    o.product_url, o.image_url, r.slug, r.name, o.scraped_at
  from inch_ka.offers o
  join inch_ka.retailers r on r.id = o.retailer_id
  where o.product_id is null
  order by o.scraped_at desc
  limit greatest(1, least(p_limit, 200));
$$;

create or replace function public.inchka_admin_search_products(
  p_q     text,
  p_limit int default 20
)
returns table (
  id              uuid,
  brand           text,
  mpn             text,
  canonical_name  text,
  category        text
)
language sql
security definer
set search_path = inch_ka, public
stable
as $$
  select p.id, p.brand, p.mpn, p.canonical_name, p.category
  from inch_ka.products p
  where p_q is null or trim(p_q) = ''
     or lower(p.canonical_name) like '%' || lower(trim(p_q)) || '%'
     or lower(coalesce(p.brand, '')) like '%' || lower(trim(p_q)) || '%'
     or lower(coalesce(p.mpn, '')) like '%' || lower(trim(p_q)) || '%'
  order by p.canonical_name
  limit greatest(1, least(p_limit, 50));
$$;

create or replace function public.inchka_admin_approve_match(p_candidate_id bigint)
returns void
language sql
security definer
set search_path = inch_ka, public
as $$
  select inch_ka.approve_match_candidate(p_candidate_id);
$$;

create or replace function public.inchka_admin_reject_match(p_candidate_id bigint)
returns void
language sql
security definer
set search_path = inch_ka, public
as $$
  select inch_ka.reject_match_candidate(p_candidate_id);
$$;

create or replace function public.inchka_admin_update_product(
  p_product_id      uuid,
  p_canonical_name  text,
  p_brand           text,
  p_category        text
)
returns void
language sql
security definer
set search_path = inch_ka, public
as $$
  update inch_ka.products
  set
    canonical_name = coalesce(nullif(trim(p_canonical_name), ''), canonical_name),
    brand          = nullif(trim(p_brand), ''),
    category       = nullif(trim(p_category), '')
  where id = p_product_id;
$$;

grant execute on function public.inchka_admin_stats() to service_role;
grant execute on function public.inchka_admin_pending_matches() to service_role;
grant execute on function public.inchka_admin_unlinked_offers(int) to service_role;
grant execute on function public.inchka_admin_search_products(text, int) to service_role;
grant execute on function public.inchka_admin_approve_match(bigint) to service_role;
grant execute on function public.inchka_admin_reject_match(bigint) to service_role;
grant execute on function public.inchka_admin_update_product(uuid, text, text, text) to service_role;
