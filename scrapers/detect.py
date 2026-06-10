"""
Inch Ka · URL detection
=======================

Given any category/listing URL, figure out which retailer config applies and
build a one-off scrape config (single category, full pagination).
"""

from __future__ import annotations

import copy
import re
from urllib.parse import urlparse

from retailers_config import RETAILERS

# Default safety cap — pagination stops earlier when a page is empty.
DEFAULT_MAX_PAGES = 50


def _host(url: str) -> str:
    return urlparse(url).netloc.lower().removeprefix("www.")


def _hosts_match(a: str, b: str) -> bool:
    a, b = a.lower().removeprefix("www."), b.lower().removeprefix("www.")
    return a == b or a.endswith("." + b) or b.endswith("." + a)


def detect_retailer(url: str) -> tuple[str, dict]:
    """
    Return (slug, config) for scraping `url`.

    Known stores: match by domain against retailers_config.
    Unknown store: synthesize a generic config from the URL hostname.
    """
    target_host = _host(url)

    for slug, cfg in RETAILERS.items():
        base_host = _host(cfg["base_url"])
        if _hosts_match(target_host, base_host):
            return slug, _config_for_url(cfg, url)

    # Ad-hoc retailer from domain (e.g. newsite.am → slug "newsite")
    parts = target_host.split(".")
    slug = re.sub(r"[^a-z0-9]+", "", parts[0]) or "unknown"
    name = slug.replace("-", " ").title()
    scheme = urlparse(url).scheme or "https"
    base_url = f"{scheme}://{urlparse(url).netloc}"

    generic = {
        "slug": slug,
        "name": name,
        "base_url": base_url,
        "currency_default": "AMD",
        "categories": [url],
        "pagination": {"start": 1, "count": DEFAULT_MAX_PAGES},
        "page_param": "p",
        "extraction_prompt": RETAILERS["zigzag"]["extraction_prompt"],
        "code_fields": ["code", "sku"],
        "reject_numeric_code": True,
        "wait_for": 3000,
    }
    return slug, generic


def _config_for_url(base_cfg: dict, url: str) -> dict:
    """Clone retailer config but scrape only the given URL (with pagination)."""
    cfg = copy.deepcopy(base_cfg)
    cfg["categories"] = [_normalize_category_url(url, cfg)]

    pag = cfg.setdefault("pagination", {})
    if pag.get("count", 1) <= 1 and (
        "{page}" in cfg["categories"][0] or cfg.get("page_param")
    ):
        pag["count"] = DEFAULT_MAX_PAGES
    elif pag.get("count", 1) < 10 and cfg.get("page_param"):
        pag["count"] = max(pag.get("count", 1), DEFAULT_MAX_PAGES)

    return cfg


def _normalize_category_url(url: str, cfg: dict) -> str:
    """
    If the retailer paginates via a trailing path index (Mobile Centre style),
    rewrite .../138/3/ → .../138/{page}/ so the engine can walk pages.
    """
    if cfg.get("page_param") != "path":
        return url

    m = re.search(r"/(\d+)/?$", url.rstrip("/"))
    if not m:
        return url
    return re.sub(r"/\d+/?$", "/{page}/", url.rstrip("/")) + (
        "/" if url.endswith("/") else ""
    )
