"""
iStore scraper — thin shim over the factory engine.

Real logic: scrapers/base.py (BaseScraper). Config: scrapers/retailers_config.py
under the "istore" key. Kept so `python scrapers/istore/scraper.py` still works.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from base import BaseScraper            # noqa: E402
from retailers_config import get_config  # noqa: E402
from run_scraper import make_clients     # noqa: E402

SLUG = "istore"

if __name__ == "__main__":
    dry = "--dry-run" in sys.argv
    fc, db_kind, db = make_clients(dry)
    BaseScraper(get_config(SLUG)).run(fc, db_kind, db, dry_run=dry)
