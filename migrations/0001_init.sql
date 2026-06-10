-- ============================================================================
-- Inch Ka  ·  Price comparison platform
-- Migration 0001 — initial schema
-- Target: Supabase / PostgreSQL 17
-- Idempotent: safe to run multiple times.
-- ============================================================================

create schema if not exists inch_ka;

-- Use the inch_ka schema for everything below.
set search_path = inch_ka, public;

-- ---------------------------------------------------------------------------
-- updated_at helper (shared by all tables)
-- ---------------------------------------------------------------------------
create or replace function inch_ka.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- retailers — one row per store we track (Zigzag, Vega, ...)
-- ---------------------------------------------------------------------------
create table if not exists inch_ka.retailers (
  id          bigint generated always as identity primary key,
  slug        text not null unique,              -- 'zigzag', 'vega'
  name        text not null,
  base_url    text not null,
  country     text not null default 'AM',
  currency    text not null default 'AMD',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_retailers_updated_at on inch_ka.retailers;
create trigger trg_retailers_updated_at
  before update on inch_ka.retailers
  for each row execute function inch_ka.set_updated_at();

-- ---------------------------------------------------------------------------
-- products — the CANONICAL catalog: one row per real-world product,
-- independent of which retailer sells it. This is what powers comparison.
-- Matching key priority: gtin (EAN/UPC) > (brand, mpn) > fuzzy(brand, name).
-- ---------------------------------------------------------------------------
create table if not exists inch_ka.products (
  id              uuid primary key default gen_random_uuid(),
  gtin            text,                          -- EAN/UPC/barcode, if known
  brand           text,
  mpn             text,                          -- manufacturer part no. / model code (e.g. CL6V6EA)
  canonical_name  text not null,
  category        text,                          -- 'notebook', 'smartphone', ...
  image_url       text,
  attributes      jsonb not null default '{}'::jsonb,  -- cpu, ram, storage, etc.
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- A product is uniquely identified by GTIN when present...
create unique index if not exists uq_products_gtin
  on inch_ka.products (gtin) where gtin is not null;
-- ...otherwise by brand + manufacturer part number.
create unique index if not exists uq_products_brand_mpn
  on inch_ka.products (lower(brand), lower(mpn)) where mpn is not null;
create index if not exists ix_products_brand_name
  on inch_ka.products (lower(brand), lower(canonical_name));
create index if not exists ix_products_category
  on inch_ka.products (category);

drop trigger if exists trg_products_updated_at on inch_ka.products;
create trigger trg_products_updated_at
  before update on inch_ka.products
  for each row execute function inch_ka.set_updated_at();

-- ---------------------------------------------------------------------------
-- offers — the CURRENT state of a product at a retailer (one row each).
-- Upserted on every scrape. (retailer_id, retailer_sku) is the natural key.
-- product_id is nullable so a freshly-scraped offer can land before the
-- canonical matcher links it to a products row.
-- ---------------------------------------------------------------------------
create table if not exists inch_ka.offers (
  id            bigint generated always as identity primary key,
  retailer_id   bigint not null references inch_ka.retailers(id) on delete cascade,
  product_id    uuid references inch_ka.products(id) on delete set null,
  retailer_sku  text not null,                   -- SKU/model as listed by the retailer
  title         text not null,                   -- raw listing title
  product_url   text not null,
  image_url     text,
  price         numeric(12,2) not null,
  old_price     numeric(12,2),                   -- pre-discount price, null if none
  currency      text not null default 'AMD',
  in_stock      boolean not null default true,
  raw           jsonb not null default '{}'::jsonb,  -- full scraped record for audit
  first_seen_at timestamptz not null default now(),
  scraped_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint uq_offers_retailer_sku unique (retailer_id, retailer_sku),
  constraint chk_offers_price_nonneg check (price >= 0)
);

create index if not exists ix_offers_product   on inch_ka.offers (product_id);
create index if not exists ix_offers_retailer  on inch_ka.offers (retailer_id);
create index if not exists ix_offers_in_stock  on inch_ka.offers (in_stock);

drop trigger if exists trg_offers_updated_at on inch_ka.offers;
create trigger trg_offers_updated_at
  before update on inch_ka.offers
  for each row execute function inch_ka.set_updated_at();

-- ---------------------------------------------------------------------------
-- price_history — append-only log of every observed price point.
-- Powers trend charts, drop detection, and alerts.
-- ---------------------------------------------------------------------------
create table if not exists inch_ka.price_history (
  id           bigint generated always as identity primary key,
  offer_id     bigint not null references inch_ka.offers(id) on delete cascade,
  retailer_id  bigint not null references inch_ka.retailers(id) on delete cascade,
  product_id   uuid references inch_ka.products(id) on delete set null,
  price        numeric(12,2) not null,
  old_price    numeric(12,2),
  currency     text not null default 'AMD',
  in_stock     boolean not null default true,
  observed_at  timestamptz not null default now()
);

create index if not exists ix_price_history_offer
  on inch_ka.price_history (offer_id, observed_at desc);
create index if not exists ix_price_history_product
  on inch_ka.price_history (product_id, observed_at desc);

-- ---------------------------------------------------------------------------
-- upsert_offer() — atomic "insert or update offer + log history" helper.
-- The scraper calls this once per product. It only writes a price_history
-- row when the price/stock actually changed (or the offer is new).
-- ---------------------------------------------------------------------------
create or replace function inch_ka.upsert_offer(
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
language plpgsql
as $$
declare
  v_retailer_id bigint;
  v_offer_id    bigint;
  v_prev_price  numeric;
  v_prev_stock  boolean;
begin
  select id into v_retailer_id
  from inch_ka.retailers where slug = p_retailer_slug;
  if v_retailer_id is null then
    raise exception 'Unknown retailer slug: %', p_retailer_slug;
  end if;

  select id, price, in_stock
    into v_offer_id, v_prev_price, v_prev_stock
  from inch_ka.offers
  where retailer_id = v_retailer_id and retailer_sku = p_retailer_sku;

  insert into inch_ka.offers as o (
    retailer_id, retailer_sku, title, product_url, image_url,
    price, old_price, currency, in_stock, raw, scraped_at
  )
  values (
    v_retailer_id, p_retailer_sku, p_title, p_product_url, p_image_url,
    p_price, p_old_price, coalesce(p_currency, 'AMD'), p_in_stock, p_raw, now()
  )
  on conflict (retailer_id, retailer_sku) do update set
    title       = excluded.title,
    product_url = excluded.product_url,
    image_url   = excluded.image_url,
    price       = excluded.price,
    old_price   = excluded.old_price,
    currency    = excluded.currency,
    in_stock    = excluded.in_stock,
    raw         = excluded.raw,
    scraped_at  = now()
  returning o.id into v_offer_id;

  -- Log history only on new offer or a real change.
  if v_prev_price is null
     or v_prev_price is distinct from p_price
     or v_prev_stock is distinct from p_in_stock then
    insert into inch_ka.price_history (
      offer_id, retailer_id, product_id, price, old_price, currency, in_stock
    )
    select v_offer_id, v_retailer_id, o.product_id, p_price, p_old_price,
           coalesce(p_currency, 'AMD'), p_in_stock
    from inch_ka.offers o where o.id = v_offer_id;
  end if;

  return v_offer_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Seed the retailers we target.
-- ---------------------------------------------------------------------------
insert into inch_ka.retailers (slug, name, base_url, country, currency)
values
  ('zigzag', 'Zigzag', 'https://www.zigzag.am', 'AM', 'AMD'),
  ('vega',   'Vega',   'https://vega.am',       'AM', 'AMD')
on conflict (slug) do nothing;
