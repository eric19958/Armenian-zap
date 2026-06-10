"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-api";
import { retailerLabel } from "@/lib/format";

type CategoryDetail = { url: string; covered: boolean };

type RetailerOps = {
  slug: string;
  name: string;
  offer_count: number;
  linked_count: number;
  unlinked_count: number;
  pending_matches: number;
  comparable_count: number;
  last_scraped_at: string | null;
  category_count: number;
  category_coverage_pct: number;
  categories_covered: number;
  category_details: CategoryDetail[];
  linked_pct: number;
  job: JobInfo;
};

type JobInfo = {
  status: string;
  phase?: string;
  started_at?: string;
  finished_at?: string;
  offers?: number;
  error?: string;
  progress_pct?: number;
  message?: string;
  category_index?: number;
  category_total?: number;
  category_url?: string;
  page?: number;
  raw_collected?: number;
  upserted?: number;
  total_offers?: number;
};

type OpsData = {
  totals: {
    retailers: number;
    offers: number;
    linked: number;
    comparable: number;
    avg_category_coverage: number;
  };
  retailers: RetailerOps[];
};

function fmtTime(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ProgressBar({
  pct,
  color = "bg-blue-600",
}: {
  pct: number;
  color?: string;
}) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

function jobBadge(status: string) {
  const styles: Record<string, string> = {
    running: "bg-gray-200 text-gray-800",
    done: "bg-emerald-100 text-emerald-800",
    error: "bg-red-100 text-red-800",
    idle: "bg-gray-100 text-gray-600",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${styles[status] ?? styles.idle}`}
    >
      {status}
    </span>
  );
}

export default function OpsDashboard() {
  const [data, setData] = useState<OpsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [categoryBusy, setCategoryBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [liveJobs, setLiveJobs] = useState<Record<string, { job: JobInfo; log: string[] }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const d = await adminFetch<OpsData>("/api/admin/ops");
      setData(d);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const pollLiveJobs = useCallback(async (slugs: string[]) => {
    const results: Record<string, { job: JobInfo; log: string[] }> = {};
    await Promise.all(
      slugs.map(async (slug) => {
        try {
          const res = await adminFetch<{ job: JobInfo; log: string[] }>(
            `/api/admin/job?slug=${encodeURIComponent(slug)}`
          );
          if (res.job) results[slug] = res;
        } catch {
          /* ignore */
        }
      })
    );
    setLiveJobs((prev) => ({ ...prev, ...results }));
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 15_000);
    return () => window.clearInterval(t);
  }, [load]);

  const runningSlugs =
    data?.retailers
      .filter((r) => (liveJobs[r.slug]?.job?.status ?? r.job?.status) === "running")
      .map((r) => r.slug) ?? [];

  useEffect(() => {
    if (runningSlugs.length === 0) return;
    pollLiveJobs(runningSlugs);
    const t = window.setInterval(() => pollLiveJobs(runningSlugs), 3000);
    return () => window.clearInterval(t);
  }, [runningSlugs.join(","), pollLiveJobs]);

  async function loadCategories(slug: string) {
    if (expanded === slug) {
      setExpanded(null);
      return;
    }
    setExpanded(slug);
    const row = data?.retailers.find((r) => r.slug === slug);
    if (row?.category_details.length) return;

    setCategoryBusy(slug);
    setError("");
    try {
      const details = await adminFetch<{
        category_coverage_pct: number;
        categories_covered: number;
        category_details: CategoryDetail[];
      }>(`/api/admin/ops/categories?slug=${encodeURIComponent(slug)}`);
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          retailers: prev.retailers.map((r) =>
            r.slug === slug
              ? {
                  ...r,
                  category_coverage_pct: details.category_coverage_pct,
                  categories_covered: details.categories_covered,
                  category_details: details.category_details,
                }
              : r
          ),
        };
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setExpanded(null);
    } finally {
      setCategoryBusy(null);
    }
  }

  async function startScrape(slug: string) {
    setBusySlug(slug);
    setError("");
    try {
      const res = await adminFetch<{ message: string }>("/api/admin/scrape", {
        method: "POST",
        body: JSON.stringify({ retailer: slug, match: true }),
      });
      setMsg(res.message ?? `Scrape started: ${slug}`);
      setExpanded(slug);
      window.setTimeout(() => setMsg(""), 5000);
      await load();
      await pollLiveJobs([slug]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusySlug(null);
    }
  }

  if (loading && !data) {
    return <p className="text-sm text-gray-500">Loading ops dashboard…</p>;
  }

  if (error && !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Scrape operations</h2>
        <p className="text-sm text-gray-500">
          One full store at a time — live progress while scraping (updates every 3s).
        </p>
      </div>

      {msg && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 shadow-sm">
          {msg}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ["Stores", data.totals.retailers],
          ["Total offers", data.totals.offers],
          ["Linked", data.totals.linked],
          ["Comparable", data.totals.comparable],
          ["Avg category %", `${data.totals.avg_category_coverage}%`],
        ].map(([label, val]) => (
          <div
            key={String(label)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
          >
            <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
              {label}
            </div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{val}</div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {data.retailers.map((r) => {
          const live = liveJobs[r.slug]?.job ?? r.job;
          const isRunning = live?.status === "running";
          const logLines = liveJobs[r.slug]?.log ?? [];

          return (
          <div
            key={r.slug}
            className={`rounded-2xl border bg-white p-5 shadow-sm ${
              isRunning ? "border-gray-900 ring-2 ring-gray-200" : "border-gray-200"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-gray-900">
                    {r.name || retailerLabel(r.slug)}
                  </h3>
                  {jobBadge(live?.status ?? "idle")}
                </div>
                <p className="mt-1 text-xs text-gray-400">{r.slug}</p>
              </div>
              <button
                type="button"
                disabled={busySlug !== null || isRunning}
                onClick={() => startScrape(r.slug)}
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
              >
                {isRunning
                  ? "Running…"
                  : busySlug === r.slug
                    ? "Starting…"
                    : "Scrape full store"}
              </button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="mb-1 flex justify-between text-xs text-gray-500">
                  <span>Categories</span>
                  <span>
                    {r.categories_covered}/{r.category_count} ({r.category_coverage_pct}%)
                  </span>
                </div>
                <ProgressBar
                  pct={r.category_coverage_pct}
                  color={
                    r.category_coverage_pct >= 80
                      ? "bg-emerald-500"
                      : r.category_coverage_pct >= 40
                        ? "bg-amber-500"
                        : "bg-gray-400"
                  }
                />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs text-gray-500">
                  <span>Offers in DB</span>
                  <span>{r.offer_count}</span>
                </div>
                <ProgressBar
                  pct={Math.min(100, r.offer_count > 0 ? 100 : 0)}
                  color="bg-gray-700"
                />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs text-gray-500">
                  <span>Linked to catalog</span>
                  <span>{r.linked_pct}%</span>
                </div>
                <ProgressBar pct={r.linked_pct} color="bg-violet-500" />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs text-gray-500">
                  <span>Price comparisons</span>
                  <span>{r.comparable_count} products</span>
                </div>
                <ProgressBar
                  pct={Math.min(100, r.comparable_count * 2)}
                  color="bg-emerald-600"
                />
              </div>
            </div>

            {isRunning && (
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold text-gray-900">
                    {live?.phase === "matching"
                      ? "Matching products…"
                      : live?.phase === "saving"
                        ? "Saving to database…"
                        : "Scraping…"}
                  </span>
                  <span className="font-bold text-gray-700">
                    {live?.progress_pct ?? 0}%
                  </span>
                </div>
                <ProgressBar pct={live?.progress_pct ?? 0} color="bg-gray-900" />
                <p className="mt-2 text-xs text-gray-700">{live?.message}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-600">
                  {live?.category_total ? (
                    <span>
                      Category {live.category_index}/{live.category_total}
                    </span>
                  ) : null}
                  {live?.page ? <span>Page {live.page}</span> : null}
                  {live?.raw_collected != null ? (
                    <span>Collected: {live.raw_collected}</span>
                  ) : null}
                  {live?.upserted != null && live.total_offers ? (
                    <span>
                      Saved: {live.upserted}/{live.total_offers}
                    </span>
                  ) : null}
                </div>
                {live?.category_url && (
                  <p className="mt-1 truncate text-xs text-gray-500">
                    {live.category_url}
                  </p>
                )}
                {logLines.length > 0 && (
                  <pre className="mt-3 max-h-36 overflow-auto rounded-lg bg-gray-900 p-3 font-mono text-[11px] leading-relaxed text-green-400">
                    {logLines.join("\n")}
                  </pre>
                )}
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
              <span>Last scrape: {fmtTime(r.last_scraped_at)}</span>
              <span>Unlinked: {r.unlinked_count}</span>
              <span>Review queue: {r.pending_matches}</span>
              {live?.status === "done" && live.offers != null && (
                <span>Last run: {live.offers} offers</span>
              )}
              {live?.status === "error" && live.error && (
                <span className="text-red-600">{live.error}</span>
              )}
            </div>

            <button
              type="button"
              className="mt-3 text-xs font-medium text-gray-700 hover:text-gray-900 hover:underline disabled:opacity-50"
              disabled={categoryBusy === r.slug}
              onClick={() => loadCategories(r.slug)}
            >
              {categoryBusy === r.slug
                ? "Loading categories…"
                : expanded === r.slug
                  ? "Hide categories"
                  : "Show categories"}
            </button>

            {expanded === r.slug && (
              <ul className="mt-2 space-y-1 border-t border-gray-100 pt-2">
                {r.category_details.map((c) => (
                  <li
                    key={c.url}
                    className="flex items-center gap-2 text-xs text-gray-600"
                  >
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${c.covered ? "bg-emerald-500" : "bg-gray-300"}`}
                    />
                    <span className="truncate">{c.url}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => load()}
        disabled={loading}
        className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
      >
        {loading ? "Refreshing…" : "Refresh now"}
      </button>
    </div>
  );
}
