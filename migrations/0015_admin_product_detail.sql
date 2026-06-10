-- ============================================================================
-- Inch Ka · Migration 0015 — product detail for admin review queue
-- Idempotent.
-- ============================================================================

create or replace function public.inchka_admin_product_detail(p_product_id uuid)
returns jsonb
language sql
security definer
set search_path = inch_ka, public
stable
as $$
  select jsonb_build_object(
    'product_id', p.id,
    'brand', p.brand,
    'canonical_name', p.canonical_name,
    'mpn', p.mpn,
    'category', p.category,
    'image_url', coalesce(
      p.image_url,
      (
        select o.image_url
        from inch_ka.offers o
        where o.product_id = p.id and o.image_url is not null
        limit 1
      )
    ),
    'offers', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'offer_id', o.id,
            'title', o.title,
            'retailer_slug', r.slug,
            'retailer_name', r.name,
            'price', o.price,
            'product_url', o.product_url,
            'image_url', o.image_url,
            'in_stock', o.in_stock
          )
          order by o.price
        )
        from inch_ka.offers o
        join inch_ka.retailers r on r.id = o.retailer_id
        where o.product_id = p.id
      ),
      '[]'::jsonb
    )
  )
  from inch_ka.products p
  where p.id = p_product_id;
$$;

grant execute on function public.inchka_admin_product_detail(uuid) to service_role;

-- Include catalog product image in review queue rows.
drop function if exists public.inchka_admin_pending_matches();

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
  product_mpn     text,
  product_image   text
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
    p.mpn,
    coalesce(
      p.image_url,
      (
        select o2.image_url
        from inch_ka.offers o2
        where o2.product_id = p.id and o2.image_url is not null
        limit 1
      )
    )
  from inch_ka.match_candidates mc
  join inch_ka.offers o on o.id = mc.offer_id
  join inch_ka.retailers r on r.id = o.retailer_id
  join inch_ka.products p on p.id = mc.product_id
  where mc.status = 'pending'
  order by mc.score desc, mc.created_at;
$$;

grant execute on function public.inchka_admin_pending_matches() to service_role;
