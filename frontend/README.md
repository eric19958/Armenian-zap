# Inch Ka — web

Consumer-facing Next.js (App Router) frontend for the Inch Ka price-comparison
platform. Reads the `inch_ka.v_product_comparison` view from Supabase and renders
a grid of comparison cards.

## Stack
Next.js 14 (App Router) · React 18 · Tailwind CSS · @supabase/supabase-js

## Structure
```
frontend/
├── app/
│   ├── layout.tsx        # root layout + metadata
│   ├── page.tsx          # fetches matches, renders the grid
│   └── globals.css
├── components/
│   └── ProductCard.tsx   # cheapest store highlighted + "also available at"
└── lib/
    ├── supabase.ts       # browser/server client (anon, read-only)
    ├── types.ts          # mirrors v_product_comparison
    └── format.ts         # AMD formatting, retailer labels, best-offer pick
```

## Setup
1. `cd frontend && npm install`
2. `cp .env.local.example .env.local` and fill in your Supabase URL + anon key.
3. In Supabase: **Settings → API → Exposed schemas** → add `inch_ka`.
   Then run `migrations/0006_web_grants.sql` (grants `anon` SELECT on the views).
4. `npm run dev` → http://localhost:3000

## Notes
- `app/page.tsx` is a server component with `dynamic = "force-dynamic"`, so every
  visit pulls fresh prices.
- Products with `retailer_count >= 2` are featured under "Compared across stores";
  single-retailer items fall under "More products".
- `ProductCard` highlights the cheapest **in-stock** offer; if everything is out
  of stock it shows the cheapest overall, flagged.
