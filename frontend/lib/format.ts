// Inch Ka · display helpers

import { categorySortIndex } from "@/lib/categories";

const AMD = "֏"; // ֏

export function formatAMD(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value).toLocaleString("en-US")} ${AMD}`;
}

/** Compact form for chart axes: 1,989,900 → "2.0M ֏", 340,000 → "340k ֏". */
export function formatAMDShort(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const v = Number(value);
  if (Math.abs(v) >= 1_000_000) {
    return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M ${AMD}`;
  }
  if (Math.abs(v) >= 1_000) {
    return `${Math.round(v / 1_000)}k ${AMD}`;
  }
  return `${Math.round(v)} ${AMD}`;
}

const RETAILER_NAMES: Record<string, string> = {
  allsell: "AllSell",
  yerevanmobile: "Yerevan Mobile",
  vega: "Vega",
  eldorado: "Eldorado",
  redstore: "RedStore",
  mobilecentre: "Mobile Centre",
  zigzag: "Zigzag",
  istore: "iStore",
  ispace: "iSpace",
};

export function retailerLabel(slug: string): string {
  return RETAILER_NAMES[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1);
}

// A stable accent color per retailer for the store badges.
const RETAILER_COLORS: Record<string, string> = {
  zigzag: "bg-orange-100 text-orange-700",
  vega: "bg-sky-100 text-sky-700",
  istore: "bg-zinc-200 text-zinc-800",
  mobilecentre: "bg-violet-100 text-violet-700",
};

export function retailerBadgeClass(slug: string): string {
  return RETAILER_COLORS[slug] ?? "bg-gray-100 text-gray-700";
}

// Hex equivalents of the badge colors, for the recharts price-history lines.
const RETAILER_HEX: Record<string, string> = {
  zigzag: "#ea580c", // orange-600
  vega: "#0284c7", // sky-600
  istore: "#52525b", // zinc-600
  mobilecentre: "#7c3aed", // violet-600
};

export function retailerColor(slug: string): string {
  return RETAILER_HEX[slug] ?? "#6b7280"; // gray-500
}

/**
 * Upgrade a thumbnail URL to a higher-res variant for the product detail page.
 * Retailer CDNs encode the size in the path; we swap to a large variant where
 * the pattern is known, otherwise return the original untouched.
 */
export function highResImage(url: string | null | undefined): string | null {
  if (!url) return null;
  // Vega: ".../Name (CODE) (2)-250x250.webp" → "-1500x1500.webp"
  if (url.includes("vega.am")) {
    return url.replace(/-\d{2,4}x\d{2,4}(\.\w+)(\?.*)?$/, "-1500x1500$1");
  }
  // MobileCentre: ".../prodpic/small/..." → ".../prodpic/big/..."
  if (url.includes("mobilecentre.am")) {
    return url.replace("/prodpic/small/", "/prodpic/big/");
  }
  return url;
}

/**
 * Upgrade a thumbnail URL to a higher-resolution variant for the PDP.
 * Currently handles Vega's "-250x250.webp" → "-570x570.webp" (a size we know
 * exists). Other retailers are returned unchanged.
 */
export function hiResImage(url: string | null): string | null {
  if (!url) return url;
  if (url.includes("vega.am")) {
    return url.replace(/-\d{2,4}x\d{2,4}\.webp/i, "-570x570.webp");
  }
  return url;
}

/**
 * Pick the offer to feature: cheapest in-stock; if nothing is in stock, the
 * cheapest overall (flagged via its in_stock=false).
 */
export function pickBestOffer<T extends { price: number; in_stock: boolean }>(
  offers: T[]
): T | null {
  if (!offers || offers.length === 0) return null;
  const sorted = [...offers].sort((a, b) => a.price - b.price);
  return sorted.find((o) => o.in_stock) ?? sorted[0];
}

// --- search & category helpers -------------------------------------------

export function categoryKey(category: string | null | undefined): string {
  return (category ?? "other").trim().toLowerCase() || "other";
}

const CATEGORY_LABELS: Record<string, string> = {
  notebook: "Notebooks",
  laptop: "Laptops",
  smartphone: "Smartphones",
  phone: "Phones",
  tablet: "Tablets",
  smartwatch: "Smartwatches",
  tv: "TVs",
  av_tv: "Audio & Video",
  refrigerator: "Refrigerators",
  washing_machine: "Washing Machines",
  air_conditioner: "Air Conditioners",
  kitchen_appliance: "Kitchen Appliances",
  vacuum_cleaner: "Vacuum Cleaners",
  home_appliance: "Home Appliances",
  gaming: "Gaming",
  desktop: "Desktops",
  printer: "Printers",
  accessory: "Accessories",
  other: "Other",
};

export { categorySortIndex };

export function categoryLabel(category: string | null | undefined): string {
  const key = categoryKey(category);
  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
  const t = key.charAt(0).toUpperCase() + key.slice(1);
  return t.endsWith("s") ? t : `${t}s`;
}

/** Case-insensitive match on canonical name OR brand. */
export function matchesQuery(
  product: { canonical_name: string; brand: string | null },
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = `${product.canonical_name} ${product.brand ?? ""}`.toLowerCase();
  // every whitespace-separated term must appear (AND search)
  return q.split(/\s+/).every((term) => haystack.includes(term));
}
