"""
Inch Ka · retailer registry
===========================

Each retailer is a pure-data config consumed by BaseScraper (base.py).
To onboard a new store / category: add a URL to its `categories` list.
No new Python required — the factory engine + matcher do the rest.

Coverage philosophy
-------------------
A price-comparison engine only compares products that exist in 2+ stores.
So every major category must be scraped from EVERY store that carries it,
otherwise a product is single-store and has nothing to compare against.
This registry lists, per retailer, category URLs across:
  • Electronics: phones, tablets, laptops, watches, TVs, gaming
  • Home: refrigerators, washing machines, air conditioners, kitchen, vacuums
Category hints are inferred from each URL (see category_hints.py) and stored
in offer raw JSON for the matcher.

Config keys
-----------
slug, name, base_url, currency_default, default_brand
categories          list of category URL templates ("{page}" optional)
pagination          {"start": int, "count": int}  (count>1 needs "{page}")
extraction_prompt   instruction for Firecrawl's LLM extraction
code_fields         priority list of extracted fields holding the model code
code_from_title     optional regex; fallback when code_fields are empty
reject_codes        values to treat as "no code" (e.g. "none")
reject_numeric_code True → a purely numeric code is an internal id, not an MPN
wait_for            ms to let the page render before extraction
"""

from __future__ import annotations

# Max listing pages per category. Engine stops earlier on an empty page.
MAX_PAGES_PER_CATEGORY = 50

# Generic, category-agnostic extraction instruction. Works for phones, tablets,
# laptops, watches, TVs — anything on a listing page.
_GENERIC_PROMPT = (
    "Extract EVERY product listed on this page (phones, tablets, laptops, "
    "watches, TVs, refrigerators, washing machines, air conditioners, kitchen "
    "appliances, vacuum cleaners — whatever the page shows). For each product return: name "
    "(full title, including storage/RAM/size/chip if shown), brand, price as a "
    "number in AMD (strip spaces, commas and any currency symbol such as ֏ / "
    "դր / AMD; use the CASH price if both cash and installment prices are "
    "shown), old_price as a number if a crossed-out original price is shown "
    "(else 0), currency, product_url (absolute), image_url (the main product "
    "photo's src, absolute if possible), in_stock (true if available, false if "
    "preorder/out of stock), and the model/part code (manufacturer code, "
    "vendor code, or Apple part number). Return ONLY real products — never "
    "accessories such as cases, chargers, cables, glass protectors, straps or "
    "stands."
)

# Apple-only resellers get an Apple-specific nudge (helps grab the part number).
_APPLE_PROMPT = _GENERIC_PROMPT + (
    " This is an Apple store; the Apple part number (e.g. MG8H4AF/A, MDH84RU/A) "
    "is the most important code — capture it from the title or product code."
)

RETAILERS: dict[str, dict] = {
    # ============================================================== AllSell
    # Largest catalogue in Armenia (Magento). Per-brand phone pages + tablets,
    # laptops, watches, TVs.
    "allsell": {
        "slug": "allsell",
        "name": "AllSell",
        "base_url": "https://allsell.am",
        "currency_default": "AMD",
        "categories": [
            # phones (per brand — confirmed working)
            "https://allsell.am/am/phones/apple",
            "https://allsell.am/am/phones/samsung",
            "https://allsell.am/am/phones/xiaomi",
            "https://allsell.am/am/phones/honor",
            "https://allsell.am/am/phones/google-pixel",
            "https://allsell.am/am/phones/realme",
            "https://allsell.am/am/phones/oneplus",
            "https://allsell.am/am/phones/nothing-phone",
            # laptops (confirmed slug); tablets best-effort under same section
            "https://allsell.am/am/computer-equipment/notebooks",
            "https://allsell.am/am/computer-equipment/tablets",
            # home & kitchen (Magento — verify slugs if a page is empty)
            "https://allsell.am/am/kitchen-appliances/refrigerators",
            "https://allsell.am/am/kitchen-appliances/freezers",
            "https://allsell.am/am/home-appliances/air-conditioners",
            "https://allsell.am/am/home-appliances/washing-machines",
            "https://allsell.am/am/home-appliances/vacuum-cleaners",
            "https://allsell.am/am/kitchen-appliances/microwaves",
            "https://allsell.am/am/kitchen-appliances/dishwashers",
        ],
        "pagination": {"start": 1, "count": MAX_PAGES_PER_CATEGORY},
        "page_param": "p",   # Magento ?p=2,3,...
        "extraction_prompt": _GENERIC_PROMPT,
        # allsell prints a short Apple code in the title (MGED4, MW123); reject
        # internal numeric ids and fall back to the embedded code.
        "code_fields": ["code", "sku"],
        "reject_numeric_code": True,
        "code_from_title": r"\b([A-Z0-9]{5,12})\b",
        "wait_for": 3000,
    },
    # ============================================================ Yerevan Mobile
    "yerevanmobile": {
        "slug": "yerevanmobile",
        "name": "Yerevan Mobile",
        "base_url": "https://www.yerevanmobile.am",
        "currency_default": "AMD",
        "categories": [
            "https://www.yerevanmobile.am/am/electronics/phones.html",
            "https://www.yerevanmobile.am/am/electronics/tablets.html",
            "https://www.yerevanmobile.am/am/electronics/watches.html",
            "https://www.yerevanmobile.am/am/televisions-audio-and-video-equipment/televisions.html",
            # large home appliances (Magento)
            "https://www.yerevanmobile.am/am/large-home-appliances/refrigerators.html",
            "https://www.yerevanmobile.am/am/large-home-appliances/washing-machines.html",
            "https://www.yerevanmobile.am/am/large-home-appliances/air-conditioners.html",
            "https://www.yerevanmobile.am/am/large-home-appliances/vacuum-cleaners.html",
        ],
        "pagination": {"start": 1, "count": MAX_PAGES_PER_CATEGORY},
        "page_param": "p",   # Magento ?p=2,3,...
        "extraction_prompt": _GENERIC_PROMPT,
        # Magento; cash price = the `Կանխիկ` value. Storage lives behind a JS
        # swatch so listing storage is often absent — matcher falls back to
        # brand + model when storage is unknown.
        "code_fields": ["code", "sku"],
        "reject_numeric_code": True,
        "wait_for": 3000,
    },
    # ================================================================ Vega
    "vega": {
        "slug": "vega",
        "name": "Vega",
        "base_url": "https://vega.am",
        "currency_default": "AMD",
        "categories": [
            "https://vega.am/en/home-appliances/phones-and-gadgets/smart-phones/",
            "https://vega.am/en/home-appliances/computers-and-accessories/notebooks",
            "https://vega.am/en/home-appliances/phones-and-gadgets/tablets",
            "https://vega.am/en/home-appliances/phones-and-gadgets/smart-watches",
            "https://vega.am/en/home-appliances/tv-and-audio/televisions",
            # home & kitchen (OpenCart)
            "https://vega.am/en/large-home-appliances/refrigerators/",
            "https://vega.am/en/home-appliances/major-home-appliances/washing-machines/",
            "https://vega.am/en/home-appliances/cooling-heating/air-conditioners",
            "https://vega.am/en/home-appliances/cooling-heating/multi-split-air-conditioners",
            "https://vega.am/en/home-appliances/kitchen-appliances/microwaves/",
            "https://vega.am/en/home-appliances/kitchen-appliances/dishwashers/",
            "https://vega.am/en/home-appliances/cleaning/vacuum-cleaners/",
        ],
        "pagination": {"start": 1, "count": MAX_PAGES_PER_CATEGORY},
        "page_param": "page",   # OpenCart ?page=2,3,...
        "extraction_prompt": _GENERIC_PROMPT,
        "code_fields": ["code", "vendor_code"],
        "reject_codes": ["none", "null", "n/a", ""],
        "wait_for": 3000,
    },
    # ============================================================== Eldorado
    "eldorado": {
        "slug": "eldorado",
        "name": "Eldorado",
        "base_url": "https://eldorado.am",
        "currency_default": "AMD",
        "categories": [
            "https://eldorado.am/am/phones/tablets-and-smartphones/smartphones",
            "https://eldorado.am/am/phones/tablets-and-smartphones/tablets",
            "https://eldorado.am/am/notebooks-and-computers/notebooks",
            "https://eldorado.am/am/tv-and-video/televisions",
            # large home appliances
            "https://eldorado.am/am/large-home-appliances/large-kitchen-appliences/refrigerators",
            "https://eldorado.am/am/large-home-appliances/washing-machines-and-dryers/washing-machines",
            "https://eldorado.am/am/large-home-appliances/climate/air-conditioners",
            "https://eldorado.am/am/large-home-appliances/large-kitchen-appliences/microwaves",
            "https://eldorado.am/am/large-home-appliances/large-kitchen-appliences/dishwashers",
            "https://eldorado.am/am/large-home-appliances/cleaning-equipments/vacuum-cleaners",
        ],
        "pagination": {"start": 1, "count": MAX_PAGES_PER_CATEGORY},
        "page_param": "p",   # Magento ?p=2,3,...
        "extraction_prompt": _GENERIC_PROMPT,
        "code_fields": ["code", "sku"],
        "reject_codes": ["none", "null", "n/a", ""],
        "code_from_title": r"\(([A-Z0-9/\-]{5,})\)\s*$",
        "wait_for": 3000,
    },
    # ============================================================== RedStore
    "redstore": {
        "slug": "redstore",
        "name": "RedStore",
        "base_url": "https://redstore.am",
        "currency_default": "AMD",
        "categories": [
            "https://redstore.am/categories/smartphones?view=all",
            "https://redstore.am/categories/tablets?view=all",
            "https://redstore.am/categories/notebooks?view=all",
            "https://redstore.am/categories/smartwatches?view=all",
            # home (best-effort — RedStore category slugs)
            "https://redstore.am/categories/refrigerators?view=all",
            "https://redstore.am/categories/washing-machines?view=all",
            "https://redstore.am/categories/air-conditioners?view=all",
            "https://redstore.am/categories/vacuum-cleaners?view=all",
        ],
        "pagination": {"start": 1, "count": 1},
        "extraction_prompt": _GENERIC_PROMPT,
        "code_fields": ["code", "sku"],
        "reject_codes": ["none", "null", "n/a", ""],
        "wait_for": 3000,
    },
    # ============================================================ MobileCentre
    "mobilecentre": {
        "slug": "mobilecentre",
        "name": "Mobile Centre",
        "base_url": "https://www.mobilecentre.am",
        "currency_default": "AMD",
        "categories": [
            "https://www.mobilecentre.am/category/phones/138/{page}/",
            "https://www.mobilecentre.am/category/tablets/139/{page}/",
            "https://www.mobilecentre.am/category/computers/144/{page}/",
            "https://www.mobilecentre.am/category/smart-watches/141/175/{page}/",
            "https://www.mobilecentre.am/category/tvs/143/{page}/",
        ],
        # Trailing path segment is the page index (0, 1, 2, …).
        "pagination": {"start": 0, "count": MAX_PAGES_PER_CATEGORY},
        "page_param": "path",
        "extraction_prompt": _GENERIC_PROMPT,
        "code_fields": ["code"],
        "code_from_title": r"\b([A-Z0-9]{5,12})\b\s*$",
        "wait_for": 3000,
    },
    # ================================================================ Zigzag
    "zigzag": {
        "slug": "zigzag",
        "name": "Zigzag",
        "base_url": "https://www.zigzag.am",
        "currency_default": "AMD",
        "categories": [
            "https://www.zigzag.am/en/phones-and-communication.html",
            "https://www.zigzag.am/en/computers-notebooks-tablets/tablets.html",
            "https://www.zigzag.am/en/computers-notebooks-tablets/notebooks/notebooks-for-office.html",
            "https://www.zigzag.am/en/phones-and-communication/smart-watches.html",
            # home & kitchen (Magento)
            "https://www.zigzag.am/en/kitchen-appliances.html",
            "https://www.zigzag.am/en/air-conditioning-equipment/air-conditioners.html",
            "https://www.zigzag.am/en/large-household-appliances/washing-machines-and-drying-machines.html",
            "https://www.zigzag.am/en/cleaning-equipment/vacuum-cleaners.html",
        ],
        "pagination": {"start": 1, "count": MAX_PAGES_PER_CATEGORY},
        "page_param": "p",   # Magento ?p=2,3,...
        "extraction_prompt": _GENERIC_PROMPT,
        "code_fields": ["code", "sku"],
        "reject_numeric_code": True,
        "code_from_title": r"/\s*([A-Za-z0-9]{4,})\s*$",
        "wait_for": 2500,
    },
    # ================================================================ iStore
    # Apple Authorised Reseller. Filter pages per Mac/iPhone/iPad family.
    "istore": {
        "slug": "istore",
        "name": "iStore",
        "base_url": "https://istore.am",
        "currency_default": "AMD",
        "default_brand": "Apple",
        "categories": [
            "https://istore.am/filter/mac-10/macbook-pro-11",
            "https://istore.am/filter/mac-10/macbook-air-12",
            "https://istore.am/filter/mac-10/macbook-air-m5-152",
            "https://istore.am/filter/iphone-1",
            "https://istore.am/filter/ipad-2",
        ],
        "pagination": {"start": 1, "count": 1},
        "extraction_prompt": _APPLE_PROMPT,
        "code_fields": ["code", "product_code"],
        "wait_for": 3500,
    },
    # ================================================================ iSpace
    # Apple Premium Reseller (it4profit platform). Storage is in the title,
    # which makes Apple matching clean.
    "ispace": {
        "slug": "ispace",
        "name": "iSpace",
        "base_url": "https://ispace.am",
        "currency_default": "AMD",
        "default_brand": "Apple",
        "categories": [
            "https://ispace.am/en/category/iphone",
            "https://ispace.am/en/category/ipad",
            "https://ispace.am/en/category/macbook-air",
            "https://ispace.am/en/category/macbook-pro",
            "https://ispace.am/en/category/apple-watch",
            "https://ispace.am/en/category/airpods",
        ],
        "pagination": {"start": 1, "count": 1},
        "extraction_prompt": _APPLE_PROMPT,
        "code_fields": ["code", "product_code"],
        "code_from_title": r"/\s*([A-Z0-9]{4,})\b",
        "wait_for": 4000,
    },
}


def get_config(slug: str) -> dict:
    if slug not in RETAILERS:
        raise KeyError(f"Unknown retailer '{slug}'. Known: {', '.join(RETAILERS)}")
    return RETAILERS[slug]
