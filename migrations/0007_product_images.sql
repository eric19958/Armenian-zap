-- ============================================================================
-- Inch Ka · Migration 0007 — product images
-- Ensures image_url exists on offers + products, and exposes a usable image on
-- v_product_comparison (the canonical image, falling back to any offer image).
-- Idempotent.
-- ============================================================================

set search_path = inch_ka, public;

alter table inch_ka.offers   add column if not exists image_url text;
alter table inch_ka.products add column if not exists image_url text;

create or replace view inch_ka.v_product_comparison as
with live as (
  select
    o.product_id,
    r.slug      as retailer_slug,
    r.name      as retailer_name,
    o.price,
    o.in_stock,
    o.product_url,
    o.image_url
  from inch_ka.offers o
  join inch_ka.retailers r on r.id = o.retailer_id
  where o.product_id is not null
)
select
  p.id                                   as product_id,
  p.brand,
  p.canonical_name,
  p.category,
  coalesce(p.image_url, max(l.image_url)) as image_url,   -- canonical, else any offer's
  count(*)                               as offer_count,
  count(distinct l.retailer_slug)        as retailer_count,
  min(l.price) filter (where l.in_stock) as best_price,
  max(l.price)                           as highest_price,
  jsonb_agg(
    jsonb_build_object(
      'retailer', l.retailer_slug,
      'price',    l.price,
      'in_stock', l.in_stock,
      'url',      l.product_url
    ) order by l.price
  )                                      as offers
from inch_ka.products p
join live l on l.product_id = p.id
group by p.id, p.brand, p.canonical_name, p.category, p.image_url;

grant select on inch_ka.v_product_comparison to anon, authenticated;
