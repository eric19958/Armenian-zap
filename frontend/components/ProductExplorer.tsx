"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import CategoryBar from "@/components/CategoryBar";
import ProductCard from "@/components/ProductCard";
import SearchBar from "@/components/SearchBar";
import type { CategoryOption } from "@/components/CategoryFilter";
import {
  categoryKey,
  categoryLabel,
  categorySortIndex,
  matchesQuery,
} from "@/lib/format";
import type { ComparisonProduct } from "@/lib/types";

export default function ProductExplorer({
  products,
}: {
  products: ComparisonProduct[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const deferredQuery = useDeferredValue(query);

  const searchFiltered = useMemo(
    () => products.filter((p) => matchesQuery(p, deferredQuery)),
    [products, deferredQuery]
  );

  const categories = useMemo<CategoryOption[]>(() => {
    const counts = new Map<string, number>();
    for (const p of searchFiltered) {
      const k = categoryKey(p.category);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const pills = [...counts.entries()]
      .filter(([key]) => key !== "accessory")
      .sort(
        (a, b) =>
          categorySortIndex(a[0]) - categorySortIndex(b[0]) || b[1] - a[1]
      )
      .map(([key, count]) => ({ key, label: categoryLabel(key), count }));
    return [{ key: "all", label: "All", count: searchFiltered.length }, ...pills];
  }, [searchFiltered]);

  const activeCategory = categories.some((c) => c.key === category)
    ? category
    : "all";

  const visible = useMemo(() => {
    if (activeCategory === "all") return searchFiltered;
    return searchFiltered.filter(
      (p) => categoryKey(p.category) === activeCategory
    );
  }, [searchFiltered, activeCategory]);

  const multi = visible.filter((p) => p.retailer_count >= 2);
  const single = visible.filter((p) => p.retailer_count < 2);

  const SINGLE_PAGE = 60;
  const [singleLimit, setSingleLimit] = useState(SINGLE_PAGE);
  useEffect(
    () => setSingleLimit(SINGLE_PAGE),
    [deferredQuery, activeCategory]
  );
  const singleShown = single.slice(0, singleLimit);

  return (
    <div>
      {/* ── Sticky search + filter ── */}
      <div className="sticky top-[57px] z-20 -mx-4 mb-8 border-b border-gray-200/60 bg-white/90 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-lg shadow-gray-900/5">
          <SearchBar
            value={query}
            onChange={setQuery}
            resultCount={visible.length}
          />
          {categories.length > 1 && (
            <div className="mt-3 border-t border-gray-100 pt-3">
              <CategoryBar
                options={categories}
                active={activeCategory}
                onChange={setCategory}
              />
            </div>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <NoResults
          query={query}
          onReset={() => {
            setQuery("");
            setCategory("all");
          }}
        />
      ) : (
        <>
          {multi.length > 0 && (
            <section id="compared">
              <SectionHeader
                title="Best to compare"
                subtitle="Same product at 2+ stores — guaranteed deal potential"
                count={multi.length}
                accent
              />
              <Grid products={multi} />
            </section>
          )}

          {single.length > 0 && (
            <section className={multi.length > 0 ? "mt-14" : ""}>
              <SectionHeader
                title="More products"
                subtitle="Single store listing for now"
                count={single.length}
              />
              <Grid products={singleShown} />
              {single.length > singleLimit && (
                <div className="mt-10 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setSingleLimit((n) => n + SINGLE_PAGE)}
                    className="rounded-xl border border-gray-200 bg-white px-6 py-2.5 text-sm font-bold text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
                  >
                    Show more{" "}
                    <span className="tabular-nums text-gray-400">
                      ({single.length - singleLimit} left)
                    </span>
                  </button>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  count,
  accent = false,
}: {
  title: string;
  subtitle: string;
  count: number;
  accent?: boolean;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div className="flex items-start gap-3">
        {accent && (
          <div className="mt-1 h-5 w-1 shrink-0 rounded-full bg-gradient-to-b from-violet-500 to-indigo-400" />
        )}
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">{title}</h2>
          <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
        </div>
      </div>
      <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-bold tabular-nums text-gray-600">
        {count}
      </span>
    </div>
  );
}

function Grid({ products }: { products: ComparisonProduct[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.product_id} product={p} />
      ))}
    </div>
  );
}

function NoResults({
  query,
  onReset,
}: {
  query: string;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-8 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm ring-1 ring-gray-200">
        🔍
      </div>
      <p className="mt-6 text-base font-bold text-gray-800">
        No products match
        {query.trim() ? ` "${query.trim()}"` : " your filters"}
      </p>
      <p className="mt-1 text-sm text-gray-500">
        Try a different search term or clear your filters
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-6 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-500/25 transition hover:bg-violet-700"
      >
        Clear search & filters
      </button>
    </div>
  );
}
