# Inch Ka — scraping engine

Price-comparison platform for the Armenian electronics market (Zigzag, Vega, …).
*Inch ka?* — "What is available?"

## Layout

```
inch_ka/
├── migrations/
│   └── 0001_init.sql        # retailers, products, offers, price_history (+ upsert_offer)
├── scrapers/
│   └── zigzag/
│       └── scraper.py       # Firecrawl extract -> normalize -> Supabase upsert
├── requirements.txt
└── .env.example
```

## Data flow

```
Zigzag category page
   → Firecrawl (LLM JSON extraction)
   → normalize() → canonical offer schema
   → inch_ka.upsert_offer() RPC
      → offers (current state, upsert)
      → price_history (append on change)
   → [later] canonical matcher links offers.product_id → products
```

## Setup

1. **Create the Supabase project** named `inch_ka` (the Composio connector can
   manage tables/SQL but cannot create the project itself).
2. Apply the schema: run `migrations/0001_init.sql` in the Supabase SQL editor,
   or have it applied via the Composio `SUPABASE_APPLY_A_MIGRATION` tool.
   Also run `migrations/0010_seed_all_retailers.sql`,
   `migrations/0011_scraper_grants.sql`, and `migrations/0012_matcher_grants.sql`.
   Direct Postgres (`DATABASE_URL`) often fails on Mac without IPv6 — the scraper
   uses the Supabase API by default.
3. `pip install -r requirements.txt`
4. `cp .env.example .env` and fill in the keys.
5. Test one page: `python scrapers/inchka.py probe --url "https://www.zigzag.am/en/phones-and-communication.html"`
6. Scrape + match: `python scrapers/inchka.py scrape zigzag --match`

## Unified scraper CLI (`inchka.py`)

```bash
# Any category URL — auto-detects the store, paginates, saves offers:
python scrapers/inchka.py scrape --url "https://vega.am/en/.../smart-phones/" --match

# One configured retailer (all categories in retailers_config.py):
python scrapers/inchka.py scrape allsell --match

# Every retailer:
python scrapers/inchka.py scrape --all --match

# Link scraped offers to canonical products (MPN / fuzzy matching):
python scrapers/inchka.py match
```

## Notes

- `retailer_sku` is the model code (e.g. `CL6V6EA`), taken from the listing or
  parsed from the URL slug — it's the stable upsert key per retailer.
- `products` (canonical) starts empty; offers land first, then a matcher links
  them by GTIN / brand+MPN / fuzzy title. That matcher is the next module.
- Be a good citizen: throttle runs, respect robots.txt, and check Zigzag/Vega
  terms before scaling up.
