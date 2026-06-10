"""
Inch Ka · canonical matcher
===========================

Links retailer offers (Zigzag, Vega, …) to canonical products so the same
physical product from different stores sits in one comparison row.

Strategy (tiered, highest precision first):

  Tier 1 — MPN     : exact match on normalized manufacturer part number.
                     This is the workhorse for electronics — the model code
                     (e.g. A5CW0EA) is printed in both retailers' titles.
  Tier 2 — GTIN    : exact match on barcode/EAN when present on the product.
  Tier 3 — Fuzzy   : brand + token similarity + spec agreement (RAM/storage/
                     screen). >= AUTO_THRESHOLD auto-links; REVIEW..AUTO range
                     goes to the match_candidates review queue; below that the
                     offer seeds a NEW canonical product.

Deterministic tiers create the canonical product if none exists yet, so the
first retailer to be scraped populates `products` and the second links to it.

Run:
    python matcher.py            # process all unlinked offers
    python matcher.py --dry-run  # report decisions, write nothing
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Any, Optional

from dotenv import load_dotenv
from rapidfuzz import fuzz
from supabase import create_client

from categorize import categorize
from specs import Identity, build_identity, normalize_mpn

load_dotenv()

AUTO_THRESHOLD = 90.0     # >= this fuzzy score → auto-link
REVIEW_THRESHOLD = 78.0   # [REVIEW, AUTO) → queue for manual review

_MIGRATION_HINT = (
    "Run migrations/0012_matcher_grants.sql in the Supabase SQL editor."
)


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------
def specs_agree(a: Identity, b: Identity) -> tuple[bool, dict]:
    """Hard guard: never fuzzy-merge two different RAM/storage/screen variants."""
    detail = {}
    for attr in ("ram_gb", "storage_gb", "screen_in"):
        va, vb = getattr(a, attr), getattr(b, attr)
        if va is not None and vb is not None and va != vb:
            detail[attr] = [va, vb]
    return (len(detail) == 0, detail)


def fuzzy_score(a: Identity, b: Identity) -> tuple[float, dict]:
    if a.brand and b.brand and a.brand.lower() != b.brand.lower():
        return 0.0, {"reason": "brand_mismatch"}
    agree, conflict = specs_agree(a, b)
    if not agree:
        return 0.0, {"reason": "spec_conflict", "conflict": conflict}
    name_a = " ".join(sorted(a.tokens))
    name_b = " ".join(sorted(b.tokens))
    token_score = fuzz.token_set_ratio(name_a, name_b)
    return float(token_score), {"token_set_ratio": token_score}


# ---------------------------------------------------------------------------
# DB access (Supabase REST, inch_ka schema)
# ---------------------------------------------------------------------------
class Store:
    def __init__(self, dry_run: bool = False):
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not (url and key):
            sys.exit("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (.env).")
        self.sb = create_client(url, key)
        self.dry_run = dry_run

    def _rpc(self, name: str, params: dict | None = None):
        try:
            return self.sb.rpc(name, params or {}).execute()
        except Exception as exc:
            msg = str(exc)
            if "PGRST106" in msg or "inchka_" in msg or "PGRST202" in msg:
                sys.exit(_MIGRATION_HINT)
            raise

    def unlinked_offers(self) -> list[dict[str, Any]]:
        return self._rpc("inchka_unlinked_offers").data or []

    def products(self) -> list[dict[str, Any]]:
        return self._rpc("inchka_products_catalog").data or []

    def create_product(self, ident: Identity, title: str,
                       category: str | None) -> str:
        if self.dry_run:
            return "dry-run-product-id"
        res = self._rpc(
            "inchka_create_product",
            {
                "p_brand": ident.brand,
                "p_mpn": ident.mpn,
                "p_canonical_name": title,
                "p_category": category,
                "p_attributes": {
                    "ram_gb": ident.ram_gb,
                    "storage_gb": ident.storage_gb,
                    "screen_in": ident.screen_in,
                },
            },
        )
        data = res.data
        if isinstance(data, list):
            return str(data[0])
        return str(data)

    def link(self, offer_id: int, product_id: str) -> None:
        if self.dry_run:
            return
        self._rpc(
            "inchka_link_offer",
            {"p_offer_id": offer_id, "p_product_id": product_id},
        )

    def queue_candidate(self, offer_id: int, product_id: str,
                        score: float, method: str, rationale: dict) -> None:
        if self.dry_run:
            return
        self._rpc(
            "inchka_queue_match_candidate",
            {
                "p_offer_id": offer_id,
                "p_product_id": product_id,
                "p_score": round(score, 2),
                "p_method": method,
                "p_rationale": rationale,
            },
        )


# ---------------------------------------------------------------------------
# Matching pipeline
# ---------------------------------------------------------------------------
def product_identity(p: dict[str, Any]) -> Identity:
    attrs = p.get("attributes") or {}
    return Identity(
        brand=p.get("brand"),
        mpn=normalize_mpn(p.get("mpn")),
        screen_in=attrs.get("screen_in"),
        ram_gb=attrs.get("ram_gb"),
        storage_gb=attrs.get("storage_gb"),
        tokens=set((p.get("canonical_name") or "").lower().split()),
    )


def run(dry_run: bool = False) -> dict[str, int]:
    store = Store(dry_run=dry_run)
    offers = store.unlinked_offers()
    products = store.products()

    # Indexes over the canonical catalog, refreshed as we create products.
    by_mpn: dict[str, str] = {}
    by_gtin: dict[str, str] = {}
    prod_idents: list[tuple[str, Identity]] = []
    for p in products:
        ident = product_identity(p)
        if ident.mpn:
            by_mpn[ident.mpn] = p["id"]
        if p.get("gtin"):
            by_gtin[normalize_mpn(p["gtin"])] = p["id"]
        prod_idents.append((p["id"], ident))

    stats = {"mpn": 0, "gtin": 0, "fuzzy_auto": 0, "queued": 0, "new": 0}

    for o in offers:
        raw = o.get("raw") or {}
        brand = raw.get("brand")
        title = o.get("title") or ""
        ident = build_identity(title, brand=brand, sku=o.get("retailer_sku"))
        # Auto-classify from the title (accessories win), falling back to the
        # scraped category hint. Prevents accessory pollution of real categories.
        category = categorize(title, raw.get("category"))

        # Each scraper computes the best manufacturer code into raw['mpn']
        # (Zigzag from the title's /CODE, Vega from the vendor-code field).
        # Trust it over the title-derived guess so the key is consistent
        # across retailers.
        explicit_mpn = normalize_mpn(raw.get("mpn"))
        if explicit_mpn:
            ident.mpn = explicit_mpn

        # Tier 1 — MPN
        if ident.mpn and ident.mpn in by_mpn:
            store.link(o["id"], by_mpn[ident.mpn])
            stats["mpn"] += 1
            _log(dry_run, "MPN  ", o, title)
            continue

        # Tier 2 — GTIN
        gtin = normalize_mpn(raw.get("gtin"))
        if gtin and gtin in by_gtin:
            store.link(o["id"], by_gtin[gtin])
            stats["gtin"] += 1
            _log(dry_run, "GTIN ", o, title)
            continue

        # Tier 3 — Fuzzy against existing canonical products
        best_id, best_score, best_why = None, 0.0, {}
        for pid, pident in prod_idents:
            score, why = fuzzy_score(ident, pident)
            if score > best_score:
                best_id, best_score, best_why = pid, score, why

        if best_id and best_score >= AUTO_THRESHOLD:
            store.link(o["id"], best_id)
            stats["fuzzy_auto"] += 1
            _log(dry_run, f"FUZZY {best_score:.0f}", o, title)
            continue
        if best_id and best_score >= REVIEW_THRESHOLD:
            store.queue_candidate(o["id"], best_id, best_score, "fuzzy", best_why)
            stats["queued"] += 1
            _log(dry_run, f"QUEUE {best_score:.0f}", o, title)
            continue

        # No match → seed a new canonical product, index it for later offers.
        new_id = store.create_product(ident, title, category)
        store.link(o["id"], new_id)
        if ident.mpn:
            by_mpn[ident.mpn] = new_id
        prod_idents.append((new_id, ident))
        stats["new"] += 1
        _log(dry_run, "NEW  ", o, title)

    return stats


def _log(dry_run: bool, tag: str, offer: dict, title: str) -> None:
    prefix = "[dry] " if dry_run else ""
    print(f"  {prefix}{tag:<10} sku={offer.get('retailer_sku',''):<16} {title[:60]}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Inch Ka · canonical matcher")
    parser.add_argument("--dry-run", action="store_true",
                        help="Report decisions without writing to the DB")
    args = parser.parse_args()

    stats = run(dry_run=args.dry_run)
    print("\n[summary]")
    print(f"  MPN exact      : {stats['mpn']}")
    print(f"  GTIN exact     : {stats['gtin']}")
    print(f"  Fuzzy auto-link: {stats['fuzzy_auto']}")
    print(f"  Queued review  : {stats['queued']}")
    print(f"  New products   : {stats['new']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
