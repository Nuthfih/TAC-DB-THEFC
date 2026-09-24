#!/usr/bin/env python3
"""build_rune_api.py — Genera api/runes.json"""

import json, re, sys, zipfile
from pathlib import Path

STAT_MAP = {
    "HP":"hp","PATK":"atk","PDEF":"def","MATK":"mag","MDEF":"mnd",
    "DEX":"dex","AGI":"spd","CRIT":"cri","LUCK":"luk","Jewels":"mp",
    "Evasion Rate":"evasion","Hit Rate":"hit_rate",
    "PATK Power":"patk_power","MATK Power":"matk_power",
    "Healing Power":"heal_power","JUMP":"jump","MOVE":"move",
    "Initial Jewels":"mp_init","All Status Res":"status_res",
    "Single Target ATK":"single_target_atk","Area ATK":"area_atk",
    "Slash ATK Power":"slash_power","Pierce ATK Power":"pierce_power",
    "Missile ATK Power":"missile_power","Magic ATK Power":"magic_power",
}
STAT_LABELS = {v:k for k,v in STAT_MAP.items() if k in
    ["HP","PATK","PDEF","MATK","MDEF","DEX","AGI","CRIT","LUCK","Jewels"]}

SLOT_TO_SIN = {1:"Envy",2:"Sloth",3:"Lust",4:"Gluttony",5:"Wrath",6:"Greed"}

def extract_basic_stats(section):
    stats = {}
    tbl = re.search(r'card-stats-table[^>]*>(.*?)(?=</table>|Awakened Stats)', section, re.DOTALL)
    if not tbl: return stats
    tbody = tbl.group(1)
    # Pattern 1: min/max separati
    rows = re.findall(
        r'<th[^>]*>\s*([A-Z][A-Za-z ]+?)\s*</th>\s*<td[^>]*>\s*\+?(\d+)\s*</td>\s*<td[^>]*>\s*\+?(\d+)\s*</td>',
        tbody
    )
    for sn, _, mx in rows:
        k = STAT_MAP.get(sn.strip())
        if k: stats[k] = int(mx)
    # Pattern 2: colspan (min=max)
    if not stats:
        rows2 = re.findall(
            r'<th[^>]*>\s*([A-Z][A-Za-z ]+?)\s*</th>\s*<td[^>]*colspan[^>]*>\s*\+?(\d+)',
            tbody
        )
        for sn, v in rows2:
            k = STAT_MAP.get(sn.strip())
            if k: stats[k] = int(v)
    return stats

def extract_set_effect(content):
    n_seals = 4
    stats = {}
    m = re.search(r'Set Effect \((\d+) Seals?\)', content)
    if m: n_seals = int(m.group(1))
    tbl = re.search(r'Set Effect.*?<tbody>(.*?)</tbody>', content, re.DOTALL)
    if tbl:
        rows = re.findall(r'<th>([^<]+)</th>\s*<td>\+?(\d+)(%?)</td>', tbl.group(1))
        for sn, v, pct in rows:
            k = STAT_MAP.get(sn.strip())
            if k: stats[k] = {"val": int(v), "pct": bool(pct)}
    return n_seals, stats

def build_rune_data(zip_path):
    # sins[sin][rarity] = list of {stat_key, value, label}
    # Per R/SR che hanno una sola variante: lista con 1 elemento
    # Per SSR con più varianti: lista con N elementi
    sins = {}
    sets = {}

    with zipfile.ZipFile(zip_path) as z:
        files = sorted([f for f in z.namelist() if f.endswith('.html')])

        for f in files:
            m = re.match(r'rune/rune-(r|sr|ssr)-(\d+)-(.+)\.html', f)
            if not m: continue
            rarity, slot_str, set_slug = m.groups()
            slot = int(slot_str)
            sin = SLOT_TO_SIN.get(slot, "Unknown")

            # Normalizza set slug
            set_base = re.sub(r'-(atk|def|mag|mnd|dex|spd|cri|luk|hp|mp)-max$', '', set_slug)

            content = z.read(f).decode('utf-8', errors='replace')

            # Nome set
            h1 = re.search(r'<h1>([^<]+)</h1>', content)
            if h1:
                snm = re.search(r'\[([^\]]+)\]', h1.group(1))
                if snm and set_base not in sets:
                    sets[set_base] = {"name": snm.group(1), "n_seals": 4, "stats": {}}

            sins.setdefault(sin, {"slot": slot, "r": [], "sr": [], "ssr": []})

            # Basic stats
            idx = content.find('Basic Stats')
            if idx < 0: continue
            basic = extract_basic_stats(content[idx:idx+1500])
            if not basic: continue

            # Aggiungi solo se questa variante non è già presente
            existing_keys = set()
            for entry in sins[sin][rarity]:
                existing_keys.update(entry["stats"].keys())

            new_keys = set(basic.keys()) - existing_keys
            if new_keys:
                # Questa variante aggiunge nuove stat
                partial = {k: v for k, v in basic.items() if k in new_keys}
                label = ", ".join(f"{STAT_LABELS.get(k,k)} +{v}" for k,v in partial.items())
                sins[sin][rarity].append({"stats": partial, "label": label})

            # Set effect
            if set_base in sets and not sets[set_base]["stats"]:
                n, stats_eff = extract_set_effect(content)
                if stats_eff:
                    sets[set_base]["n_seals"] = n
                    sets[set_base]["stats"] = stats_eff

    # Scala R/SR da SSR se vuoti
    SCALE = {"sr": 0.5, "r": 0.15}
    for sin, data in sins.items():
        for rar in ["sr", "r"]:
            if not data[rar] and data["ssr"]:
                scale = SCALE[rar]
                scaled = []
                for entry in data["ssr"]:
                    s = {k: max(1, int(v * scale)) for k, v in entry["stats"].items()}
                    label = ", ".join(f"{STAT_LABELS.get(k,k)} +{v}" for k,v in s.items())
                    scaled.append({"stats": s, "label": label})
                data[rar] = scaled

    return {
        "sins": sins,
        "sets": sets,
        "slot_to_sin": {str(k): v for k, v in SLOT_TO_SIN.items()},
    }

def main():
    if len(sys.argv) < 2:
        print("Uso: py build_rune_api.py <site_root> --rune-zip <path>")
        sys.exit(1)
    site_root = Path(sys.argv[1]).resolve()
    rune_zip = None
    if "--rune-zip" in sys.argv:
        rune_zip = Path(sys.argv[sys.argv.index("--rune-zip") + 1])
    else:
        for c in [Path.home()/"Downloads"/"rune.zip",
                  Path.home()/"Downloads"/"files"/"rune.zip"]:
            if c.exists(): rune_zip = c; break
    if not rune_zip or not rune_zip.exists():
        print("rune.zip non trovata"); sys.exit(1)

    print(f"Leggo: {rune_zip}")
    data = build_rune_data(rune_zip)

    print("\nSins:")
    for sin, d in data["sins"].items():
        for rar in ["r","sr","ssr"]:
            if d[rar]:
                print(f"  {sin} {rar.upper()}: {[e['label'] for e in d[rar]]}")
    print(f"\nSets: {len(data['sets'])}")
    for slug, s in data["sets"].items():
        print(f"  {slug} ({s['name']}): {s['n_seals']}x → {s['stats']}")

    for api_dir in [
        site_root/"www.alchemistcodedb.com"/"api",
        site_root/"www.alchemistcodedb.com"/"jp"/"api",
    ]:
        api_dir.mkdir(parents=True, exist_ok=True)
        out = api_dir/"runes.json"
        out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Salvato: {out}")

if __name__ == "__main__":
    main()
