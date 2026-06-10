"""
Inch Ka · daily pipeline orchestrator
=====================================

One command that runs the whole loop:

  1. Scrape Zigzag + Vega (subprocess; failures are logged, not fatal)
  2. Run the canonical matcher
  3. Query inch_ka.v_price_drops for today's drops
  4. Email a formatted digest (HTML + Instagram caption) via the connected
     Gmail account, using Composio's GMAIL_SEND_EMAIL tool.

Designed to be invoked by cron / a scheduler once a day, e.g.:
    0 9 * * *  cd /path/to/inch_ka && python pipeline/run_daily.py

Environment (.env):
    FIRECRAWL_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
    COMPOSIO_API_KEY, COMPOSIO_USER_ID, DIGEST_TO_EMAIL
"""

from __future__ import annotations

import os
import subprocess
import sys
from datetime import date
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scrapers"))
from email_format import build_html, build_ig_caption  # noqa: E402
from base import BaseScraper  # noqa: E402
from db import connect, ensure_retailer  # noqa: E402
from retailers_config import RETAILERS  # noqa: E402

load_dotenv()

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = "inch_ka"


def _run(label: str, *args: str) -> None:
    """Run a sub-step; log and continue on failure (a dead scraper shouldn't
    block the digest for the retailer that did succeed)."""
    print(f"\n=== {label} ===")
    try:
        subprocess.run([sys.executable, *args], cwd=ROOT, check=True)
    except subprocess.CalledProcessError as exc:
        print(f"!! {label} failed (exit {exc.returncode}) — continuing", file=sys.stderr)


def fetch_drops(sb) -> list[dict]:
    rows = (sb.schema(SCHEMA).table("v_price_drops").select("*").execute()).data or []
    # numerics arrive as strings over REST → coerce
    for r in rows:
        r["prev_price"] = float(r["prev_price"])
        r["cur_price"] = float(r["cur_price"])
        r["drop_pct"] = float(r["drop_pct"])
    return rows


def send_digest(drops: list[dict]) -> None:
    """Send via the connected Gmail account using Composio."""
    from composio import Composio  # pip install composio

    api_key = os.environ["COMPOSIO_API_KEY"]
    user_id = os.environ.get("COMPOSIO_USER_ID", "default")
    to = os.environ.get("DIGEST_TO_EMAIL")
    if not to:
        sys.exit("DIGEST_TO_EMAIL not set (.env).")

    today = date.today()
    html = build_html(drops, today)
    caption = build_ig_caption(drops, today)
    # Embed the IG caption in a copy-paste box beneath the table.
    body = html.replace(
        "</table>",
        "</table>"
        '<div style="padding:20px 24px;">'
        '<div style="font-size:12px;color:#888;text-transform:uppercase;'
        'letter-spacing:.5px;margin-bottom:8px;">Copy-paste for Instagram</div>'
        '<pre style="white-space:pre-wrap;background:#0f1117;color:#e6e6e6;'
        'border-radius:10px;padding:16px;font-size:13px;line-height:1.5;'
        'font-family:ui-monospace,Menlo,Consolas,monospace;">'
        f"{caption}</pre></div>",
        1,
    )

    n = len(drops)
    subject = (
        f"Inch Ka — {n} price drop{'s' if n != 1 else ''} today"
        if n else "Inch Ka — no price drops today"
    )

    composio = Composio(api_key=api_key)
    composio.tools.execute(
        "GMAIL_SEND_EMAIL",
        user_id=user_id,
        arguments={
            "recipient_email": to,
            "subject": subject,
            "is_html": True,
            "body": body,
        },
    )
    print(f"[email] digest sent to {to} ({n} drops)")


def main() -> int:
    sb = create_client(
        os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    )

    # 1. Scrape EVERY retailer in the registry through the factory engine.
    from firecrawl import Firecrawl

    fc = Firecrawl(api_key=os.environ["FIRECRAWL_API_KEY"])
    db_kind, db = connect()
    for slug in RETAILERS:
        print(f"\n=== Scrape {slug} ===")
        try:
            cfg = RETAILERS[slug]
            ensure_retailer(
                db_kind, db, slug, cfg["name"], cfg["base_url"], cfg["currency_default"]
            )
            BaseScraper(cfg).run(fc, db_kind, db)
        except Exception as exc:  # noqa: BLE001 — one dead store shouldn't block the rest
            print(f"!! {slug} failed: {exc} — continuing", file=sys.stderr)
    if db_kind == "pg" and db:
        db.close()

    # 2. Match across all retailers
    _run("Canonical matcher", "matching/matcher.py")

    # 3. Drops
    drops = fetch_drops(sb)
    print(f"\n[drops] {len(drops)} price drop(s) found")

    # 4. Email
    send_digest(drops)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
