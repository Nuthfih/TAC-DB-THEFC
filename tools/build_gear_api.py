#!/usr/bin/env python3
"""
build_gear_api.py
-----------------
Scansiona tutte le pagine gear/ e card/ e estrae le stat max,
salvando JSON nella cartella api/gear/ e api/card/

Uso:
    py build_gear_api.py <site_root> [--type gear|card|all]
"""

import argparse
import json
import re
import sys
from pathlib import Path

# Mappa nomi stat HTML → chiave interna
STAT_MAP = {
    "HP": "hp", "PATK": "atk", "PDEF": "def",
    "MATK": "mag", "MDEF": "mnd", "DEX": "dex",
    "AGI": "spd", "CRIT": "cri", "LUCK": "luk",
    "Jewels": "mp", "Healing": "heal", "JUMP": "jjmp",
    "MOVE": "jmov", "Jewels Obtained": "mp_obtain",
    "Initial Jewels": "mp_init",
}

def extract_gear_stats(html_path):
    """Estrae stat max da una pagina gear."""
    try:
        content = html_path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return None

    data = {"slug": html_path.stem, "stats": {}}

    # Nome gear
    m = re.search(r'<h1>([^<]+)</h1>', content)
    if m:
        data["name"] = m.group(1).strip()

    # Stats dalla sezione "Max Stats" → gear-detail-box
    m = re.search(
        r'Max Stats.*?<ul class="list-unstyled m-0">(.*?)</ul>',
        content, re.DOTALL
    )
    if m:
        items = re.findall(r'<li>([^<]+)</li>', m.group(1))
        for item in items:
            item = item.strip()
            # Formato: "AGI +13" o "HP +1040"
            stat_m = re.match(r'(.+?)\s*\+(\d+(?:\.\d+)?)', item)
            if stat_m:
                stat_name = stat_m.group(1).strip()
                val = float(stat_m.group(2))
                key = STAT_MAP.get(stat_name)
                if key:
                    data["stats"][key] = int(val) if val == int(val) else val

    return data if data["stats"] else None


def extract_card_stats(html_path):
    """Estrae stat max da una pagina card/memento."""
    try:
        content = html_path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return None

    data = {"slug": html_path.stem, "stats": {}}

    # Nome card
    m = re.search(r'<h1>([^<]+)</h1>', content)
    if m:
        data["name"] = m.group(1).strip()

    # Stats dalla tabella simple (ultima colonna = max level)
    section = re.search(
        r'<div class="tab-pane active" id="stats-table".*?<tbody>(.*?)</tbody>',
        content, re.DOTALL
    )
    if section:
        rows = re.findall(
            r'<th>([^<]+)</th>((?:\s*<td>[^<]*</td>)+)',
            section.group(1), re.DOTALL
        )
        for stat_name, tds in rows:
            stat_name = stat_name.strip()
            # Prendi l'ultima <td> (livello max)
            all_tds = re.findall(r'<td>([^<]+)</td>', tds)
            if not all_tds:
                continue
            last_val = all_tds[-1].strip()
            # Formato: "+1040" o "+80"
            val_m = re.match(r'\+(\d+)', last_val)
            if val_m:
                key = STAT_MAP.get(stat_name)
                if key:
                    data["stats"][key] = int(val_m.group(1))

    return data if data["stats"] else None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("site_root")
    parser.add_argument("--type", default="all", choices=["gear", "card", "all"])
    parser.add_argument("--locale", default="en", choices=["en", "jp"])
    args = parser.parse_args()

    site_root = Path(args.site_root).resolve()
    if args.locale == "jp":
        www = site_root / "www.alchemistcodedb.com" / "jp"
    else:
        www = site_root / "www.alchemistcodedb.com"

    api_base = www / "api"
    api_base.mkdir(parents=True, exist_ok=True)

    if args.type in ("gear", "all"):
        gear_dir = www / "gear"
        api_gear = api_base / "gear"
        api_gear.mkdir(exist_ok=True)
        if gear_dir.exists():
            files = list(gear_dir.glob("*.html"))
            print(f"Gear: {len(files)} file")
            ok = fail = 0
            for f in files:
                data = extract_gear_stats(f)
                if data:
                    out = api_gear / f"{f.stem}.json"
                    out.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
                    ok += 1
                else:
                    fail += 1
            print(f"  OK: {ok}  Saltati: {fail}")
        else:
            print(f"[SKIP] cartella gear non trovata: {gear_dir}")

    if args.type in ("card", "all"):
        card_dir = www / "card"
        api_card = api_base / "card"
        api_card.mkdir(exist_ok=True)
        if card_dir.exists():
            files = list(card_dir.glob("*.html"))
            print(f"Card: {len(files)} file")
            ok = fail = 0
            for f in files:
                data = extract_card_stats(f)
                if data:
                    out = api_card / f"{f.stem}.json"
                    out.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
                    ok += 1
                else:
                    fail += 1
            print(f"  OK: {ok}  Saltati: {fail}")
        else:
            print(f"[SKIP] cartella card non trovata: {card_dir}")

    print("\nFatto!")

if __name__ == "__main__":
    main()
