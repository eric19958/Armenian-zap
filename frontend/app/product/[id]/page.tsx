import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import PriceHistoryChart from "@/components/PriceHistoryChart";
import PublicShell from "@/components/PublicShell";
import { supabase } from "@/lib/supabase";
import {
  categoryLabel,
  formatAMD,
  highResImage,
  pickBestOffer,
  retailerBadgeClass,
  retailerLabel,
} from "@/lib/format";
import type {
  ComparisonProduct,
  PriceHistoryPoint,
  RetailerOffer,
} from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getData(id: string): Promise<{
  product: ComparisonProduct | null;
  history: PriceHistoryPoint[];
}> {
  const [{ data: prow }, { data: hrows }] = await Promise.all([
    supabase
      .from("v_product_comparison")
      .select("*")
      .eq("product_id", id)
      .maybeSingle(),
    supabase
      .from("v_price_history")
      .select("*")
      .eq("product_id", id)
      .order("observed_at", { ascending: true }),
  ]);

  if (!prow) return { product: null, history: [] };

  const product: ComparisonProduct = {
    product_id: prow.product_id,
    brand: prow.brand,
    canonical_name: prow.canonical_name,
    category: prow.category,
    image_url: prow.image_url,
    offer_count: Number(prow.offer_count),
    retailer_count: Number(prow.retailer_count),
    best_price: prow.best_price === null ? null : Number(prow.best_price),
    highest_price:
      prow.highest_price === null ? null : Number(prow.highest_price),
    offers: (prow.offers ?? []).map(
      (o: any): RetailerOffer => ({
        retailer: o.retailer,
        price: Number(o.price),
        in_stock: Boolean(o.in_stock),
        url: o.url,
      })
    ),
  };

  const history: PriceHistoryPoint[] = (hrows ?? []).map((h: any) => ({
    product_id: h.product_id,
    retailer_slug: h.retailer_slug,
    retailer_name: h.retailer_name,
    price: Number(h.price),
    in_stock: Boolean(h.in_stock),
    observed_at: h.observed_at,
  }));

  return { product, history };
}

export default async function ProductPage({
  params,
}: {
  params: { id: string };
}) {
  const { product, history } = await getData(params.id);
  if (!product) notFound();

  const offers = [...product.offers].sort((a, b) => a.price - b.price);
  const best = pickBestOffer(offers);
  const others = best ? offers.filter((o) => o !== best) : offers;
  const maxPrice = offers.length ? Math.max(...offers.map((o) => o.price)) : 0;
  const savings = best ? maxPrice - best.price : 0;
  const savingsPct =
    best && maxPrice > best.price
      ? Math.round((1 - best.price / maxPrice) * 100)
      : 0;
  const hero = highResImage(product.image_url);

  return (
    <PublicShell>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-600 shadow-sm transition hover:border-gray-300 hover:text-gray-900"
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M13 7H1M6 2L1 7l5 5" />
          </svg>
          All products
        </Link>

        {/* ── Hero grid ── */}
        <section className="mt-6 grid grid-cols-1 items-start gap-8 lg:grid-cols-2">

          {/* Left: image */}
          <div className="overflow-hidden rounded-3xl border border-gray-200 bg-gradient-to-br from-gray-50 to-slate-100 shadow-sm">
            <div className="relative aspect-square">
              {hero ? (
                <Image
                  src={hero}
                  alt={product.canonical_name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-contain p-10"
                  priority
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-50 text-6xl font-black text-violet-200">
                  {(product.brand ?? "?").charAt(0)}
                </div>
              )}
            </div>
          </div>

          {/* Right: details — sticky on desktop */}
          <div>
            <div className="lg:sticky lg:top-[72px]">
              {/* Meta */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-violet-500">
                  {product.brand ?? "Unknown"}
                </span>
                <span className="text-gray-300">·</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {categoryLabel(product.category)}
                </span>
              </div>

              {/* Title */}
              <h1 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-3xl">
                {product.canonical_name}
              </h1>

              <p className="mt-2 text-sm text-gray-500">
                Available at{" "}
                <span className="font-bold text-gray-700">
                  {product.retailer_count} store
                  {product.retailer_count === 1 ? "" : "s"}
                </span>{" "}
                in Armenia
              </p>

              {/* Best deal box */}
              {best && (
                <div className="mt-5 overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-teal-50 shadow-sm shadow-emerald-100">
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase tracking-widest text-emerald-700">
                        Current best deal
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${retailerBadgeClass(best.retailer)}`}
                      >
                        {retailerLabel(best.retailer)}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-4">
                      <span className="text-4xl font-black tracking-tight text-gray-900">
                        {formatAMD(best.price)}
                      </span>
                      {savingsPct > 0 && (
                        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-500/40">
                          <span className="text-[8px] font-black uppercase leading-none tracking-wide">
                            save
                          </span>
                          <span className="text-lg font-black leading-tight">
                            -{savingsPct}%
                          </span>
                        </div>
                      )}
                    </div>

                    {savings > 0 && (
                      <p className="mt-1 text-sm font-semibold text-emerald-700">
                        You save {formatAMD(savings)} vs. the highest price
                      </p>
                    )}

                    {!best.in_stock && (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                        <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                        Cheapest listing is preorder / out of stock
                      </p>
                    )}

                    <a
                      href={best.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-violet-500/30 transition hover:bg-violet-700 active:scale-[0.98]"
                    >
                      Buy at {retailerLabel(best.retailer)}
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
                        <path d="M3 8h10M9 4l5 4-5 4" />
                      </svg>
                    </a>
                  </div>

                  {/* Price range strip */}
                  {savingsPct > 0 && (
                    <div className="border-t border-emerald-100 bg-emerald-50/60 px-5 py-3">
                      <div className="mb-1.5 flex justify-between text-[10px] font-bold">
                        <span className="text-emerald-700">
                          Best: {formatAMD(best.price)}
                        </span>
                        <span className="text-gray-400">
                          Highest: {formatAMD(maxPrice)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-emerald-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                          style={{ width: `${Math.max(savingsPct, 10)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Other sellers */}
              {others.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2.5 text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Also available at
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {others.map((o) => (
                      <a
                        key={o.retailer}
                        href={o.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition hover:brightness-95 ${
                          o.in_stock
                            ? "border-gray-200 bg-white text-gray-700 shadow-sm"
                            : "border-gray-100 bg-gray-50 text-gray-400"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            o.in_stock ? "bg-emerald-400" : "bg-gray-300"
                          }`}
                        />
                        {retailerLabel(o.retailer)}
                        <span className={o.in_stock ? "font-black text-gray-900" : ""}>
                          {formatAMD(o.price)}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Price history ── */}
        <section className="mt-14">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-gray-900">
                Price history
              </h2>
              <p className="mt-0.5 text-sm text-gray-500">
                Across {product.retailer_count} retailer
                {product.retailer_count === 1 ? "" : "s"} over time
              </p>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <PriceHistoryChart points={history} />
          </div>
        </section>

        {/* ── All retailers ── */}
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-extrabold text-gray-900">
            All retailers{" "}
            <span className="text-sm font-semibold text-gray-400">
              ({offers.length})
            </span>
          </h2>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            {offers.map((o, idx) => {
              const isBest = best && o === best;
              return (
                <div
                  key={o.retailer}
                  className={
                    "flex items-center justify-between gap-4 px-5 py-4 transition-colors " +
                    (idx > 0 ? "border-t border-gray-100 " : "") +
                    (isBest ? "bg-emerald-50/60" : "hover:bg-gray-50/60")
                  }
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${retailerBadgeClass(o.retailer)}`}
                    >
                      {retailerLabel(o.retailer)}
                    </span>
                    <span className="flex items-center gap-1.5 text-sm text-gray-500">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          o.in_stock ? "bg-emerald-500" : "bg-gray-300"
                        }`}
                      />
                      {o.in_stock ? "In stock" : "Out of stock"}
                    </span>
                    {isBest && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                        Best
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-base font-black tabular-nums text-gray-900">
                      {formatAMD(o.price)}
                    </span>
                    <a
                      href={o.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm shadow-violet-500/20 transition hover:bg-violet-700"
                    >
                      Visit
                      <svg
                        className="h-3 w-3"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M2 6h8M6 2l4 4-4 4" />
                      </svg>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
