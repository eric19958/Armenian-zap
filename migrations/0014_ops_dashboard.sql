-- ============================================================================
-- Inch Ka · Migration 0014 — ops dashboard stats per retailer
-- Idempotent.
-- ============================================================================

create or replace function public.inchka_admin_retailer_stats()
returns table (
  slug              text,
  name              text,
  offer_count       bigint,
  linked_count      bigint,
  unlinked_count    bigint,
  pending_matches   bigint,
  last_scraped_at   timestamptz,
  comparable_count  bigint
)
language sql
security definer
set search_path = inch_ka, public
stable
as $$
  with per_retailer as (
    select
      r.slug,
      r.name,
      count(o.id)                                              as offer_count,
      count(o.id) filter (where o.product_id is not null)      as linked_count,
      count(o.id) filter (where o.product_id is null)          as unlinked_count,
      max(o.scraped_at)                                        as last_scraped_at
    from inch_ka.retailers r
    left join inch_ka.offers o on o.retailer_id = r.id
    group by r.id, r.slug, r.name
  ),
  pending as (
    select o.retailer_id, count(*) as n
    from inch_ka.match_candidates mc
    join inch_ka.offers o on o.id = mc.offer_id
    where mc.status = 'pending'
    group by o.retailer_id
  ),
  comparable as (
    select o.retailer_id, count(distinct o.product_id) as n
    from inch_ka.offers o
    join inch_ka.products p on p.id = o.product_id
    where o.product_id is not null
      and exists (
        select 1 from inch_ka.offers o2
        where o2.product_id = o.product_id and o2.retailer_id <> o.retailer_id
      )
    group by o.retailer_id
  )
  select
    pr.slug,
    pr.name,
    pr.offer_count,
    pr.linked_count,
    pr.unlinked_count,
    coalesce(p.n, 0),
    pr.last_scraped_at,
    coalesce(c.n, 0)
  from per_retailer pr
  left join inch_ka.retailers r on r.slug = pr.slug
  left join pending p on p.retailer_id = r.id
  left join comparable c on c.retailer_id = r.id
  order by pr.offer_count desc, pr.name;
$$;

grant execute on function public.inchka_admin_retailer_stats() to service_role;

create or replace function public.inchka_admin_retailer_urls(p_slug text)
returns setof text
language sql
security definer
set search_path = inch_ka, public
stable
as $$
  select o.product_url
  from inch_ka.offers o
  join inch_ka.retailers r on r.id = o.retailer_id
  where r.slug = p_slug
  limit 3000;
$$;

grant execute on function public.inchka_admin_retailer_urls(text) to service_role;
