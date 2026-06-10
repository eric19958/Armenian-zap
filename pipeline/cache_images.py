"""
Inch Ka · image cache
=====================

Self-hosts product images. Instead of the frontend hot-linking each retailer's
CDN (which breaks on referer/hotlink protection, rate limits and stale URLs),
this script downloads every product image once, uploads it to the Supabase
Storage bucket `product-images`, and rewrites inch_ka.offers.image_url /
inch_ka.products.image_url to the stable public Storage URL.

Idempotent + resumable: rows whose image_url already points at our bucket are
skipped, so you can re-run it any time (and the daily pipeline can call it).

    python pipeline/cache_images.py            # cache everything outstanding
    python pipeline/cache_images.py --limit 50 # small test batch
    python pipeline/cache_images.py --workers 12

Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env (service role is
required to write to Storage and bypass RLS).
"""

from __future__ import annotations

import argparse
import hashlib
import mimetypes
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse

import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

BUCKET = "product-images"
SCHEMA = "inch_ka"

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
PUBLIC_PREFIX = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/"

# Browser-like headers defeat most hot-link / bot blocks. Referer is set per
# request to the image's own origin, which is what a real product page sends.
BASE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
}

EXT_BY_CTYPE = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/avif": ".avif",
    "image/svg+xml": ".svg",
}


def sb_client():
    return create_client(SUPABASE_URL, os.environ["SUPABASE_SERVICE_ROLE_KEY"])


def already_cached(url: str | None) -> bool:
    return bool(url) and url.startswith(PUBLIC_PREFIX)


def object_path(remote_url: str, ext: str) -> str:
    """Stable, deduplicated path. Identical source URLs map to the same object,
    so re-runs and shared images never duplicate storage."""
    host = (urlparse(remote_url).hostname or "site").replace("www.", "")
    digest = hashlib.sha1(remote_url.encode("utf-8")).hexdigest()
    return f"{host}/{digest}{ext}"


def fetch_outstanding(sb, limit: int | None):
    """Distinct remote image URLs still pointing at a retailer CDN, across both
    offers and products."""
    urls: set[str] = set()
    for table in ("offers", "products"):
        q = sb.schema(SCHEMA).table(table).select("image_url").not_.is_("image_url", "null")
        # PostgREST can't express "not startswith", so we filter in Python.
        rows = q.execute().data or []
        for r in rows:
            u = r.get("image_url")
            if u and not already_cached(u):
                urls.add(u)
    out = sorted(urls)
    return out[:limit] if limit else out


def cache_one(remote_url: str) -> tuple[str, str | None, str | None]:
    """Download + upload one image. Returns (remote, public_url|None, error|None)."""
    try:
        origin = urlparse(remote_url)
        headers = dict(BASE_HEADERS)
        headers["Referer"] = f"{origin.scheme}://{origin.hostname}/"
        resp = requests.get(remote_url, headers=headers, timeout=25)
        if resp.status_code != 200 or not resp.content:
            return remote_url, None, f"http {resp.status_code}"

        ctype = (resp.headers.get("content-type") or "").split(";")[0].strip().lower()
        ext = EXT_BY_CTYPE.get(ctype)
        if not ext:  # fall back to the URL extension, else .jpg
            guessed = os.path.splitext(urlparse(remote_url).path)[1].lower()
            ext = guessed if guessed in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"} else ".jpg"
        if not ctype or not ctype.startswith("image/"):
            ctype = mimetypes.types_map.get(ext, "image/jpeg")

        path = object_path(remote_url, ext)
        sb = _thread_sb()
        sb.storage.from_(BUCKET).upload(
            path,
            resp.content,
            {"content-type": ctype, "upsert": "true", "cache-control": "31536000"},
        )
        return remote_url, PUBLIC_PREFIX + path, None
    except Exception as exc:  # noqa: BLE001
        return remote_url, None, str(exc)[:160]


# one Supabase client per worker thread (clients are not guaranteed thread-safe)
import threading

_local = threading.local()


def _thread_sb():
    if not getattr(_local, "sb", None):
        _local.sb = sb_client()
    return _local.sb


def apply_mapping(sb, remote_url: str, public_url: str) -> None:
    for table in ("offers", "products"):
        sb.schema(SCHEMA).table(table).update({"image_url": public_url}).eq(
            "image_url", remote_url
        ).execute()


def main() -> int:
    ap = argparse.ArgumentParser(description="Inch Ka · cache product images to Supabase Storage")
    ap.add_argument("--limit", type=int, default=None, help="cache at most N images (test runs)")
    ap.add_argument("--workers", type=int, default=8, help="parallel download/upload workers")
    args = ap.parse_args()

    sb = sb_client()
    todo = fetch_outstanding(sb, args.limit)
    print(f"[cache] {len(todo)} image(s) to cache → bucket '{BUCKET}'")
    if not todo:
        print("[cache] nothing to do — everything already self-hosted.")
        return 0

    ok = fail = 0
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(cache_one, u): u for u in todo}
        for i, fut in enumerate(as_completed(futures), 1):
            remote, public, err = fut.result()
            if public:
                try:
                    apply_mapping(sb, remote, public)
                    ok += 1
                except Exception as exc:  # noqa: BLE001
                    fail += 1
                    print(f"  ! db update failed for {remote[:70]}: {exc}")
            else:
                fail += 1
                print(f"  ! {err}  {remote[:90]}")
            if i % 50 == 0:
                print(f"  … {i}/{len(todo)} processed (ok={ok}, fail={fail})")

    print(f"[cache] done — {ok} cached, {fail} failed")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
