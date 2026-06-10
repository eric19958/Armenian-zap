-- ============================================================================
-- Inch Ka · Migration 0010 — seed every retailer in retailers_config.py
-- Without these rows upsert_offer() raises "Unknown retailer slug".
-- Idempotent.
-- ============================================================================

insert into inch_ka.retailers (slug, name, base_url, country, currency)
values
  ('allsell',       'AllSell',        'https://allsell.am',              'AM', 'AMD'),
  ('yerevanmobile', 'Yerevan Mobile', 'https://www.yerevanmobile.am',    'AM', 'AMD'),
  ('vega',          'Vega',           'https://vega.am',                 'AM', 'AMD'),
  ('eldorado',      'Eldorado',       'https://eldorado.am',             'AM', 'AMD'),
  ('redstore',      'RedStore',       'https://redstore.am',             'AM', 'AMD'),
  ('mobilecentre',  'Mobile Centre',  'https://www.mobilecentre.am',     'AM', 'AMD'),
  ('zigzag',        'Zigzag',         'https://www.zigzag.am',           'AM', 'AMD'),
  ('istore',        'iStore',         'https://istore.am',               'AM', 'AMD'),
  ('ispace',        'iSpace',         'https://ispace.am',               'AM', 'AMD')
on conflict (slug) do update set
  name     = excluded.name,
  base_url = excluded.base_url;
