"""
Inch Ka · spec & identity extraction
====================================

Pure functions (no I/O) that turn a raw listing title into the signals the
canonical matcher relies on: a normalized manufacturer part number (MPN),
a brand, and structured specs (RAM, storage, screen, CPU family).

Kept dependency-free so it can be unit-tested in isolation.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

# Known electronics brands we expect in the AM market. Extend as needed.
KNOWN_BRANDS = [
    "apple", "hp", "asus", "lenovo", "honor", "acer", "dell", "msi",
    "gigabyte", "huawei", "samsung", "xiaomi", "microsoft", "lg", "intel",
]

# A manufacturer model code: a 5+ char token mixing letters & digits, often
# trailing the title after a slash, e.g. "/A5CW0EA", "MX2X3", "21TF004RFW".
_MPN_TOKEN = re.compile(r"\b([A-Z0-9]{5,})\b")
_MPN_AFTER_SLASH = re.compile(r"/\s*([A-Z0-9][A-Z0-9\-/]{3,})", re.IGNORECASE)

# Handles both "16/512", "16/1", "32GB/1TB", "24GB/2TB", "16GB/512GB".
_RAM_STORAGE = re.compile(
    r"(\d{1,3})\s*(gb)?\s*/\s*(\d{1,4})\s*(tb|gb)?", re.IGNORECASE
)
_SCREEN = re.compile(r"(\d{2}(?:\.\d)?)\s*[\"”']")
_TB = re.compile(r"(\d(?:\.\d)?)\s*tb", re.IGNORECASE)
_GB = re.compile(r"(\d{1,4})\s*gb", re.IGNORECASE)


@dataclass
class Identity:
    brand: Optional[str] = None
    mpn: Optional[str] = None            # normalized: uppercase alphanumerics
    screen_in: Optional[float] = None
    ram_gb: Optional[int] = None
    storage_gb: Optional[int] = None
    cpu: Optional[str] = None
    tokens: set[str] = field(default_factory=set)


def normalize_mpn(value: str | None) -> Optional[str]:
    """Strip to uppercase alphanumerics — 'A5CW0EA@' / 'a5cw0ea' -> 'A5CW0EA'."""
    if not value:
        return None
    cleaned = re.sub(r"[^A-Za-z0-9]", "", value).upper()
    return cleaned or None


def detect_brand(title: str) -> Optional[str]:
    low = title.lower()
    for b in KNOWN_BRANDS:
        if re.search(rf"\b{re.escape(b)}\b", low):
            return b.capitalize() if b != "hp" else "HP"
    return None


def extract_mpn(title: str, fallback_sku: str | None = None) -> Optional[str]:
    """Best-effort MPN from the title; fall back to the retailer SKU."""
    m = _MPN_AFTER_SLASH.search(title)
    if m:
        return normalize_mpn(m.group(1))
    # Otherwise take the longest alphanumeric-mixed token in the title.
    candidates = [
        t for t in _MPN_TOKEN.findall(title.upper())
        if any(c.isdigit() for c in t) and any(c.isalpha() for c in t)
    ]
    if candidates:
        return normalize_mpn(max(candidates, key=len))
    return normalize_mpn(fallback_sku)


def extract_specs(title: str) -> dict:
    ram = storage = None
    m = _RAM_STORAGE.search(title)
    if m:
        ram = int(m.group(1))
        storage = int(m.group(3))
        unit = (m.group(4) or "").lower()
        # Normalize storage to GB. Explicit "tb", or a bare small number
        # (e.g. "16/1" = 1TB), means terabytes.
        if unit == "tb" or (unit == "" and storage <= 8):
            storage *= 1024
    screen = None
    s = _SCREEN.search(title)
    if s:
        screen = float(s.group(1))
    return {"ram_gb": ram, "storage_gb": storage, "screen_in": screen}


_STOP = {"laptop", "notebook", "w11", "w11h", "us", "kb", "the", "for"}


def tokenize(title: str) -> set[str]:
    raw = re.findall(r"[a-z0-9.]+", title.lower())
    return {t for t in raw if t not in _STOP and len(t) > 1}


def build_identity(title: str, brand: str | None = None,
                   sku: str | None = None) -> Identity:
    specs = extract_specs(title)
    return Identity(
        brand=brand or detect_brand(title),
        mpn=extract_mpn(title, sku),
        screen_in=specs["screen_in"],
        ram_gb=specs["ram_gb"],
        storage_gb=specs["storage_gb"],
        tokens=tokenize(title),
    )
