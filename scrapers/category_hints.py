"""
Inch Ka · canonical category taxonomy + URL → hint inference.

Used by the scraper (category hint stored in offer raw for the matcher) and
documented here as the single source of truth for which verticals we cover.
"""

from __future__ import annotations

import re

# Display order on the public site (frontend mirrors this in lib/categories.ts).
CATEGORY_ORDER: list[str] = [
    "smartphone",
    "tablet",
    "smartwatch",
    "notebook",
    "desktop",
    "tv",
    "gaming",
    "printer",
    "refrigerator",
    "washing_machine",
    "air_conditioner",
    "kitchen_appliance",
    "vacuum_cleaner",
    "home_appliance",
    "accessory",
    "other",
]

# (regex on lowercased URL path, canonical category key)
_URL_RULES: list[tuple[re.Pattern[str], str]] = [
    # Electronics
    (re.compile(r"smart.?phone|/phones|iphone|հեռախոս|mobile.?phone", re.I), "smartphone"),
    (re.compile(r"tablet|պլանշետ|ipad", re.I), "tablet"),
    (re.compile(r"smart.?watch|apple-watch|/watches|ժամացույց", re.I), "smartwatch"),
    (re.compile(r"airpods|earbuds|headphone", re.I), "accessory"),
    (re.compile(r"notebook|laptop|macbook|նոթբուք|computers/", re.I), "notebook"),
    (re.compile(r"desktop|all-in-one", re.I), "desktop"),
    (re.compile(r"television|/tv[s/]|հեռուստացույց", re.I), "tv"),
    (re.compile(r"playstation|xbox|nintendo|gaming|կոնսոլ", re.I), "gaming"),
    (re.compile(r"printer|տպիչ|scanner", re.I), "printer"),
    # Home — large appliances
    (re.compile(r"refrigerat|freezer|սառնարան|սառցարան|wine-ref", re.I), "refrigerator"),
    (re.compile(r"washing|washer|dryer|լվացք|չորանոց", re.I), "washing_machine"),
    (
        re.compile(
            r"air-condition|cooling-heating|climate|օդորակիչ|կոնդիցիոներ|"
            r"air-conditioning",
            re.I,
        ),
        "air_conditioner",
    ),
    # Home — kitchen
    (
        re.compile(
            r"kitchen|microwave|dishwasher|oven|cooker|hob|hood|blender|kettle|"
            r"թեյնիկ|միկրոալիք|վառարան|խոհանոց",
            re.I,
        ),
        "kitchen_appliance",
    ),
    (re.compile(r"vacuum|փոշեկուլ|robot-vacuum", re.I), "vacuum_cleaner"),
    (
        re.compile(r"home-appliance|large-home|major-home|household", re.I),
        "home_appliance",
    ),
]


def hint_from_url(url: str) -> str | None:
    """Best-effort canonical category from a listing-page URL."""
    path = url.lower()
    for pattern, category in _URL_RULES:
        if pattern.search(path):
            return category
    return None
