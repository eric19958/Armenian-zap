import Image from "next/image";
import Link from "next/link";
import {
  categoryLabel,
  formatAMD,
  retailerLabel,
  retailerBadgeClass,
  pickBestOffer,
} from "@/lib/format";
import type { ComparisonProduct, RetailerOffer } from "@/lib/types";

export default function ProductCard({ product }: { product: ComparisonProduct }) {
  const offers: RetailerOffer[] = [...(product.offers ?? [])].sort(
    (a, b) => a.price - b.price
  );
  const best = pickBestOffer(offers);
  const others = best ? offers.filter((o) => o !== best) : offers;

  const maxPrice = offers.length ? Math.max(...offers.map((o) => o.price)) : 0;
  const savingsPct =
    best && maxPrice > best.price
      ? Math.round((1 - best.price / maxPrice) * 100)
      : 0;

  const accentBorder =
    savingsPct >= 15
      ? "border-l-4 border-l-emerald-500"
      : savingsPct >= 5
      ? "border-l-4 border-l-emerald-400"
      : "border-l-4 border-l-transparent";

  return (
    <article
      className={`group flex flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-xl hover:shadow-violet-100/70 ${accentBorder}`}
    >
      {/* ── Image ── */}
      <Link
        href={`/product/${product.product_id}`}
        className="relative block h-48 overflow-hidden bg-gradient-to-br from-gray-50 to-slate-100"
      >
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.canonical_name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-contain p-4 transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <ImagePlaceholder label={product.brand ?? "?"} />
        )}

        {/* Store count chip */}
        <span className="absolute left-2.5 top-2.5 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold text-gray-700 shadow-sm backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
          {product.retailer_count}{" "}
          {product.retailer_count === 1 ? "store" : "stores"}
        </span>

        {/* Circular savings sticker */}
        {savingsPct >= 5 && (
          <div className="absolute right-2.5 top-2.5 z-10 flex h-[54px] w-[54px] flex-col items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/50">
            <span className="text-[8px] font-black uppercase leading-none tracking-wider">
              save
            </span>
            <span className="mt-0.5 text-[17px] font-black leading-none tabular-nums">
              -{savingsPct}%
            </span>
          </div>
        )}
      </Link>

      {/* ── Body ── */}
      <div className="flex flex-1 flex-col p-4">
        {/* Brand + category */}
        <div className="flex items-center gap-1.5 overflow-hidden">
          <span className="truncate text-[10px] font-black uppercase tracking-widest text-violet-500">
            {product.brand ?? "Unknown"}
          </span>
          <span className="shrink-0 text-[10px] text-gray-300">·</span>
          <span className="truncate text-[10px] font-medium uppercase tracking-wider text-gray-400">
            {categoryLabel(product.category)}
          </span>
        </div>

        {/* Name */}
        <h3 className="mt-1.5 line-clamp-2 min-h-[2.75rem] text-sm font-bold leading-snug text-gray-900">
          <Link
            href={`/product/${product.product_id}`}
            className="transition hover:text-violet-700"
          >
            {product.canonical_name}
          </Link>
        </h3>

        {/* ── Price section ── */}
        {best && (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                Best price
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${retailerBadgeClass(best.retailer)}`}
              >
                {retailerLabel(best.retailer)}
              </span>
            </div>

            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[28px] font-black leading-none tracking-tight text-gray-900">
                {formatAMD(best.price)}
              </span>
            </div>

            {!best.in_stock && (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                preorder
              </span>
            )}

            {/* Savings bar with label */}
            {offers.length >= 2 && savingsPct > 0 && (
              <div className="mt-2.5">
                <div className="flex items-center gap-2">
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                      style={{ width: `${Math.max(savingsPct, 10)}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-[10px] font-black text-emerald-600">
                    -{savingsPct}%
                  </span>
                </div>
                <div className="mt-1 flex justify-between text-[10px] font-semibold">
                  <span className="text-emerald-600">{formatAMD(best.price)}</span>
                  <span className="text-gray-400">{formatAMD(maxPrice)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Other sellers */}
        {others.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {others.slice(0, 3).map((o) => (
              <a
                key={o.retailer}
                href={o.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold ring-1 transition hover:brightness-95 ${
                  o.in_stock
                    ? "bg-gray-50 text-gray-700 ring-gray-200"
                    : "bg-gray-50 text-gray-400 ring-gray-100"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    o.in_stock ? "bg-emerald-400" : "bg-gray-300"
                  }`}
                />
                {retailerLabel(o.retailer)}
              </a>
            ))}
            {others.length > 3 && (
              <span className="inline-flex items-center rounded-lg bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-400 ring-1 ring-gray-100">
                +{others.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="flex-1" />

        {/* CTA row */}
        {best && (
          <div className="mt-4 flex gap-2">
            <Link
              href={`/product/${product.product_id}`}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs font-bold text-gray-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
            >
              Compare
            </Link>
            <a
              href={best.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-[1.4] items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2.5 text-xs font-bold text-white shadow-md shadow-violet-500/25 transition hover:bg-violet-700 active:scale-[0.98]"
            >
              {retailerLabel(best.retailer)}
              <svg
                className="h-3 w-3"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M1 7h12M8 2l5 5-5 5" />
              </svg>
            </a>
          </div>
        )}
      </div>
    </article>
  );
}

function ImagePlaceholder({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-50">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-3xl font-black text-violet-200 shadow-inner ring-1 ring-violet-100">
        {label.charAt(0).toUpperCase()}
      </div>
    </div>
  );
}
