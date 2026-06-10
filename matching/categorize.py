"""
Inch Ka · automatic product categorizer
========================================

Pure, dependency-free classifier that decides a product's category from its
title. Retailer category pages bundle accessories in with the real products
(e.g. allsell's /am/phones lists phone cases, chargers and cables alongside
phones), so trusting the scraped category alone pollutes "smartphone" with
hundreds of accessories. This module fixes that at the source.

Design:
  • ACCESSORY is detected first and always wins — a phone case is an accessory
    no matter which category page it appeared on.
  • Otherwise a strong, specific keyword maps the title to a product category.
  • If nothing is confident, we fall back to the scraped `hint` (which came
    from the category URL and is reliable for genuine products), then "other".

Bilingual: matches English and Armenian (Eastern) terms seen on AM retailers.
Kept I/O-free so it is unit-testable and usable from both the matcher and a
one-off backfill.
"""

from __future__ import annotations

import re

# --- accessory signals (highest priority; override any scraped category) ----
# Deliberately broad: these words essentially never appear in a genuine
# phone/laptop/TV product name, so matching them is safe.
_ACCESSORY = re.compile(
    r"(case|cover|protector|tempered|screen\s*protect|charger|charging|adapter|adaptor|"
    r"\bcable\b|\bcord\b|holder|tripod|selfie|lanyard|strap|\bband\b|power\s*bank|powerbank|"
    r"earbud|\bbuds\b|\btws\b|earphone|headphone|headset|airpod|stylus|keyboard|\bmouse\b|sleeve|\bbag\b|"
    r"wallet|magsafe|pop\s*socket|popsocket|keychain|\bgrip\b|\bring\b|\bfilm\b|\bmount\b|"
    r"\bdock\b|card\s*holder|"
    # Armenian
    r"Պատյան|Ապակի|Լիցքավոր|Մալուխ|\bլար\b|ուսագոտի|Սելֆ|ձող|բռնիչ|Ադապտ|ականջակ|"
    r"Հոլդեր|պահոց|Քարտապանակ|մարտկոց|Պահպանիչ|Մատիտ|Ստենդ|թաղանթ)",
    re.IGNORECASE,
)

# --- product-type signals (checked in priority order) -----------------------
# Order matters: a "Galaxy Tab" / "Galaxy Watch" must resolve before the bare
# "phone/galaxy" smartphone rule.
_TYPE_RULES: list[tuple[str, re.Pattern]] = [
    ("notebook", re.compile(
        r"(laptop|notebook|macbook|ultrabook|chromebook|vivobook|zenbook|ideapad|thinkpad|"
        r"probook|elitebook|nitro|predator|rog\b|tuf\b|legion|victus|նոթբուք)", re.IGNORECASE)),
    ("tablet", re.compile(
        r"(tablet|ipad|galaxy\s*tab|mate\s*pad|matepad|\bmi\s*pad\b|xiaomi\s*pad|redmi\s*pad|"
        r"\bpad\s*\d|planshet|պլանշետ)", re.IGNORECASE)),
    ("smartwatch", re.compile(
        r"(smart\s*watch|smartwatch|apple\s*watch|galaxy\s*watch|watch\s*(ultra|series|se\b|gt\b)|"
        r"\bwatch\s*\d|amazfit|\bband\s*\d|mi\s*band|fitness\s*tracker|ժամացույց)", re.IGNORECASE)),
    # TVs reliably carry the word "TV" (or the Armenian term). Avoid matching
    # bare OLED/QLED/UHD/4K, which also appear on laptops and monitors.
    ("tv", re.compile(r"(\btv\b|television|smart\s*tv|հեռուստացույց)", re.IGNORECASE)),
    ("refrigerator", re.compile(r"(refrigerator|fridge|freezer|սառնարան|սառցարան)", re.IGNORECASE)),
    ("washing_machine", re.compile(r"(washing\s*machine|washer|dishwasher|\bdryer\b|լվացքի\s*մեքեն|սպասք.*լվաց)", re.IGNORECASE)),
    ("air_conditioner", re.compile(r"(air\s*condition|conditioner|\bac\b\s*unit|օդորակիչ|կոնդիցիոներ|heater|\bfan\b|հովհար|ջեռուց)", re.IGNORECASE)),
    ("kitchen_appliance", re.compile(
        r"(blender|mixer|toaster|kettle|microwave|coffee|\boven\b|cooker|grill|fryer|juicer|"
        r"dishwasher|range\s*hood|\bhob\b|cooktop|"
        r"թեյնիկ|միկրոալիք|սրճեփ|բլենդեր|մսաղաց|հյութ|վառարան|թոստեր|սպասք.*լվաց)", re.IGNORECASE)),
    ("vacuum_cleaner", re.compile(
        r"(vacuum|robot\s*vacuum|փոշեկուլ|roomba)", re.IGNORECASE)),
    ("gaming", re.compile(
        r"(playstation|\bps5\b|\bps4\b|\bxbox\b|nintendo|switch\s*(oled|lite|2)|console|gamepad|"
        r"dualsense|dualshock|կոնսոլ)", re.IGNORECASE)),
    ("printer", re.compile(r"(printer|\bmfp\b|scanner|cartridge|toner|տպիչ|սկաներ)", re.IGNORECASE)),
    ("desktop", re.compile(r"(desktop|all[\s-]*in[\s-]*one|\baio\b|mini\s*pc|համակարգիչ)", re.IGNORECASE)),
    ("smartphone", re.compile(
        r"(smartphone|smart\s*phone|\biphone\b|\bgalaxy\s*[azsm]?\d|redmi|\bpoco\b|\bhonor\s*\d|"
        r"pixel|\boneplus\b|tecno|infinix|ulefone|realme|\bnokia\b|հեռախոս|սմարթֆոն)", re.IGNORECASE)),
]


def categorize(title: str | None, hint: str | None = None) -> str:
    """Return the best category for a product title.

    Accessories win outright; otherwise a confident type keyword decides; if
    nothing matches we keep the scraped `hint` (reliable for real products),
    falling back to 'other'.
    """
    t = (title or "").strip()
    if not t:
        return hint or "other"

    if _ACCESSORY.search(t):
        return "accessory"

    for category, pattern in _TYPE_RULES:
        if pattern.search(t):
            return category

    return hint or "other"
