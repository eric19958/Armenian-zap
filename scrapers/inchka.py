#!/usr/bin/env python3
"""
Inch Ka · unified scraper CLI
=============================

Scrape by URL or retailer slug, save offers to Supabase, optionally run the
canonical matcher so products land in the comparison view.

Examples
--------
    # Scrape one category URL (auto-detects the store):
    python scrapers/inchka.py scrape --url "https://vega.am/en/.../smart-phones/"

    # Scrape a configured retailer (all categories in retailers_config.py):
    python scrapers/inchka.py scrape vega

    # Everything + link offers to canonical products:
    python scrapers/inchka.py scrape --all --match

    # Test extraction on one page without writing:
    python scrapers/inchka.py probe --url "https://www.zigzag.am/en/phones-and-communication.html"

Environment (.env): FIRECRAWL_API_KEY, DATABASE_URL (or SUPABASE_URL + key).
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

from dotenv import load_dotenv

from base import BaseScraper
from db import connect, ensure_retailer
from detect import detect_retailer
from job_status import active_scrapes, reconcile_stale_jobs, set_done, set_error, set_running
from retailers_config import RETAILERS, get_config

load_dotenv()

ROOT = Path(__file__).resolve().parent.parent


def _firecrawl():
    from firecrawl import Firecrawl

    key = os.environ.get("FIRECRAWL_API_KEY")
    if not key:
        sys.exit("FIRECRAWL_API_KEY not set (.env).")
    # Per-page timeout — prevents hung scrapes when Firecrawl/network stalls.
    timeout = float(os.environ.get("FIRECRAWL_TIMEOUT_SEC", "240"))
    return Firecrawl(api_key=key, timeout=timeout, max_retries=2)


def _run_matcher(dry_run: bool = False) -> None:
    args = [sys.executable, str(ROOT / "matching" / "matcher.py")]
    if dry_run:
        args.append("--dry-run")
    print("\n=== Canonical matcher ===")
    try:
        subprocess.run(args, cwd=ROOT, check=True)
    except subprocess.CalledProcessError:
        print(
            "\n!! Matcher failed. Run migrations/0012_matcher_grants.sql "
            "in Supabase SQL editor, then: python scrapers/inchka.py match",
            file=sys.stderr,
        )
        raise


def cmd_probe(url: str) -> int:
    slug, cfg = detect_retailer(url)
    print(f"[probe] retailer={slug}  url={url}")
    scraper = BaseScraper(cfg)
    fc = _firecrawl()
    page = scraper.scrape_page(fc, url)
    print(f"[probe] {len(page)} raw listings on first page")
    for raw in page[:8]:
        offer = scraper.normalize(raw)
        if offer:
            print(
                f"  · {offer.retailer_sku:<14} {offer.price:>10,.0f} {offer.currency}  "
                f"{offer.title[:55]}"
            )
        else:
            print(f"  ! skipped: {(raw.get('name') or '')[:55]}")
    if len(page) > 8:
        print(f"  … and {len(page) - 8} more")
    return 0


def _scrape_config(slug: str, cfg: dict, dry_run: bool, track_job: bool = True) -> int:
    if track_job and not dry_run:
        reconcile_stale_jobs()
        running = active_scrapes()
        other = [s for s, _ in running if s != slug]
        if other:
            raise RuntimeError(
                f"Another scrape is already running ({', '.join(other)}). "
                "Wait for it to finish or stop it before starting a new one."
            )
        set_running(slug, pid=os.getpid(), category_total=len(cfg.get("categories", [])))
    try:
        db_kind, db = connect(dry_run=dry_run)
        if not dry_run and db_kind and db:
            ensure_retailer(
                db_kind,
                db,
                slug,
                cfg.get("name", slug),
                cfg.get("base_url", ""),
                cfg.get("currency_default", "AMD"),
            )
        fc = _firecrawl()
        offers = BaseScraper(cfg).run(fc, db_kind, db, dry_run=dry_run)
        print(f"[{slug}] {len(offers)} offer(s)")
        if db_kind == "pg" and db:
            db.close()
        if track_job and not dry_run:
            set_done(slug, len(offers))
        return len(offers)
    except Exception as exc:  # noqa: BLE001
        if track_job and not dry_run:
            set_error(slug, str(exc))
        raise


def cmd_scrape(
    target: str | None,
    url: str | None,
    scrape_all: bool,
    dry_run: bool,
    match: bool,
) -> int:
    total = 0
    if url:
        slug, cfg = detect_retailer(url)
        print(f"\n=== Scrape URL → {slug} ===")
        total += _scrape_config(slug, cfg, dry_run)
    elif scrape_all:
        for slug in RETAILERS:
            print(f"\n=== Scrape {slug} ===")
            try:
                total += _scrape_config(slug, get_config(slug), dry_run)
            except Exception as exc:  # noqa: BLE001
                print(f"!! {slug} failed: {exc}", file=sys.stderr)
    elif target:
        print(f"\n=== Scrape {target} ===")
        total += _scrape_config(target, get_config(target), dry_run)
    else:
        sys.exit("Provide a retailer slug, --url, or --all")

    print(f"\n[scrape] {total} offer(s) processed")
    if match and not dry_run and target and target != "all":
        from job_status import update_progress

        update_progress(
            target,
            phase="matching",
            progress_pct=96,
            message="Linking offers to catalog (matcher)…",
        )
    if match and not dry_run:
        _run_matcher()
    elif match and dry_run:
        print("[match] skipped in dry-run mode")
    return 0


def cmd_match(dry_run: bool) -> int:
    _run_matcher(dry_run=dry_run)
    return 0


def cmd_plan(retailer: str | None) -> int:
    """Show every category URL that a full-retailer scrape will walk."""
    slugs = [retailer] if retailer else list(RETAILERS)
    total_cats = 0
    for slug in slugs:
        cfg = get_config(slug)
        cats = cfg["categories"]
        pag = cfg.get("pagination", {})
        max_pages = pag.get("count", 1)
        total_cats += len(cats)
        print(f"\n{'=' * 60}")
        print(f"{cfg['name']} ({slug})")
        print(f"  categories : {len(cats)}")
        print(f"  max pages  : {max_pages} per category (stops on empty page)")
        print(f"  command    : python scrapers/inchka.py scrape {slug} --match")
        for i, url in enumerate(cats, 1):
            print(f"  {i:2}. {url}")
    print(f"\n[plan] {len(slugs)} retailer(s), {total_cats} category URLs total")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Inch Ka · scrape stores and link products for price comparison"
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_probe = sub.add_parser("probe", help="test one page extraction (no DB writes)")
    p_probe.add_argument("--url", required=True, help="category/listing URL")

    p_scrape = sub.add_parser("scrape", help="scrape offers into Inch Ka")
    p_scrape.add_argument(
        "retailer",
        nargs="?",
        help="retailer slug from retailers_config.py (e.g. zigzag, vega)",
    )
    p_scrape.add_argument("--url", help="scrape a single category URL")
    p_scrape.add_argument("--all", action="store_true", help="every configured retailer")
    p_scrape.add_argument("--dry-run", action="store_true", help="extract only, no DB")
    p_scrape.add_argument(
        "--match",
        action="store_true",
        help="run canonical matcher after scraping",
    )

    p_match = sub.add_parser("match", help="link unlinked offers to canonical products")
    p_match.add_argument("--dry-run", action="store_true")

    p_plan = sub.add_parser("plan", help="list categories for a full-retailer scrape")
    p_plan.add_argument(
        "retailer",
        nargs="?",
        help="retailer slug (omit to list all retailers)",
    )

    args = parser.parse_args()
    if args.command == "probe":
        return cmd_probe(args.url)
    if args.command == "scrape":
        return cmd_scrape(args.retailer, args.url, args.all, args.dry_run, args.match)
    if args.command == "match":
        return cmd_match(args.dry_run)
    if args.command == "plan":
        return cmd_plan(args.retailer)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
