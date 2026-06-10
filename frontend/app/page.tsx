import ProductCard from "@/components/ProductCard";
import ProductExplorer from "@/components/ProductExplorer";
import PublicShell from "@/components/PublicShell";
import StoreTrustBar from "@/components/StoreTrustBar";
import { supabase } from "@/lib/supabase";
import type { ComparisonProduct, RetailerOffer } from "@/lib/types";

export const revalidate = 300;

async function getProducts(): Promise<{
  products: ComparisonProduct[];
  error: string | null;
}> {
  const PAGE = 1000;
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("v_product_comparison")
      .select("*")
      .order("retailer_count", { ascending: false })
      .order("best_price", { ascending: true, nullsFirst: false })
      .range(from, from + PAGE - 1);

    if (error) return { products: [], error: error.message };

    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }

  const products: ComparisonProduct[] = rows.map((row: any) => ({
    product_id: row.product_id,
    brand: row.brand,
    canonical_name: row.canonical_name,
    category: row.category,
    image_url: row.image_url,
    offer_count: Number(row.offer_count),
    retailer_count: Number(row.retailer_count),
    best_price: row.best_price === null ? null : Number(row.best_price),
    highest_price: row.highest_price === null ? null : Number(row.highest_price),
    offers: (row.offers ?? []).map(
      (o: any): RetailerOffer => ({
        retailer: o.retailer,
        price: Number(o.price),
        in_stock: Boolean(o.in_stock),
        url: o.url,
      })
    ),
  }));

  return { products, error: null };
}

export default async function HomePage() {
  const { products, error } = await getProducts();

  const storeCount = new Set(
    products.flatMap((p) => (p.offers ?? []).map((o) => o.retailer))
  ).size;
  const compared = products.filter((p) => p.retailer_count >= 2).length;

  const topDeals = products
    .filter((p) => {
      if (p.retailer_count < 2 || !p.best_price || !p.highest_price) return false;
      if (p.best_price >= p.highest_price) return false;
      return Math.round((1 - p.best_price / p.highest_price) * 100) >= 5;
    })
    .sort((a, b) => {
      const pA = 1 - a.best_price! / a.highest_price!;
      const pB = 1 - b.best_price! / b.highest_price!;
      return pB - pA;
    })
    .slice(0, 4);

  return (
    <PublicShell overlayHeader>
      {/* ══════════════ HERO ══════════════ */}
      <div className="relative overflow-hidden bg-gradient-to-br from-violet-950 via-[#1a0e3d] to-indigo-950">
        {/* Dot grid texture */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "36px 36px",
          }}
          aria-hidden
        />

        {/* Ambient glow blobs */}
        <div
          className="absolute -left-40 top-0 h-[700px] w-[700px] rounded-full bg-violet-700 opacity-[0.18] blur-[130px]"
          aria-hidden
        />
        <div
          className="absolute -right-40 bottom-0 h-[500px] w-[500px] rounded-full bg-indigo-600 opacity-[0.14] blur-[110px]"
          aria-hidden
        />
        <div
          className="absolute left-1/2 top-1/4 h-40 w-40 -translate-x-1/2 rounded-full bg-cyan-400 opacity-[0.06] blur-[50px]"
          aria-hidden
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 py-16 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:py-28">

            {/* ── Left: headline ── */}
            <div className="text-center lg:text-left">
              {/* Live chip */}
              {!error && storeCount > 0 && (
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[11px] font-bold tracking-wide text-white/60 backdrop-blur-sm">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live from {storeCount} Armenian stores
                </div>
              )}

              <h1 className="text-5xl font-black tracking-tighter text-white sm:text-6xl lg:text-[70px] lg:leading-[1.0]">
                Find the{" "}
                <br className="hidden sm:block" />
                <span className="text-gradient-hero">best price</span>
                <br />
                in Armenia
              </h1>

              <p className="mx-auto mt-6 max-w-md text-base text-white/50 sm:text-lg lg:mx-0">
                Phones, laptops, TVs, air conditioners — compare every
                Armenian store and never overpay again.
              </p>

              {/* Stats */}
              {!error && products.length > 0 && (
                <div className="mx-auto mt-10 flex max-w-sm flex-wrap justify-center gap-x-10 gap-y-6 lg:mx-0 lg:justify-start">
                  {[
                    { value: products.length.toLocaleString(), label: "Products" },
                    { value: compared.toLocaleString(), label: "Multi-store deals" },
                    { value: String(storeCount), label: "Stores" },
                  ].map((s) => (
                    <div key={s.label} className="flex flex-col">
                      <span className="text-4xl font-black tabular-nums text-white sm:text-5xl">
                        {s.value}
                      </span>
                      <span className="mt-1 text-[11px] font-bold uppercase tracking-widest text-white/35">
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* CTA */}
              <div className="mx-auto mt-10 flex max-w-xs justify-center gap-3 lg:mx-0 lg:justify-start">
                <a
                  href="#products"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-gray-900 shadow-xl shadow-violet-900/50 transition hover:bg-gray-100"
                >
                  Browse all deals
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M8 3v10M3 9l5 5 5-5" />
                  </svg>
                </a>
                <a
                  href="/#compared"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-6 py-3 text-sm font-bold text-white/80 backdrop-blur-sm transition hover:bg-white/15"
                >
                  Top deals
                </a>
              </div>
            </div>

            {/* ── Right: price comparison mockup ── */}
            <div className="hidden lg:block">
              <PriceComparisonMockup />
            </div>
          </div>
        </div>
      </div>

      <StoreTrustBar />

      {/* ══════════════ FEATURED TOP DEALS ══════════════ */}
      {!error && topDeals.length > 0 && (
        <section className="border-b border-gray-100 bg-white py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-7 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-xl shadow-lg shadow-amber-500/30">
                  🔥
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-gray-900">
                    Biggest savings right now
                  </h2>
                  <p className="text-sm text-gray-500">
                    Verified multi-store deals · updated daily
                  </p>
                </div>
              </div>
              <a
                href="/#compared"
                className="hidden shrink-0 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:border-gray-300 hover:text-gray-900 sm:inline-block"
              >
                See all →
              </a>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {topDeals.map((p) => {
                const pct =
                  p.best_price && p.highest_price
                    ? Math.round((1 - p.best_price / p.highest_price) * 100)
                    : 0;
                return (
                  <div key={p.product_id} className="group relative">
                    {pct >= 5 && (
                      <div className="absolute -right-2 -top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-black text-white shadow-lg shadow-emerald-500/40 ring-2 ring-white">
                        -{pct}%
                      </div>
                    )}
                    <div className="overflow-hidden rounded-2xl shadow-md ring-1 ring-gray-200/80 transition group-hover:-translate-y-1 group-hover:shadow-xl group-hover:shadow-violet-100/60 group-hover:ring-violet-200">
                      <ProductCard product={p} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════ PRODUCT EXPLORER ══════════════ */}
      <main
        id="products"
        className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"
      >
        {error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
            <p className="font-bold">Couldn&apos;t load products.</p>
            <p className="mt-1 text-amber-700">{error}</p>
          </div>
        ) : (
          <ProductExplorer products={products} />
        )}
      </main>
    </PublicShell>
  );
}

/* ── Decorative hero mockup ────────────────────────────── */
function PriceComparisonMockup() {
  const stores = [
    { name: "Zigzag", price: "289,000 ֏", pct: 100, best: true },
    { name: "Vega", price: "334,000 ֏", pct: 87, best: false },
    { name: "iStore", price: "389,000 ֏", pct: 74, best: false },
  ];

  return (
    <div className="relative flex justify-center">
      {/* Secondary floating card — behind */}
      <div className="absolute -right-6 -top-8 z-0 w-52 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-md">
        <div className="mb-2 text-[9px] font-bold uppercase tracking-widest text-white/30">
          MacBook Air M2
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-white/50">MobileCentre</span>
            <span className="text-[11px] font-black text-white">599k ֏</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-white/40">Vega</span>
            <span className="text-[11px] text-white/30 line-through">
              649k ֏
            </span>
          </div>
        </div>
        <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[10px] font-black text-emerald-400">
          Save 50k ֏
        </div>
      </div>

      {/* Main comparison card — front */}
      <div className="relative z-10 w-[340px] rounded-3xl border border-white/15 bg-white/[0.08] p-6 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="mb-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/35">
            Price comparison
          </div>
          <div className="mt-1.5 text-base font-bold text-white/90">
            Samsung Galaxy S24 256GB
          </div>
        </div>

        {/* Price bars */}
        <div className="space-y-3.5">
          {stores.map((s) => (
            <div key={s.name} className="flex items-center gap-3">
              <div
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.best ? "bg-emerald-400" : "bg-white/25"}`}
              />
              <div className="w-[90px] shrink-0 text-xs font-semibold text-white/60">
                {s.name}
              </div>
              <div className="flex-1">
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all ${s.best ? "bg-emerald-400" : "bg-white/25"}`}
                    style={{ width: `${s.pct}%` }}
                  />
                </div>
              </div>
              <div
                className={`shrink-0 text-xs font-black tabular-nums ${s.best ? "text-white" : "text-white/35"}`}
              >
                {s.price}
              </div>
            </div>
          ))}
        </div>

        {/* Best deal box */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.12]">
          <div className="flex items-center justify-between p-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                🏆 Best deal · Zigzag
              </div>
              <div className="mt-1 text-2xl font-black text-white">
                289,000 ֏
              </div>
              <div className="mt-0.5 text-[11px] text-emerald-400/70">
                In stock · Save 100,000 ֏
              </div>
            </div>
            <div className="flex h-14 w-14 flex-col items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/40">
              <span className="text-[8px] font-black uppercase leading-none">
                save
              </span>
              <span className="text-lg font-black leading-tight">-26%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Third tiny floating badge */}
      <div className="absolute -bottom-4 -left-4 z-20 rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 backdrop-blur-md">
        <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">
          iSpace
        </div>
        <div className="mt-0.5 text-sm font-black text-white">415,000 ֏</div>
        <div className="mt-1 text-[10px] text-white/30 line-through">
          Higher than best
        </div>
      </div>
    </div>
  );
}
