-- ============================================================================
-- Inch Ka · Migration 0009 — price-history view for the PDP chart
--   1. Backfill price_history.product_id (early rows were logged pre-match).
--   2. Create v_price_history (granted to anon) for per-retailer time series.
--   3. Seed a few days of SHOWCASE history for the demo products so the chart
--      has real lines on day one. Daily runs accrue genuine history over this.
-- Idempotent enough to re-run.
-- ============================================================================

set search_path = inch_ka, public;

-- 1. Backfill product_id on historical rows from their offer.
update inch_ka.price_history ph
set product_id = o.product_id
from inch_ka.offers o
where ph.offer_id = o.id and ph.product_id is null and o.product_id is not null;

-- 2. View: one tidy row per (product, retailer, timestamp).
create or replace view inch_ka.v_price_history as
select
  ph.product_id,
  r.slug as retailer_slug,
  r.name as retailer_name,
  ph.price,
  ph.in_stock,
  ph.observed_at
from inch_ka.price_history ph
join inch_ka.retailers r on r.id = ph.retailer_id
where ph.product_id is not null;

grant select on inch_ka.v_price_history to anon, authenticated;

-- 3. Showcase demo history (multi-day, declining) for the two hero products.
with showcase(slug, sku, days_ago, price) as (
  values
    -- MacBook Pro 16 M5 Max (3-way match)
    ('istore','MGED4RUA', 6, 1899900), ('istore','MGED4RUA', 5, 1879900),
    ('istore','MGED4RUA', 4, 1859900), ('istore','MGED4RUA', 2, 1849900),
    ('zigzag','MGED4',     6, 2049900), ('zigzag','MGED4',     4, 2029900),
    ('zigzag','MGED4',     2, 1999900),
    ('vega','MGED4RUA',    5, 1999900), ('vega','MGED4RUA',    2, 1994900),
    -- HP Laptop 15 U5-125H (CW0P6EA, 2-way)
    ('zigzag','CW0P6EA',   6, 359000),  ('zigzag','CW0P6EA',   3, 345000),
    ('vega','CW0P6EA',     5, 349900),  ('vega','CW0P6EA',     2, 344900)
)
insert into inch_ka.price_history (offer_id, retailer_id, product_id, price, currency, in_stock, observed_at)
select o.id, o.retailer_id, o.product_id, s.price, 'AMD', true,
       date_trunc('day', now()) - (s.days_ago || ' days')::interval
from showcase s
join inch_ka.retailers r on r.slug = s.slug
join inch_ka.offers o on o.retailer_id = r.id and o.retailer_sku = s.sku;
