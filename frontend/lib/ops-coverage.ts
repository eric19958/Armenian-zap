/** Heuristic: does this category URL have at least one scraped offer? */

export function categorySignature(categoryUrl: string): string {
  try {
    const parts = new URL(categoryUrl).pathname.split("/").filter(Boolean);
    // Prefer last 2 path segments (e.g. phones-and-gadgets/smart-phones)
    if (parts.length >= 2) return parts.slice(-2).join("/");
    return parts[parts.length - 1] ?? categoryUrl;
  } catch {
    return categoryUrl;
  }
}

export function categoryCovered(
  categoryUrl: string,
  offerUrls: string[]
): boolean {
  const sig = categorySignature(categoryUrl).toLowerCase();
  if (!sig) return false;
  return offerUrls.some((u) => u.toLowerCase().includes(sig));
}

export function coveragePercent(
  categories: string[],
  offerUrls: string[]
): number {
  if (categories.length === 0) return 0;
  const hit = categories.filter((c) => categoryCovered(c, offerUrls)).length;
  return Math.round((hit / categories.length) * 100);
}
