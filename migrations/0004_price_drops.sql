-- ============================================================================
-- Inch Ka · Migration 0004 — daily price-drop view
-- v_price_drops compares each offer's CURRENT price to the most recent price
-- recorded BEFORE today. Powers the daily Gmail digest.
-- Idempotent. Target: Supabase / PostgreSQL 17.
-- ============================================================================

set search_path = inch_ka, public;

create or replace view inch_ka.v_price_drops as
with cur as (
  -- newest recorded price per offer
  select distinct on (offer_id) offer_id, price as cur_price, in_stock, observed_at
  from inch_ka.price_history
  order by offer_id, observed_at desc
),
prev as (
  -- newest recorded price per offer BEFORE the start of today
  select distinct on (offer_id) offer_id, price as prev_price
  from inch_ka.price_history
  where observed_at < date_trunc('day', now())
  order by offer_id, observed_at desc
)
select
  o.product_id,
  p.canonical_name,
  p.brand,
  r.slug  as retailer_slug,
  r.name  as retailer_name,
  prev.prev_price,
  cur.cur_price,
  round((prev.prev_price - cur.cur_price) / prev.prev_price * 100, 1) as drop_pct,
  cur.in_stock,
  o.product_url,
  cur.observed_at
from cur
join prev using (offer_id)
join inch_ka.offers o    on o.id = cur.offer_id
join inch_ka.products p  on p.id = o.product_id
join inch_ka.retailers r on r.id = o.retailer_id
where prev.prev_price > cur.cur_price
order by drop_pct desc;
