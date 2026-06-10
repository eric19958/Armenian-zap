"""
Zigzag scraper — thin shim over the factory engine.

The real logic lives in scrapers/base.py (BaseScraper) and the config lives in
scrapers/retailers_config.py under the "zigzag" key. This wrapper just keeps the
old `python scrapers/zigzag/scraper.py` entrypoint working.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from base import BaseScraper            # noqa: E402
from retailers_config import get_config  # noqa: E402
from run_scraper import make_clients     # noqa: E402

SLUG = "zigzag"

if __name__ == "__main__":
    dry = "--dry-run" in sys.argv
    fc, db_kind, db = make_clients(dry)
    BaseScraper(get_config(SLUG)).run(fc, db_kind, db, dry_run=dry)
