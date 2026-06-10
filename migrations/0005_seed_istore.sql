-- ============================================================================
-- Inch Ka · Migration 0005 — add iStore.am as a tracked retailer
-- iStore is Apple's authorised reseller in Armenia. Idempotent.
-- ============================================================================

insert into inch_ka.retailers (slug, name, base_url, country, currency)
values ('istore', 'iStore', 'https://istore.am', 'AM', 'AMD')
on conflict (slug) do nothing;
