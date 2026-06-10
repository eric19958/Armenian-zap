"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/admin-api";
import { formatAMD, highResImage, retailerLabel } from "@/lib/format";

const OpsDashboard = dynamic(() => import("@/components/OpsDashboard"), {
  loading: () => (
    <p className="text-sm text-gray-500">Loading scrape ops…</p>
  ),
  ssr: false,
});

type Stats = {
  products: number;
  offers: number;
  linked_offers: number;
  unlinked_offers: number;
  pending_matches: number;
  retailers: number;
};

type QueueItem = {
  id: number;
  score: number;
  method: string;
  rationale?: Record<string, unknown> | null;
  offer_id: number;
  offer_title: string;
  offer_sku: string;
  offer_price: number;
  offer_url: string;
  offer_image: string | null;
  retailer_slug: string;
  product_id: string;
  product_name: string;
  product_brand: string | null;
  product_mpn: string | null;
  product_image: string | null;
};

type CatalogOffer = {
  offer_id: number;
  title: string;
  retailer_slug: string;
  retailer_name: string;
  price: number;
  product_url: string;
  image_url: string | null;
  in_stock: boolean;
};

type CatalogProduct = {
  product_id: string;
  brand: string | null;
  canonical_name: string;
  mpn: string | null;
  category: string | null;
  image_url: string | null;
  offers: CatalogOffer[];
};

type UnlinkedOffer = {
  id: number;
  title: string;
  retailer_sku: string;
  price: number;
  product_url: string;
  image_url: string | null;
  retailer_slug: string;
};

type ProductHit = {
  id: string;
  brand: string | null;
  mpn: string | null;
  canonical_name: string;
  category: string | null;
};

type Tab = "ops" | "queue" | "unlinked";

export default function AdminPanel({ authed }: { authed: boolean }) {
  const [loggedIn, setLoggedIn] = useState(authed);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState<Tab>("ops");
  const [stats, setStats] = useState<Stats | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [unlinked, setUnlinked] = useState<UnlinkedOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [linkSearch, setLinkSearch] = useState<Record<number, string>>({});
  const [linkHits, setLinkHits] = useState<Record<number, ProductHit[]>>({});
  const [editingProduct, setEditingProduct] = useState<ProductHit | null>(null);
  const [expandedQueueId, setExpandedQueueId] = useState<number | null>(null);
  const [catalogProduct, setCatalogProduct] = useState<CatalogProduct | null>(
    null
  );
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setActionError("");
    try {
      const [s, q, u] = await Promise.all([
        adminFetch<Stats>("/api/admin/stats"),
        adminFetch<QueueItem[]>("/api/admin/queue"),
        adminFetch<UnlinkedOffer[]>("/api/admin/unlinked"),
      ]);
      setStats(s);
      setQueue(q);
      setUnlinked(u);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  function flash(msg: string) {
    setSuccessMsg(msg);
    window.setTimeout(() => setSuccessMsg(""), 3000);
  }

  useEffect(() => {
    if (loggedIn && tab !== "ops") load();
  }, [loggedIn, tab, load]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const j = await res.json();
      setLoginError(j.error ?? "Login failed");
      return;
    }
    setLoggedIn(true);
    setPassword("");
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    setLoggedIn(false);
  }

  async function toggleCatalogView(item: QueueItem) {
    if (expandedQueueId === item.id) {
      setExpandedQueueId(null);
      setCatalogProduct(null);
      setCatalogError("");
      return;
    }

    setExpandedQueueId(item.id);
    setCatalogProduct(null);
    setCatalogError("");
    setCatalogLoading(true);
    try {
      const data = await adminFetch<CatalogProduct>(
        `/api/admin/product-detail?product_id=${encodeURIComponent(item.product_id)}`
      );
      setCatalogProduct(data);
    } catch (e: unknown) {
      setCatalogError(e instanceof Error ? e.message : String(e));
    } finally {
      setCatalogLoading(false);
    }
  }

  function formatRationale(rationale: Record<string, unknown> | null | undefined) {
    if (!rationale || Object.keys(rationale).length === 0) return null;
    if (rationale.reason === "brand_mismatch") return "Brand mismatch";
    if (rationale.reason === "spec_conflict") {
      const conflict = rationale.conflict as Record<string, unknown[]> | undefined;
      if (conflict) {
        return Object.entries(conflict)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" vs ") : String(v)}`)
          .join(" · ");
      }
      return "Spec conflict";
    }
    if (typeof rationale.token_set_ratio === "number") {
      return `Name similarity: ${rationale.token_set_ratio}%`;
    }
    return JSON.stringify(rationale);
  }

  async function approve(id: number) {
    setBusyId(`approve-${id}`);
    setActionError("");
    try {
      await adminFetch("/api/admin/approve", {
        method: "POST",
        body: JSON.stringify({ candidate_id: id }),
      });
      flash("Match approved");
      await load();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: number) {
    setBusyId(`reject-${id}`);
    setActionError("");
    try {
      await adminFetch("/api/admin/reject", {
        method: "POST",
        body: JSON.stringify({ candidate_id: id }),
      });
      flash("Match rejected");
      await load();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function searchProducts(offerId: number, q: string) {
    setLinkSearch((prev) => ({ ...prev, [offerId]: q }));
    if (q.trim().length < 2) {
      setLinkHits((prev) => ({ ...prev, [offerId]: [] }));
      return;
    }
    try {
      const data = await adminFetch<ProductHit[]>(
        `/api/admin/products?q=${encodeURIComponent(q)}`
      );
      setLinkHits((prev) => ({ ...prev, [offerId]: data }));
    } catch {
      setLinkHits((prev) => ({ ...prev, [offerId]: [] }));
    }
  }

  async function linkOffer(offerId: number, productId: string) {
    setBusyId(`link-${offerId}`);
    setActionError("");
    try {
      await adminFetch("/api/admin/link", {
        method: "POST",
        body: JSON.stringify({ offer_id: offerId, product_id: productId }),
      });
      flash("Offer linked");
      await load();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function saveProduct() {
    if (!editingProduct) return;
    setBusyId("save-product");
    setActionError("");
    try {
      await adminFetch("/api/admin/products", {
        method: "PATCH",
        body: JSON.stringify({
          product_id: editingProduct.id,
          canonical_name: editingProduct.canonical_name,
          brand: editingProduct.brand ?? "",
          category: editingProduct.category ?? "",
        }),
      });
      setEditingProduct(null);
      flash("Product updated");
      await load();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  if (!loggedIn) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center py-8">
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">Sign in</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review matches, run scrapes, manage the catalog.
          </p>
          <form onSubmit={login} className="mt-6 space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin password"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-200"
              autoFocus
            />
            {loginError && (
              <p className="text-sm text-red-600">{loginError}</p>
            )}
            <button
              type="submit"
              className="w-full rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              Sign in
            </button>
          </form>
        </div>
      </div>
    );
  }

  const btnSecondary =
    "rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Scrape stores, approve matches, link offers.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => load()}
            disabled={loading}
            className={btnSecondary}
          >
            Refresh
          </button>
          <button onClick={logout} className={btnSecondary}>
            Log out
          </button>
        </div>
      </div>

      {stats && tab !== "ops" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Products", stats.products],
            ["Offers", stats.offers],
            ["Linked", stats.linked_offers],
            ["Unlinked", stats.unlinked_offers],
            ["Review queue", stats.pending_matches],
            ["Retailers", stats.retailers],
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
      )}

      {successMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMsg}
        </div>
      )}

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {actionError}
        </div>
      )}

      {loading && (
        <p className="text-sm text-gray-500">Loading…</p>
      )}

      <div className="inline-flex flex-wrap gap-1 rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">
        {(
          [
            ["ops", "Scrape ops"],
            ["queue", `Review queue (${queue.length})`],
            ["unlinked", `Unlinked offers (${unlinked.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              tab === key
                ? "bg-gray-900 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "ops" && <OpsDashboard />}

      {tab === "queue" && (
        <div className="space-y-4">
          {queue.length === 0 && !loading && (
            <p className="text-sm text-gray-500">No pending matches — all clear.</p>
          )}
          {queue.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm ring-1 ring-gray-900/5"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                  Score {Number(item.score).toFixed(0)}%
                </span>
                <span className="text-xs text-gray-400">{item.method}</span>
                <span className="text-xs text-gray-400">
                  {retailerLabel(item.retailer_slug)}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl bg-gray-50 p-4">
                  <div className="text-xs font-semibold uppercase text-gray-400">
                    Scraped offer
                  </div>
                  {highResImage(item.offer_image) && (
                    <img
                      src={highResImage(item.offer_image)!}
                      alt=""
                      className="mt-3 h-24 w-24 rounded-lg border border-gray-200 bg-white object-contain p-1"
                    />
                  )}
                  <p className="mt-2 font-medium text-gray-900">{item.offer_title}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    SKU {item.offer_sku} · {formatAMD(Number(item.offer_price))}
                  </p>
                  <a
                    href={item.offer_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs font-medium text-gray-700 hover:text-gray-900 hover:underline"
                  >
                    View on store →
                  </a>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs font-semibold uppercase text-gray-400">
                    Suggested catalog product
                  </div>
                  {highResImage(item.product_image) && (
                    <img
                      src={highResImage(item.product_image)!}
                      alt=""
                      className="mt-3 h-24 w-24 rounded-lg border border-gray-200 bg-white object-contain p-1"
                    />
                  )}
                  <p className="mt-2 font-medium text-gray-900">{item.product_name}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    {item.product_brand ?? "—"}
                    {item.product_mpn ? ` · MPN ${item.product_mpn}` : ""}
                  </p>
                  {formatRationale(item.rationale ?? null) && (
                    <p className="mt-2 text-xs text-gray-600">
                      Match signal: {formatRationale(item.rationale ?? null)}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => toggleCatalogView(item)}
                      className="text-xs font-semibold text-gray-800 hover:underline"
                    >
                      {expandedQueueId === item.id
                        ? "Hide catalog product"
                        : "View catalog product & listings →"}
                    </button>
                    <Link
                      href={`/product/${item.product_id}`}
                      target="_blank"
                      className="text-xs font-medium text-gray-700 hover:text-gray-900 hover:underline"
                    >
                      Open on site →
                    </Link>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingProduct({
                          id: item.product_id,
                          brand: item.product_brand,
                          mpn: item.product_mpn,
                          canonical_name: item.product_name,
                          category: null,
                        })
                      }
                      className="text-xs font-medium text-gray-700 hover:text-gray-900 hover:underline"
                    >
                      Edit product name →
                    </button>
                  </div>
                </div>
              </div>

              {expandedQueueId === item.id && (
                <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  {catalogLoading && (
                    <p className="text-sm text-gray-500">Loading catalog product…</p>
                  )}
                  {catalogError && (
                    <p className="text-sm text-red-600">{catalogError}</p>
                  )}
                  {catalogProduct && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-4">
                        {highResImage(catalogProduct.image_url) && (
                          <img
                            src={highResImage(catalogProduct.image_url)!}
                            alt=""
                            className="h-28 w-28 rounded-lg border border-gray-200 bg-gray-50 object-contain p-2"
                          />
                        )}
                        <div>
                          <p className="text-xs font-semibold uppercase text-gray-400">
                            Canonical product in Inch Ka
                          </p>
                          <p className="mt-1 text-lg font-bold text-gray-900">
                            {catalogProduct.canonical_name}
                          </p>
                          <p className="mt-1 text-sm text-gray-500">
                            {catalogProduct.brand ?? "—"}
                            {catalogProduct.mpn
                              ? ` · MPN ${catalogProduct.mpn}`
                              : ""}
                            {catalogProduct.category
                              ? ` · ${catalogProduct.category}`
                              : ""}
                          </p>
                          <p className="mt-1 font-mono text-xs text-gray-400">
                            ID {catalogProduct.product_id}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase text-gray-400">
                          Existing listings linked to this product (
                          {catalogProduct.offers.length})
                        </p>
                        {catalogProduct.offers.length === 0 ? (
                          <p className="mt-2 text-sm text-gray-500">
                            No offers linked yet — approving will create the first
                            listing.
                          </p>
                        ) : (
                          <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
                            {catalogProduct.offers.map((o) => (
                              <li
                                key={o.offer_id}
                                className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm ${
                                  o.offer_id === item.offer_id
                                    ? "bg-amber-50"
                                    : ""
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                                      {retailerLabel(o.retailer_slug)}
                                    </span>
                                    {o.offer_id === item.offer_id && (
                                      <span className="text-xs font-semibold text-amber-700">
                                        This offer
                                      </span>
                                    )}
                                    {!o.in_stock && (
                                      <span className="text-xs text-gray-400">
                                        Out of stock
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-1 truncate text-gray-800">
                                    {o.title}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-semibold text-gray-900">
                                    {formatAMD(Number(o.price))}
                                  </span>
                                  <a
                                    href={o.product_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-medium text-gray-700 hover:text-gray-900 hover:underline"
                                  >
                                    Store →
                                  </a>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => approve(item.id)}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busyId === `approve-${item.id}` ? "Approving…" : "Approve match"}
                </button>
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => reject(item.id)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {busyId === `reject-${item.id}` ? "Rejecting…" : "Reject"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "unlinked" && (
        <div className="space-y-4">
          {unlinked.length === 0 && !loading && (
            <p className="text-sm text-gray-500">All offers are linked.</p>
          )}
          {unlinked.map((o) => (
            <div
              key={o.id}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm ring-1 ring-gray-900/5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {retailerLabel(o.retailer_slug)}
                  </span>
                  <p className="mt-2 font-medium text-gray-900">{o.title}</p>
                  <p className="text-sm text-gray-500">
                    {o.retailer_sku} · {formatAMD(Number(o.price))}
                  </p>
                </div>
                <a
                  href={o.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-gray-700 hover:text-gray-900 hover:underline"
                >
                  Store link →
                </a>
              </div>
              <div className="mt-4">
                <input
                  type="search"
                  placeholder="Search canonical product to link…"
                  value={linkSearch[o.id] ?? ""}
                  onChange={(e) => searchProducts(o.id, e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                {(linkHits[o.id] ?? []).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => linkOffer(o.id, p.id)}
                    className="mt-2 flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    <span>
                      {p.canonical_name}
                      {p.brand ? ` · ${p.brand}` : ""}
                    </span>
                    <span className="text-xs font-semibold text-gray-900">Link</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-bold text-gray-900">Edit product</h3>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-gray-500">
                Name
                <input
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={editingProduct.canonical_name}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      canonical_name: e.target.value,
                    })
                  }
                />
              </label>
              <label className="block text-xs font-medium text-gray-500">
                Brand
                <input
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={editingProduct.brand ?? ""}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, brand: e.target.value })
                  }
                />
              </label>
              <label className="block text-xs font-medium text-gray-500">
                Category
                <input
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={editingProduct.category ?? ""}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      category: e.target.value,
                    })
                  }
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setEditingProduct(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={saveProduct}
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
