#!/usr/bin/env python3
"""
build_skill_api.py
------------------
Scansiona le pagine skill/ ed estrae i buff "Target Buff Details"
per le passive (Type=Passive, Effect Type=Buff).

Uso:
    py build_skill_api.py <site_root>
"""

import json
import re
import sys
from pathlib import Path

# Stat principali → chiave interna
MAIN_STAT_MAP = {
    "HP": "hp", "PATK": "atk", "PDEF": "def",
    "MATK": "mag", "MDEF": "mnd", "DEX": "dex",
    "AGI": "spd", "CRIT": "cri", "LUCK": "luk", "Jewels": "mp",
}

# Stat aggiuntive (modificatori, non stat base)
EXTRA_STAT_MAP = {
    "PATK Power": "patk_power",
    "MATK Power": "matk_power",
    "Evasion Rate": "evasion",
    "Hit Rate": "hit_rate",
    "Healing Power": "heal_power",
    "Critical Rate": "crit_rate",
    "Critical Damage": "crit_dmg",
    "Jewels Obtained": "mp_obtain",
    "Initial Jewels": "mp_init",
    "Buff Duration": "buff_dur",
    "Debuff Duration": "debuff_dur",
    "Slash ATK Power": "slash_power",
    "Pierce ATK Power": "pierce_power",
    "Missile ATK Power": "missile_power",
    "Magic ATK Power": "magic_power",
    "Fire ATK Power": "fire_power",
    "Water ATK Power": "water_power",
    "Wind ATK Power": "wind_power",
    "Thunder ATK Power": "thunder_power",
    "Light ATK Power": "light_power",
    "Dark ATK Power": "dark_power",
    "Fire Res": "fire_res",
    "Water Res": "water_res",
    "Wind Res": "wind_res",
    "Thunder Res": "thunder_res",
    "Light Res": "light_res",
    "Dark Res": "dark_res",
    "All Status Res": "status_res",
    "MOVE": "move",
    "JUMP": "jump",
}

ALL_STAT_MAP = {**MAIN_STAT_MAP, **EXTRA_STAT_MAP}

def is_stat_name(name):
    """Controlla se il nome è una stat (anche parziale come 'MATK (Scale)')."""
    base = re.sub(r'\s*\(.*?\)', '', name).strip()
    return base in ALL_STAT_MAP

def get_stat_key(name):
    base = re.sub(r'\s*\(.*?\)', '', name).strip()
    return ALL_STAT_MAP.get(base)

def is_scale(name):
    return "(Scale)" in name

def extract_skill_data(html_path):
    try:
        content = html_path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return None

    # Controlla che sia una passive con buff
    if "Passive" not in content or "Buff" not in content:
        return None

    # Verifica Type=Passive e Effect Type=Buff
    type_m = re.search(r'<th>Type</th>\s*<td>(.*?)</td>', content, re.DOTALL)
    effect_m = re.search(r'<th>Effect Type</th>\s*<td>(.*?)</td>', content, re.DOTALL)
    if not type_m or not effect_m:
        return None
    if "Passive" not in type_m.group(1) or "Buff" not in effect_m.group(1):
        return None

    # Estrai Target Buff Details
    buff_section = re.search(
        r'Target Buff Details.*?<table[^>]*>(.*?)</table>',
        content, re.DOTALL
    )
    if not buff_section:
        return None

    data = {"slug": html_path.stem, "main_stats": {}, "extra_stats": {}}

    # Cerca <th>STAT NAME</th><td>...<div>Max: N</div>...</td>
    rows = re.findall(
        r'<th>([^<]+)</th>\s*<td>(.*?)</td>',
        buff_section.group(1), re.DOTALL
    )
    for stat_name, td_content in rows:
        stat_name = stat_name.strip()
        key = get_stat_key(stat_name)
        if not key:
            continue

        # Estrai Max value
        max_m = re.search(r'Max:\s*(\d+)', td_content)
        if not max_m:
            # Prova valore singolo
            val_m = re.search(r'<div>(\d+)</div>', td_content)
            if val_m:
                val = int(val_m.group(1))
            else:
                continue
        else:
            val = int(max_m.group(1))

        scale = is_scale(stat_name)
        base_name = re.sub(r'\s*\(.*?\)', '', stat_name).strip()

        if base_name in MAIN_STAT_MAP:
            dest = data["main_stats"]
        else:
            dest = data["extra_stats"]

        entry = dest.get(key, {"flat": 0, "scale": 0})
        if scale:
            entry["scale"] = val
        else:
            entry["flat"] = entry.get("flat", 0) + val
        dest[key] = entry

    if not data["main_stats"] and not data["extra_stats"]:
        return None
    return data


def main():
    if len(sys.argv) < 2:
        print("Uso: py build_skill_api.py <site_root>")
        sys.exit(1)

    site_root = Path(sys.argv[1]).resolve()

    configs = [
        (site_root / "www.alchemistcodedb.com" / "skill",
         site_root / "www.alchemistcodedb.com" / "api" / "skill"),
        (site_root / "www.alchemistcodedb.com" / "jp" / "skill",
         site_root / "www.alchemistcodedb.com" / "jp" / "api" / "skill"),
    ]

    for skill_dir, api_dir in configs:
        if not skill_dir.exists():
            print(f"[SKIP] {skill_dir}")
            continue

        api_dir.mkdir(parents=True, exist_ok=True)
        files = list(skill_dir.glob("*.html"))
        print(f"\n{skill_dir.parent.name}/skill: {len(files)} file")

        ok = skip = 0
        for f in files:
            data = extract_skill_data(f)
            if data:
                out = api_dir / f"{f.stem}.json"
                out.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
                ok += 1
            else:
                skip += 1

        print(f"  Estratte: {ok}  Saltate: {skip}")

    print("\nFatto!")

if __name__ == "__main__":
    main()
