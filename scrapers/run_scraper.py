"""
Inch Ka · scraper CLI
=====================

Run any configured retailer through the factory engine.

    python scrapers/run_scraper.py zigzag
    python scrapers/run_scraper.py mobilecentre --dry-run
    python scrapers/run_scraper.py all            # every retailer in the registry

Reads FIRECRAWL_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY from .env.
"""

from __future__ import annotations

import argparse
import os
import sys

from dotenv import load_dotenv

from base import BaseScraper
from db import connect, ensure_retailer
from retailers_config import RETAILERS, get_config

load_dotenv()


def make_clients(dry_run: bool):
    from firecrawl import Firecrawl

    fc = Firecrawl(api_key=os.environ["FIRECRAWL_API_KEY"])
    return fc, *connect(dry_run=dry_run)


def main() -> int:
    parser = argparse.ArgumentParser(description="Inch Ka · factory scraper")
    parser.add_argument("retailer", help="retailer slug, or 'all'")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    slugs = list(RETAILERS) if args.retailer == "all" else [args.retailer]
    fc, db_kind, db = make_clients(args.dry_run)

    total = 0
    for slug in slugs:
        cfg = get_config(slug)
        if not args.dry_run and db_kind and db:
            ensure_retailer(
                db_kind, db, slug, cfg["name"], cfg["base_url"], cfg["currency_default"]
            )
        offers = BaseScraper(cfg).run(fc, db_kind, db, dry_run=args.dry_run)
        total += len(offers)
    if db_kind == "pg" and db:
        db.close()
    print(f"\n[done] {len(slugs)} retailer(s), {total} offers processed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
