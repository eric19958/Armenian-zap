"""
Inch Ka · scraper factory — engine
==================================

One generic, config-driven scraper that replaces the per-retailer scripts.
A retailer becomes a dictionary in retailers_config.py; this engine handles
Firecrawl extraction, pagination, normalization into the canonical schema,
and the upsert_offer RPC.

Adding a new retailer = adding a config entry. No new code.
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass, asdict
from typing import Any, Optional
from urllib.parse import urljoin

# Canonical product schema — identical across every retailer, this is what the
# matcher and Supabase consume.
PRODUCT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "products": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "brand": {"type": "string"},
                    "price": {"type": "number"},
                    "old_price": {"type": "number"},
                    "currency": {"type": "string"},
                    "product_url": {"type": "string"},
                    "image_url": {"type": "string"},
                    "in_stock": {"type": "boolean"},
                    "code": {"type": "string"},
                },
                "required": ["name", "price", "product_url"],
            },
        }
    },
    "required": ["products"],
}


@dataclass
class CanonicalOffer:
    retailer_slug: str
    retailer_sku: str
    title: str
    product_url: str
    image_url: Optional[str]
    brand: Optional[str]
    price: float
    old_price: Optional[float]
    currency: str
    in_stock: bool
    mpn: Optional[str]
    scraped_category: Optional[str] = None


# --- small helpers --------------------------------------------------------
def to_float(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return float(value)
    digits = re.sub(r"[^\d]", "", str(value))   # "1 838 900 AMD" / "329,900դր." → digits
    return float(digits) if digits else None


def normalize_code(value: str | None, reject: set[str], reject_numeric: bool) -> Optional[str]:
    if not value:
        return None
    if value.strip().lower() in reject:
        return None
    cleaned = re.sub(r"[^A-Za-z0-9]", "", value).upper()
    if not cleaned:
        return None
    if reject_numeric and cleaned.isdigit():   # e.g. Zigzag internal product id
        return None
    return cleaned


def slug_key(url: str) -> Optional[str]:
    m = re.search(r"/([^/?#]+?)\.html?(?:$|[?#])", url)
    if m:
        return m.group(1).lower()
    tail = url.rstrip("/").split("/")[-1]
    return tail.lower() or None


class BaseScraper:
    """Config-driven scraper. One instance per retailer config."""

    def __init__(self, config: dict[str, Any]):
        self.cfg = config
        self.slug = config["slug"]
        self.currency_default = config.get("currency_default", "AMD")
        self.reject_codes = {c.lower() for c in config.get("reject_codes", ["none", "null", "n/a", ""])}
        self.reject_numeric = config.get("reject_numeric_code", False)
        self.code_fields = config.get("code_fields", ["code", "sku"])
        self.code_from_title = config.get("code_from_title")  # optional regex str
        self.skip_zero_price = config.get("skip_zero_price", True)
        self.base_url = config.get("base_url", "")

    # -- image URL ---------------------------------------------------------
    def _abs_image(self, value: str | None) -> Optional[str]:
        """Resolve a possibly-relative image URL against the retailer base_url.
        '/media/x.png' → 'https://site.am/media/x.png'; already-absolute URLs
        and protocol-relative '//cdn/x.png' are handled too."""
        if not value:
            return None
        url = value.strip()
        if not url:
            return None
        if url.startswith("//"):
            return "https:" + url
        if url.startswith("http://") or url.startswith("https://"):
            return url
        return urljoin(self.base_url.rstrip("/") + "/", url.lstrip("/"))

    # -- URL / pagination --------------------------------------------------
    def page_urls(self) -> list[str]:
        urls: list[str] = []
        pag = self.cfg.get("pagination", {})
        start = pag.get("start", 1)
        count = pag.get("count", 1)
        for template in self.cfg["categories"]:
            if "{page}" in template and count > 1:
                urls += [template.replace("{page}", str(start + i)) for i in range(count)]
            else:
                urls.append(template.replace("{page}", str(start)))
        return urls

    # -- normalization -----------------------------------------------------
    def _derive_code(self, raw: dict[str, Any], title: str, url: str) -> Optional[str]:
        for field in self.code_fields:
            code = normalize_code(raw.get(field), self.reject_codes, self.reject_numeric)
            if code:
                return code
        if self.code_from_title:
            m = re.search(self.code_from_title, title)
            if m:
                return normalize_code(m.group(1), self.reject_codes, False)
        return None

    def normalize(self, raw: dict[str, Any]) -> Optional[CanonicalOffer]:
        price = to_float(raw.get("price"))
        url = (raw.get("product_url") or "").strip()
        if price is None or (self.skip_zero_price and price <= 0) or not url:
            return None

        code = self._derive_code(raw, raw.get("name") or "", url)
        sku = code or slug_key(url)
        if not sku:
            return None

        old_price = to_float(raw.get("old_price"))
        if old_price in (0, 0.0):
            old_price = None

        currency = (raw.get("currency") or "").strip().upper()
        if currency in ("", "֏", "ԴՐ", "ДР", "DRAM", "AMD.", "AMD"):
            currency = self.currency_default

        brand = (raw.get("brand") or self.cfg.get("default_brand", "")).strip()
        brand = brand.title() if brand and brand.isupper() else (brand or None)

        return CanonicalOffer(
            retailer_slug=self.slug,
            retailer_sku=sku,
            title=(raw.get("name") or "").strip(),
            product_url=url,
            image_url=self._abs_image(raw.get("image_url")),
            brand=brand,
            price=price,
            old_price=old_price,
            currency=currency or self.currency_default,
            in_stock=bool(raw.get("in_stock", True)),
            mpn=code,   # None when only the URL slug was available → matcher uses fuzzy
            scraped_category=getattr(self, "_category_hint", None),
        )

    # -- Firecrawl extraction ---------------------------------------------
    def scrape_page(self, fc, url: str) -> list[dict[str, Any]]:
        import time

        last_err: Exception | None = None
        for attempt in range(3):
            try:
                result = fc.scrape(
                    url,
                    formats=[{
                        "type": "json",
                        "prompt": self.cfg["extraction_prompt"],
                        "schema": PRODUCT_SCHEMA,
                    }],
                    only_main_content=self.cfg.get("only_main_content", True),
                    wait_for=self.cfg.get("wait_for", 3000),
                    location={"country": "AM", "languages": ["en"]},
                )
                data = getattr(result, "json", None) or {}
                return data.get("products", [])
            except Exception as exc:  # noqa: BLE001
                last_err = exc
                msg = str(exc).lower()
                retryable = any(
                    k in msg
                    for k in ("connection", "timeout", "reset", "503", "502", "429")
                )
                if not retryable or attempt >= 2:
                    raise
                wait = 5 * (attempt + 1)
                print(
                    f"[{self.slug}] retry {attempt + 1}/2 for {url} ({exc}) — wait {wait}s",
                    flush=True,
                )
                time.sleep(wait)
        if last_err:
            raise last_err
        return []

    def _page_url(self, template: str, page_index: int, start: int) -> str:
        """Build one listing-page URL from a category template."""
        page_param = self.cfg.get("page_param")
        n = start + page_index
        if "{page}" in template:
            return template.replace("{page}", str(n))
        if page_param == "path":
            if "{page}" in template:
                return template.replace("{page}", str(n))
            return re.sub(r"/\d+/?$", f"/{n}/", template.rstrip("/"))
        if page_param:
            sep = "&" if "?" in template else "?"
            return f"{template}{sep}{page_param}={n}"
        return template

    def collect(self, fc) -> list[CanonicalOffer]:
        """Paginate PER category until a page comes back empty (or the
        max-page cap is hit), then move on to the next category. Pagination is
        per-category so an empty page in one category never aborts the others.

        Config: pagination = {"start": int, "count": max_pages_per_category}.
        A category URL with "{page}" is crawled page-by-page; one without it is
        fetched once. De-dupes by product_url across pages (defensive against
        stores that repeat the last page when you over-paginate)."""
        pag = self.cfg.get("pagination", {})
        start = pag.get("start", 1)
        max_pages = pag.get("count", 1)
        page_param = self.cfg.get("page_param")  # "p", "page", or "path"
        delay = self.cfg.get("delay_sec", 1.0)
        raw: list[dict[str, Any]] = []
        seen_urls: set[str] = set()
        categories = self.cfg["categories"]
        cat_total = len(categories)

        def _progress(cat_idx: int, page_i: int, pages: int, **extra) -> None:
            try:
                from job_status import update_progress

                base = int(((cat_idx) / max(cat_total, 1)) * 85)
                page_slice = int((page_i / max(pages, 1)) * (85 / max(cat_total, 1)))
                update_progress(
                    self.slug,
                    phase="scraping",
                    category_index=cat_idx + 1,
                    category_total=cat_total,
                    progress_pct=min(84, base + page_slice),
                    **extra,
                )
            except Exception:  # noqa: BLE001 — never break scrape for UI
                pass

        from category_hints import hint_from_url

        for cat_idx, template in enumerate(categories):
            paginated = "{page}" in template or bool(page_param)
            pages = max_pages if paginated else 1
            for i in range(pages):
                url = self._page_url(template, i, start)
                self._category_hint = hint_from_url(url)
                _progress(
                    cat_idx,
                    i,
                    pages,
                    category_url=url,
                    page=i + 1,
                    message=f"Category {cat_idx + 1}/{cat_total} · page {i + 1}",
                )
                print(f"[{self.slug}] scrape {url}", flush=True)
                page = self.scrape_page(fc, url)
                print(f"[{self.slug}]   {len(page)} raw listings", flush=True)
                if not page:
                    break
                new = [p for p in page if (p.get("product_url") or "") not in seen_urls]
                for p in new:
                    seen_urls.add(p.get("product_url") or "")
                raw.extend(new)
                _progress(
                    cat_idx,
                    i,
                    pages,
                    category_url=url,
                    page=i + 1,
                    raw_collected=len(raw),
                    message=f"Collected {len(raw)} products so far",
                )
                if paginated and not new:
                    break
                time.sleep(delay)

        offers = [o for o in (self.normalize(r) for r in raw) if o]
        print(f"[{self.slug}] normalized {len(offers)}/{len(raw)} offers")
        try:
            from job_status import update_progress

            update_progress(
                self.slug,
                phase="normalizing",
                progress_pct=86,
                raw_collected=len(raw),
                total_offers=len(offers),
                message=f"Normalized {len(offers)} offers",
            )
        except Exception:  # noqa: BLE001
            pass
        return offers

    # -- load --------------------------------------------------------------
    def _offer_raw(self, offer: CanonicalOffer) -> dict[str, Any]:
        raw = asdict(offer)
        if offer.scraped_category:
            raw["category"] = offer.scraped_category
        return raw

    def upsert_pg(self, conn, offer: CanonicalOffer) -> None:
        import json

        with conn.cursor() as cur:
            cur.execute(
                "SELECT inch_ka.upsert_offer(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                (
                    offer.retailer_slug,
                    offer.retailer_sku,
                    offer.title,
                    offer.product_url,
                    offer.image_url,
                    offer.price,
                    offer.old_price,
                    offer.currency,
                    offer.in_stock,
                    json.dumps(self._offer_raw(offer)),
                ),
            )
        conn.commit()

    def upsert_sb(self, sb, offer: CanonicalOffer) -> None:
        import json

        sb.rpc(
            "inchka_upsert_offer",
            {
                "p_retailer_slug": offer.retailer_slug,
                "p_retailer_sku": offer.retailer_sku,
                "p_title": offer.title,
                "p_product_url": offer.product_url,
                "p_image_url": offer.image_url,
                "p_price": offer.price,
                "p_old_price": offer.old_price,
                "p_currency": offer.currency,
                "p_in_stock": offer.in_stock,
                "p_raw": json.loads(json.dumps(self._offer_raw(offer))),
            },
        ).execute()

    def run(
        self,
        fc,
        db_kind: str | None = None,
        db=None,
        dry_run: bool = False,
    ) -> list[CanonicalOffer]:
        offers = self.collect(fc)
        if dry_run or db is None:
            for o in offers:
                disc = f" (was {o.old_price:.0f})" if o.old_price else ""
                stock = "" if o.in_stock else " [out/preorder]"
                print(f"  · {o.retailer_sku:<16} mpn={str(o.mpn):<16} "
                      f"{o.price:>10,.0f} {o.currency}{disc}{stock}  {o.title[:48]}")
            return offers
        ok = 0
        total = len(offers)
        for idx, o in enumerate(offers):
            try:
                if db_kind == "sb":
                    self.upsert_sb(db, o)
                else:
                    self.upsert_pg(db, o)
                ok += 1
            except Exception as exc:  # noqa: BLE001
                if db_kind == "pg":
                    db.rollback()
                print(f"  ! {self.slug} upsert failed for {o.retailer_sku}: {exc}")
            if idx % 3 == 0 or idx == total - 1:
                try:
                    from job_status import update_progress

                    pct = 87 + int(8 * ok / total) if total else 95
                    update_progress(
                        self.slug,
                        phase="saving",
                        upserted=ok,
                        total_offers=total,
                        progress_pct=min(95, pct),
                        message=f"Saving to database {ok}/{total}",
                    )
                except Exception:  # noqa: BLE001
                    pass
        print(f"[{self.slug}] upserted {ok}/{len(offers)}")
        return offers
