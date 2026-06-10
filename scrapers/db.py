"""
Inch Ka · database helpers
==========================

Shared connection + retailer registration for scrapers.

By default uses the Supabase REST API (HTTPS) — works from any network.
Set INCHKA_DB=postgres in .env to force direct Postgres via DATABASE_URL.
"""

from __future__ import annotations

import os
import sys
from typing import Any, Literal, Optional

DbKind = Literal["pg", "sb"]
DbClient = Any


def _supabase_client():
    from supabase import create_client

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not (url and key):
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
    return create_client(url, key)


def _postgres_client():
    import psycopg2

    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL not set")
    return psycopg2.connect(url, connect_timeout=8)


def connect(dry_run: bool = False) -> tuple[Optional[DbKind], Optional[DbClient]]:
    """Return (kind, client). kind is 'pg' (psycopg2) or 'sb' (Supabase REST)."""
    if dry_run:
        return None, None

    mode = os.environ.get("INCHKA_DB", "auto").lower()
    has_sb = bool(os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))
    has_pg = bool(os.environ.get("DATABASE_URL"))

    if mode in ("pg", "postgres"):
        print("[db] using direct Postgres (INCHKA_DB=postgres)", file=sys.stderr)
        return "pg", _postgres_client()

    if mode in ("sb", "supabase"):
        print("[db] using Supabase API (INCHKA_DB=supabase)", file=sys.stderr)
        return "sb", _supabase_client()

    # auto — prefer Supabase API (no db.* host / port 5432 needed)
    if has_sb:
        print("[db] using Supabase API", file=sys.stderr)
        return "sb", _supabase_client()

    if has_pg:
        print("[db] using direct Postgres", file=sys.stderr)
        return "pg", _postgres_client()

    raise RuntimeError(
        "Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (recommended) "
        "or DATABASE_URL in .env"
    )


def ensure_retailer(
    db_kind: DbKind,
    db: DbClient,
    slug: str,
    name: str,
    base_url: str,
    currency: str = "AMD",
) -> None:
    """Make sure the retailer row exists before upsert_offer runs."""
    if db_kind == "pg":
        with db.cursor() as cur:
            cur.execute(
                """
                insert into inch_ka.retailers (slug, name, base_url, country, currency)
                values (%s, %s, %s, 'AM', %s)
                on conflict (slug) do update set
                  name = excluded.name,
                  base_url = excluded.base_url
                """,
                (slug, name, base_url, currency),
            )
        db.commit()
        return

    try:
        db.rpc(
            "inchka_ensure_retailer",
            {
                "p_slug": slug,
                "p_name": name,
                "p_base_url": base_url,
                "p_currency": currency,
            },
        ).execute()
    except Exception as exc:
        msg = str(exc)
        if "inchka_ensure_retailer" in msg or "PGRST202" in msg:
            raise RuntimeError(
                "Run migrations/0010_seed_all_retailers.sql and "
                "migrations/0011_scraper_grants.sql in the Supabase SQL editor."
            ) from exc
        raise
