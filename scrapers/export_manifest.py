#!/usr/bin/env python3
"""Print retailer scrape manifest as JSON (for the admin ops dashboard)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from retailers_config import RETAILERS  # noqa: E402

if __name__ == "__main__":
    manifest = {
        slug: {
            "name": cfg["name"],
            "base_url": cfg["base_url"],
            "categories": cfg["categories"],
            "category_count": len(cfg["categories"]),
        }
        for slug, cfg in RETAILERS.items()
    }
    print(json.dumps(manifest, ensure_ascii=False))
