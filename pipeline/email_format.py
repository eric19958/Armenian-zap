"""
Inch Ka · digest formatting
===========================

Pure functions that turn a list of price-drop rows into (1) a polished HTML
email body and (2) a ready-to-paste Instagram caption. No I/O, so it's unit
testable and reusable by run_daily.py.

A drop row is a dict with:
    canonical_name, brand, retailer_name, prev_price, cur_price,
    drop_pct, in_stock, product_url
"""

from __future__ import annotations

from datetime import date
from typing import Iterable

AMD = "֏"


def fmt_amd(value) -> str:
    """120000 -> '120,000 ֏'."""
    return f"{int(round(float(value))):,} {AMD}"


# ---------------------------------------------------------------------------
# HTML email
# ---------------------------------------------------------------------------
def build_html(drops: list[dict], on: date | None = None) -> str:
    on = on or date.today()
    if not drops:
        return (
            f"<div style='font-family:Helvetica,Arial,sans-serif;padding:24px'>"
            f"<h2>Inch Ka — Daily Price Watch</h2>"
            f"<p>No price drops detected for {on:%B %d, %Y}. We'll keep watching.</p>"
            f"</div>"
        )

    rows = []
    for d in drops:
        stock = ("#137333", "In stock") if d["in_stock"] else ("#b00020", "Out of stock")
        rows.append(f"""
        <tr>
          <td style="padding:14px 16px;border-bottom:1px solid #eee;">
            <div style="font-weight:600;color:#111;font-size:15px;">{d['canonical_name']}</div>
            <div style="color:#666;font-size:12px;margin-top:2px;">{d['brand']} ·
              <span style="color:{stock[0]};">{stock[1]}</span></div>
          </td>
          <td style="padding:14px 8px;border-bottom:1px solid #eee;text-align:right;color:#999;text-decoration:line-through;white-space:nowrap;">{fmt_amd(d['prev_price'])}</td>
          <td style="padding:14px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:#111;white-space:nowrap;">{fmt_amd(d['cur_price'])}</td>
          <td style="padding:14px 8px;border-bottom:1px solid #eee;text-align:center;">
            <span style="background:#e6f4ea;color:#137333;font-weight:700;border-radius:999px;padding:4px 10px;font-size:13px;white-space:nowrap;">−{d['drop_pct']}%</span>
          </td>
          <td style="padding:14px 16px;border-bottom:1px solid #eee;color:#555;white-space:nowrap;">{d['retailer_name']}</td>
        </tr>""")

    return f"""
    <div style="background:#f5f6f8;padding:24px 0;font-family:Helvetica,Arial,sans-serif;">
      <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
        <div style="background:linear-gradient(135deg,#1f6feb,#0a3d91);padding:28px 24px;color:#fff;">
          <div style="font-size:13px;letter-spacing:2px;opacity:.85;">INCH KA · ի՞նչ կա</div>
          <div style="font-size:24px;font-weight:700;margin-top:6px;">Daily Price Drops</div>
          <div style="font-size:13px;opacity:.85;margin-top:4px;">{on:%A, %B %d, %Y} · {len(drops)} deal(s) found</div>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#fafafa;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">
              <th style="text-align:left;padding:10px 16px;">Product</th>
              <th style="text-align:right;padding:10px 8px;">Was</th>
              <th style="text-align:right;padding:10px 8px;">Now</th>
              <th style="text-align:center;padding:10px 8px;">Drop</th>
              <th style="text-align:left;padding:10px 16px;">Retailer</th>
            </tr>
          </thead>
          <tbody>{''.join(rows)}</tbody>
        </table>
        <div style="padding:18px 24px;color:#999;font-size:12px;">
          Prices in Armenian drams ({AMD}). Compared against the previous recorded price.
          Generated automatically by Inch Ka.
        </div>
      </div>
    </div>"""


# ---------------------------------------------------------------------------
# Instagram caption (copy-paste ready)
# ---------------------------------------------------------------------------
def build_ig_caption(drops: list[dict], on: date | None = None) -> str:
    on = on or date.today()
    if not drops:
        return "No price drops today — check back tomorrow! 🇦🇲 #InchKa"

    lines = [
        "🔥 PRICE DROPS TODAY 🔥",
        "💻 Inch Ka · ի՞նչ կա — best laptop deals in Armenia",
        "",
    ]
    medals = ["🥇", "🥈", "🥉"]
    for i, d in enumerate(drops):
        tag = medals[i] if i < 3 else "▫️"
        stock = "" if d["in_stock"] else " (out of stock ⚠️)"
        lines.append(f"{tag} {d['canonical_name']}")
        lines.append(
            f"   {fmt_amd(d['prev_price'])} → {fmt_amd(d['cur_price'])} "
            f"(−{d['drop_pct']}%) @ {d['retailer_name']}{stock}"
        )
        lines.append("")

    lines.append("👉 Compare every store before you buy at Inch Ka.")
    lines.append("")
    lines.append(
        "#InchKa #Armenia #Yerevan #Laptops #TechDeals #Zigzag #Vega "
        "#նոթբուք #զեղչ #Հայաստան #PriceDrop #MacBook #HP"
    )
    return "\n".join(lines)
