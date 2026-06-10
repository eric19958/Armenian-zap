# Inch Ka — Codebase Guide for Claude & Figma MCP Integration

## Project Overview

**Inch Ka** (ի՞նչ կա — "what's there?") is an Armenian electronics price-comparison platform.

```
armenian zap/
├── frontend/          # Next.js 14 App Router web app
├── scrapers/          # Python scrapers per retailer
├── matching/          # Product deduplication/matching pipeline
├── pipeline/          # Daily orchestration + email reports
├── migrations/        # SQL migrations (Supabase/PostgreSQL)
└── requirements.txt   # Python deps
```

---

## Frontend Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 14 (App Router, RSC + client components) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v3 (utility-first, no CSS Modules or Styled Components) |
| Font | Inter via `next/font/google` |
| Charts | Recharts |
| Data | Supabase JS client (`@supabase/supabase-js`) |
| Images | `next/image` (fill + object-contain pattern) |
| Icons | Inline SVG only — no icon library |
| Build | Next.js bundler (SWC) |

Path alias: `@/*` → `frontend/*` (configured in `tsconfig.json`).

---

## Design Tokens

There is **no dedicated token file**. All design values live as Tailwind utility classes applied inline. The reference values below are extracted from actual usage.

### Color Palette

```
Background (page):    #f6f7f9   (custom hex, used as bg in PublicShell + sticky bar)
Surface (cards):      white / bg-white
Border:               gray-200  (#e5e7eb)
Border hover:         gray-300  (#d1d5db)

Text primary:         gray-900  (#111827)
Text secondary:       gray-600  (#4b5563)
Text muted:           gray-500  (#6b7280)
Text label/caps:      gray-400  (#9ca3af)

Brand gradient:       from-blue-600 to-emerald-500  (logo only)
CTA / active pill:    gray-900  (buttons, active category chip)
CTA hover:            gray-800

Success / savings:    emerald-500 (#10b981), emerald-600
Warning / preorder:   amber-500  (#f59e0b)
Error:                red-600
Info:                 blue-600   (#2563eb)
```

### Retailer Brand Colors (lib/format.ts)

Used on store badges and Recharts lines:

| Retailer slug | Badge class | Hex |
|---|---|---|
| zigzag | `bg-orange-100 text-orange-700` | `#ea580c` |
| vega | `bg-sky-100 text-sky-700` | `#0284c7` |
| istore | `bg-zinc-200 text-zinc-800` | `#52525b` |
| mobilecentre | `bg-violet-100 text-violet-700` | `#7c3aed` |
| default | `bg-gray-100 text-gray-700` | `#6b7280` |

### Typography Scale

```
hero heading:    text-2xl sm:text-3xl font-extrabold tracking-tight
section heading: text-lg font-bold
card title:      text-sm font-semibold leading-snug
price display:   text-3xl font-black tracking-tight
label / caps:    text-[11px] font-semibold uppercase tracking-wide
badge count:     text-[10px] font-semibold tabular-nums
body:            text-sm
meta / muted:    text-xs / text-[10px]
```

### Spacing & Layout

```
Page max-width:  max-w-7xl (1280px)
Page padding:    px-4 sm:px-6 lg:px-8
Section gap:     py-8
Card grid:       grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4
Card padding:    p-4
```

### Border Radius Conventions

```
rounded-2xl  → main cards, modals, image containers, search box wrapper
rounded-xl   → CTAs, inputs, secondary buttons, stat boxes
rounded-lg   → small utility buttons, list items
rounded-full → badges, category chips, savings %, store count indicator
```

### Shadows

```
shadow-sm   → cards, stat boxes, buttons
shadow-md   → card hover state
shadow-xl   → modals
```

---

## Component Library

All components live flat in `frontend/components/`. No Storybook.

### Layout Components

**`PublicShell`** — wraps every public page.
```tsx
// Usage
<PublicShell>
  <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">…</main>
</PublicShell>
// Renders: bg-[#f6f7f9] flex-col min-h-screen with SiteHeader + SiteFooter
```

**`AdminShell`** — wraps admin pages (same pattern, passes `admin` prop to SiteHeader).

**`SiteHeader`** — sticky top nav (`z-30`, `backdrop-blur-md`). Accepts `admin?: boolean`.

**`SiteFooter`** — minimal footer with tagline and currency note.

### Feature Components

**`ProductExplorer`** (`"use client"`) — orchestrates search + filter + grid.
- State: `query` (string), `category` (string key)
- Uses `useDeferredValue` for search debounce
- Splits results into "Best to compare" (retailer_count ≥ 2) and "More products" sections
- Lazy-loads "More products" in pages of 60

**`ProductCard`** — self-contained card with image, price bar, retailer badges, and CTA button.
- Image: `next/image` with `fill` + `object-contain p-5`; fallback `ImagePlaceholder` renders brand initial
- Savings badge shown when cheapest offer is ≥5% below most expensive
- Price range bar: `bg-gradient-to-r from-emerald-400 via-blue-200 to-gray-200`

**`SearchBar`** (`"use client"`) — controlled input with inline SVG search icon. No external icon dependency.

**`CategoryBar`** (`"use client"`) — horizontally scrollable pill tabs. Groups categories via `CATEGORY_GROUPS` from `lib/categories.ts`. Active pill: `bg-gray-900 text-white`.

**`CategoryFilter`** — older pill variant using `bg-blue-600` for active state. Superseded by `CategoryBar` but still exported.

**`PriceHistoryChart`** (`"use client"`) — Recharts `LineChart` in a `ResponsiveContainer`. Pivots tidy (retailer, date, price) rows into one row per day. Uses `retailerColor()` for line strokes.

**`AdminPanel`** (`"use client"`) — full admin dashboard: login gate, tabs (ops / review queue / unlinked), match approve/reject, offer linking, product editing modal. Lazy-loads `OpsDashboard`.

**`OpsDashboard`** — scrape ops view, loaded via `next/dynamic` (ssr: false).

---

## Shared Logic (`frontend/lib/`)

```
lib/
  types.ts        # TypeScript interfaces: RetailerOffer, ComparisonProduct, PriceHistoryPoint
  format.ts       # formatAMD, formatAMDShort, retailerLabel, retailerBadgeClass,
                  # retailerColor, highResImage, hiResImage, pickBestOffer,
                  # categoryKey, categoryLabel, matchesQuery
  categories.ts   # CATEGORY_ORDER[], CATEGORY_GROUPS[], categorySortIndex()
  supabase.ts     # createClient singleton
  admin-api.ts    # adminFetch() helper (JSON + auth cookie)
  admin-auth.ts   # Server-side cookie verification
  admin-server.ts # Server actions for admin queries
  ops-coverage.ts # Scrape job coverage helpers
```

### Key Formatting Functions

```ts
formatAMD(value)       // "340,000 ֏"
formatAMDShort(value)  // "340k ֏" or "2.0M ֏" (for chart axes)
retailerLabel(slug)    // "zigzag" → "Zigzag", "yerevanmobile" → "Yerevan Mobile"
retailerBadgeClass(slug) // Tailwind classes for badge coloring
retailerColor(slug)    // hex string for Recharts strokes
pickBestOffer(offers)  // cheapest in-stock; falls back to cheapest overall
highResImage(url)      // upgrades Vega/MobileCentre thumbnail URLs to larger variants
matchesQuery(product, query) // AND-match across all whitespace-separated terms
```

---

## Styling Approach

- **Tailwind CSS v3**, utility-first, no abstractions (no `@apply` except `text-gray-900 antialiased` in globals).
- **No CSS Modules, no Styled Components, no CSS-in-JS.**
- Global styles (`app/globals.css`): just the three `@tailwind` directives, `color-scheme: light`, and a `.line-clamp-2` helper class.
- Responsive via Tailwind prefixes: `sm:`, `md:`, `lg:`, `xl:`.
- Dark mode: **not implemented** — `color-scheme: light` is explicit.

---

## Asset & Image Management

- **Product images**: served from Supabase Storage (`*.supabase.co`) or retailer CDNs (`*.am`).
- **`next/image`**: always use `fill` layout with a sized parent container; set `sizes` prop for responsive hints.
- **No local image assets** in the repo — all product images are remote.
- **CDN URL rewriting**: `highResImage()` / `hiResImage()` in `lib/format.ts` upgrades thumbnail URLs for PDPs.
- `next.config.mjs` whitelists `*.supabase.co` and `**.am` hostnames.

---

## Icon System

- **No icon library** (no Heroicons, Lucide, etc.).
- Icons are **inline SVG** embedded directly in JSX.
- Currently only one icon in use: a search magnifier in `SearchBar.tsx`.
- When adding icons from Figma, use inline SVG with `aria-hidden` and `currentColor` stroke/fill.

---

## Routing (App Router)

```
app/
  layout.tsx          # Root layout — Inter font, metadata
  page.tsx            # / — server component, fetches all products, renders ProductExplorer
  globals.css
  product/[id]/       # Product detail page (PDP) — not shown above but referenced
  admin/              # Admin section
  api/admin/          # API routes for admin actions
```

- Root page is a **React Server Component** with `revalidate = 300` (5-min ISR).
- Client components are marked `"use client"` at the top of the file.

---

## Figma MCP Integration Rules

When implementing designs from Figma into this codebase:

1. **Use Tailwind utility classes only** — do not introduce CSS Modules, inline `style` props for anything Tailwind can express, or new global CSS rules.

2. **Match the token values** — map Figma color styles to the nearest Tailwind gray/emerald/blue/amber value from the palette above. Custom hex values are only acceptable for `bg-[#f6f7f9]` (page bg) which is already established.

3. **Card pattern** — new card-like containers should follow: `rounded-2xl border border-gray-200 bg-white shadow-sm` with hover state `hover:border-gray-300 hover:shadow-md`.

4. **Button primary pattern** — `rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800`.

5. **Button secondary pattern** — `rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50`.

6. **Icons from Figma** — export as inline SVG, use `currentColor`, add `aria-hidden` if decorative.

7. **Images** — always use `next/image` with `fill` + a sized parent. Never use `<img>` for product images.

8. **Typography** — do not introduce new font families. Inter is the only font. Match Figma text sizes to the nearest Tailwind text-* class.

9. **Responsive** — use the standard Tailwind breakpoint ladder (`sm:` 640px, `md:` 768px, `lg:` 1024px, `xl:` 1280px). Max content width is `max-w-7xl`.

10. **Component placement** — new components go in `frontend/components/`. New shared helpers go in `frontend/lib/`. Do not create nested subdirectories unless the feature is substantial.

11. **No Storybook** — components are not documented separately; the app itself is the reference.

12. **Client vs Server** — prefer Server Components (no `"use client"`) unless the component requires state, effects, or browser APIs. Keep client components at the leaf level.
