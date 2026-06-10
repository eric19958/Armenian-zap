"""
Inch Ka · canonical product signature
======================================

The heart of a price-comparison engine (zap.co.il style): collapse the same
physical product, named differently by every retailer, onto ONE canonical
product so its offers can be compared side by side.

Each retailer writes the same phone wildly differently:

    "Apple iPhone 17 Pro (eSim)"                               (yerevanmobile)
    "iPhone 17 Pro"                                            (allsell)
    "Smart phone APPLE iPhone 17 Pro 256GB (A3523) (MG8H4AF/A)" (vega)

`signature()` turns each title into a stable key:

    brand | model-tokens | storage

so the first two collapse together and the 256GB vega listing forms its own
variant — variants are split by STORAGE (a 256GB and a 512GB are different
products and must not share a price), while colour is ignored (Black and
Blue of the same model/storage are one product).

Pure, dependency-free, multilingual (EN / Armenian / Russian noise words).
"""

from __future__ import annotations

import re

# --- brand canonicalization -------------------------------------------------
# Map every line / sub-brand / spelling to one manufacturer key. Sub-brands
# (Redmi, Poco, Galaxy, iPhone) keep their LINE word as a model token; only the
# manufacturer name is normalized here and stripped from the model tokens.
BRAND_ALIASES: dict[str, str] = {
    "apple": "apple", "iphone": "apple", "ipad": "apple", "macbook": "apple",
    "airpods": "apple", "imac": "apple",
    "samsung": "samsung", "galaxy": "samsung",
    "xiaomi": "xiaomi", "redmi": "xiaomi", "poco": "xiaomi", "mi": "xiaomi",
    "huawei": "huawei", "honor": "honor", "google": "google", "pixel": "google",
    "oneplus": "oneplus", "realme": "realme", "oppo": "oppo", "vivo": "vivo",
    "nokia": "nokia", "tecno": "tecno", "infinix": "infinix", "ulefone": "ulefone",
    "lenovo": "lenovo", "hp": "hp", "asus": "asus", "acer": "acer", "dell": "dell",
    "msi": "msi", "lg": "lg", "sony": "sony", "tcl": "tcl", "hisense": "hisense",
    "nothing": "nothing", "bq": "bq", "microsoft": "microsoft",
}

# Manufacturer words that are redundant with a kept line token and should be
# dropped from the model tokens (the brand field carries them).
_DROP_BRAND_WORDS = {
    "apple", "samsung", "xiaomi", "huawei", "lenovo", "asus", "acer", "dell",
    "msi", "sony", "microsoft",
}

# Generic prefixes / category words (EN + HY + RU transliteration).
_PREFIX_NOISE = {
    "smartphone", "smart", "phone", "smart-phone", "notebook", "laptop",
    "tablet", "planshet", "smartwatch", "watch", "tv", "television",
    "հեռախոս", "սմարթֆոն", "պլանշետ", "նոթբուք", "հեռուստացույց",
    "telefon", "phones",
}

# Region / connectivity-packaging / marketing noise (NOT 4g/5g — those can be
# genuine model distinctions, e.g. "Redmi 15 4G" vs "Redmi 15 5G").
_MISC_NOISE = {
    "esim", "esim+esim", "ru", "eu", "global", "international", "intl", "cn",
    "new", "version", "model", "with", "and", "for", "the", "series",
    "2021", "2022", "2023", "2024", "2025", "2026",
    "dual", "sim", "nano", "inch", "wi", "fi", "wifi", "cellular", "gps", "lte",
}

# Colours / finishes (single tokens; multi-word colours are handled token-wise,
# e.g. "Cosmic Orange" → drop "cosmic" + "orange", "Dark Green" → "dark"+"green").
_COLORS = {
    "black", "white", "blue", "green", "red", "gold", "silver", "gray", "grey",
    "pink", "purple", "violet", "orange", "yellow", "midnight", "starlight",
    "graphite", "titanium", "cosmic", "natural", "desert", "ultramarine",
    "teal", "cyan", "lavender", "mint", "sky", "navy", "dark", "light", "space",
    "phantom", "aurora", "ocean", "lake", "soft", "deep", "cream", "beige",
    "bronze", "copper", "rose", "jet", "coral", "lime", "sand", "stone",
    "charcoal", "obsidian", "pearl", "ivory", "amber", "emerald", "sapphire",
    "marble", "frost", "glacier", "shadow", "carbon", "steel",
    "սև", "սպիտակ", "կապույտ", "կանաչ", "կարմիր", "ոսկեգույն", "մոխրագույն",
}

# Storage / RAM patterns to pull out (and remove from model tokens).
_RAM_SLASH = re.compile(r"(\d{1,3})\s*(?:gb)?\s*[/+]\s*(\d{1,4})\s*(tb|gb)?\b", re.IGNORECASE)
_BARE_TB = re.compile(r"\b(\d(?:\.\d)?)\s*tb\b", re.IGNORECASE)
_BARE_GB = re.compile(r"\b(\d{2,4})\s*gb\b", re.IGNORECASE)
_STORAGE_TOKEN = re.compile(r"^\d{1,4}(gb|tb)$", re.IGNORECASE)

# Manufacturer part-number-ish tokens: long alphanumeric mixes (A3523, MG8H4AF,
# 25078PC3EG, NXJEMER001) — noise for model identity.
_MPN_LIKE = re.compile(r"^(?=[a-z0-9/]*\d)(?=[a-z0-9/]*[a-z])[a-z0-9/]{5,}$", re.IGNORECASE)


def canonical_brand(title: str) -> str | None:
    low = title.lower()
    for word in re.findall(r"[a-z]+", low):
        if word in BRAND_ALIASES:
            return BRAND_ALIASES[word]
    return None


def extract_storage_gb(title: str) -> int | None:
    """Best storage size in GB, or None. '4GB/64GB'→64, '6+128GB'→128,
    '16/1'→1024, '256GB'→256, '1TB'→1024."""
    m = _RAM_SLASH.search(title)
    if m:
        size = int(m.group(2))
        unit = (m.group(3) or "").lower()
        if unit == "tb" or (unit == "" and size <= 8):  # "16/1" = 1TB
            size *= 1024
        return size
    m = _BARE_TB.search(title)
    if m:
        return int(float(m.group(1)) * 1024)
    # bare GB: take the largest (storage, not RAM)
    gbs = [int(x) for x in _BARE_GB.findall(title)]
    if gbs:
        return max(gbs)
    return None


def _strip_noise(title: str) -> str:
    # drop parentheticals: (eSim), (Cosmic Orange), (A3523), (MG8H4AF/A)
    t = re.sub(r"\([^)]*\)", " ", title)
    # drop trailing /CODE manufacturer refs: "/MHRV4"
    t = re.sub(r"/\s*[A-Za-z0-9]{4,}", " ", t)
    return t


def model_tokens(title: str) -> list[str]:
    t = _strip_noise(title).lower()
    # Remove RAM/storage spans entirely so their digits ("6" in "6+128GB",
    # "4" in "4GB/64GB") never leak into the model tokens. Storage itself is
    # recovered separately by extract_storage_gb() on the original title.
    t = _RAM_SLASH.sub(" ", t)
    t = _BARE_TB.sub(" ", t)
    t = _BARE_GB.sub(" ", t)
    # Preserve the meaningful "+" suffix (Pro+ ≠ Pro, S25+ ≠ S25) as a token.
    t = t.replace("+", " plus ")
    raw = re.findall(r"[a-z0-9ա-ֆ]+", t)
    out: list[str] = []
    for tok in raw:
        if tok in _DROP_BRAND_WORDS or tok in _PREFIX_NOISE or tok in _MISC_NOISE:
            continue
        if tok in _COLORS:
            continue
        if _STORAGE_TOKEN.match(tok):       # 64gb, 256gb, 1tb
            continue
        if re.match(r"^\d{1,2}c$", tok):     # CPU-core counts: 10c, 8c, 14c
            continue
        if tok.isdigit() and len(tok) >= 5:  # stray long numbers (ids)
            continue
        if _MPN_LIKE.match(tok) and not tok.isalpha() and len(tok) >= 6:
            # alphanumeric part-number noise (A3523, 25078PC3EG) — but keep
            # short model codes like "a07", "s25", "c85", "m8".
            continue
        out.append(tok)
    return out


def signature(title: str) -> str:
    """Stable canonical key: 'brand|sorted-model-tokens|storage'."""
    brand = canonical_brand(title) or "?"
    toks = sorted(set(model_tokens(title)))
    storage = extract_storage_gb(title)
    return f"{brand}|{' '.join(toks)}|{storage if storage else '?'}"


def display_name(title: str) -> str:
    """A clean, human title for the canonical product, derived from the raw
    one: drop parentheticals, part-numbers and the 'Smart phone' prefix, keep
    brand + model (+ storage)."""
    t = _strip_noise(title)
    t = re.sub(r"(?i)\bsmart[\s-]*phone\b", "", t)
    t = re.sub(r"\s+", " ", t).strip(" -·,")
    return t or title.strip()
