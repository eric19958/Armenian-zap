-- ============================================================================
-- Inch Ka · Migration 0002 — canonical matcher support
-- Adds: match_candidates review queue, approve/reject RPCs,
--       and a side-by-side price comparison view.
-- Idempotent. Target: Supabase / PostgreSQL 17.
-- ============================================================================

set search_path = inch_ka, public;

-- ---------------------------------------------------------------------------
-- match_candidates — medium-confidence offer↔product pairs awaiting review.
-- High-confidence links are written straight to offers.product_id by the
-- matcher; only the uncertain ones land here.
-- ---------------------------------------------------------------------------
create table if not exists inch_ka.match_candidates (
  id            bigint generated always as identity primary key,
  offer_id      bigint not null references inch_ka.offers(id)   on delete cascade,
  product_id    uuid   not null references inch_ka.products(id) on delete cascade,
  score         numeric(5,2) not null,                 -- 0–100 similarity
  method        text not null,                         -- 'mpn' | 'gtin' | 'fuzzy'
  rationale     jsonb not null default '{}'::jsonb,    -- which signals fired
  status        text not null default 'pending',       -- pending|approved|rejected
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz,
  constraint uq_match_candidate unique (offer_id, product_id),
  constraint chk_mc_status check (status in ('pending','approved','rejected')),
  constraint chk_mc_score  check (score >= 0 and score <= 100)
);

create index if not exists ix_mc_status on inch_ka.match_candidates (status);
create index if not exists ix_mc_offer  on inch_ka.match_candidates (offer_id);

-- ---------------------------------------------------------------------------
-- approve_match_candidate() — link the offer to the product, close the row,
-- and reject any other pending candidates for the same offer.
-- ---------------------------------------------------------------------------
create or replace function inch_ka.approve_match_candidate(p_candidate_id bigint)
returns void
language plpgsql
as $$
declare
  v_offer_id   bigint;
  v_product_id uuid;
begin
  select offer_id, product_id into v_offer_id, v_product_id
  from inch_ka.match_candidates where id = p_candidate_id;
  if v_offer_id is null then
    raise exception 'No match_candidate with id %', p_candidate_id;
  end if;

  update inch_ka.offers set product_id = v_product_id where id = v_offer_id;

  update inch_ka.match_candidates
    set status = 'approved', reviewed_at = now()
    where id = p_candidate_id;

  -- Drop competing suggestions for this offer.
  update inch_ka.match_candidates
    set status = 'rejected', reviewed_at = now()
    where offer_id = v_offer_id and id <> p_candidate_id and status = 'pending';
end;
$$;

create or replace function inch_ka.reject_match_candidate(p_candidate_id bigint)
returns void
language plpgsql
as $$
begin
  update inch_ka.match_candidates
    set status = 'rejected', reviewed_at = now()
    where id = p_candidate_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- v_product_comparison — the platform's headline view: one row per canonical
-- product with the cheapest current in-stock offer and the per-retailer
-- breakdown. This is what the front end queries.
-- ---------------------------------------------------------------------------
create or replace view inch_ka.v_product_comparison as
with live as (
  select
    o.product_id,
    r.slug      as retailer_slug,
    r.name      as retailer_name,
    o.price,
    o.in_stock,
    o.product_url
  from inch_ka.offers o
  join inch_ka.retailers r on r.id = o.retailer_id
  where o.product_id is not null
)
select
  p.id                              as product_id,
  p.brand,
  p.canonical_name,
  p.category,
  p.image_url,
  count(*)                          as offer_count,
  count(distinct l.retailer_slug)   as retailer_count,
  min(l.price) filter (where l.in_stock) as best_price,
  max(l.price)                      as highest_price,
  jsonb_agg(
    jsonb_build_object(
      'retailer', l.retailer_slug,
      'price',    l.price,
      'in_stock', l.in_stock,
      'url',      l.product_url
    ) order by l.price
  )                                 as offers
from inch_ka.products p
join live l on l.product_id = p.id
group by p.id, p.brand, p.canonical_name, p.category, p.image_url;
