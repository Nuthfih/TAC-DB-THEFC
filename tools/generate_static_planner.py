#!/usr/bin/env python3
"""
generate_static_planner.py
--------------------------
Genera plannerXXXX-1.html per ogni plannerXXXX.html esistente.
La versione -1 funziona senza server (dati embedded, no importmap).

Uso:
    py generate_static_planner.py <site_root> [--dry-run]
"""

import argparse
import base64
import json
import re
import sys
from pathlib import Path

def decode_build(build_param):
    try:
        return json.loads(base64.b64decode(build_param + "==").decode("utf-8"))
    except Exception:
        return {}

def load_unit_data(api_dir, slug):
    f = api_dir / f"unit_{slug}.json"
    if not f.exists():
        return None
    return json.loads(f.read_text(encoding="utf-8"))

def stat_at_level(min_val, max_val, level, max_level=99):
    if max_level <= 1:
        return max_val
    return round(min_val + (max_val - min_val) * (level - 1) / (max_level - 1))

def generate_html(slug, unit, locale, planner_file, static_file):
    """Genera l'HTML della versione statica -1."""
    
    # Calcola stats a livello 85 (default)
    level = 85
    max_level = unit.get("max_level", 99)
    
    def s(min_k, max_k):
        return stat_at_level(unit.get(min_k, 0), unit.get(max_k, 0), level, max_level)

    stats = {
        "HP": s("hp", "mhp"), "PATK": s("atk", "matk"),
        "PDEF": s("def", "mdef"), "MATK": s("mag", "mmag"),
        "MDEF": s("mnd", "mmnd"), "DEX": s("dex", "mdex"),
        "AGI": s("spd", "mspd"), "CRIT": s("cri", "mcri"),
        "LUCK": s("luk", "mluk"), "Jewels": s("mp", "mmp"),
    }

    # Path relativo verso la root (per CSS/immagini)
    if "/jp/" in str(static_file):
        root = "../../"
        unit_href = f"../unit/{slug}.html"
        planner_href = f"../{planner_file.name}"
    else:
        root = "../"
        unit_href = f"unit/{slug}.html"
        planner_href = planner_file.name

    img_path = f"{root}cdn.alchemistcodedb.com/images/"
    portrait = f"{img_path}Portraits/{unit.get('img', slug)}.png"

    # Jobs HTML
    jobs_html = ""
    for job in unit.get("jobs_data", []):
        passives_html = ""
        for p in job.get("passives", []):
            passives_html += f'<li><a href="{p["href"]}">{p["name"]}</a> — {p["desc"]}</li>'
        jobs_html += f"""
        <div class="job-block">
          <img src="{img_path}JobIcon/{job['mdl']}.png" 
               onerror="this.src='{img_path}JobIcon/gun.png'"
               style="width:48px;height:48px">
          <div class="job-name">{job['name']}</div>
          {f'<ul class="passive-list">{passives_html}</ul>' if passives_html else ''}
        </div>"""

    # Gear HTML
    gear_html = ""
    for g in unit.get("recommended_gear", []):
        gear_html += f"""
        <div class="rec-item">
          <img src="{img_path}ArtiIcon/{g['img']}.png" onerror="this.style.display='none'">
          <div><div class="rec-item-name"><a href="{g['href']}">{g['name']}</a></div>
          <div class="rec-item-stats">{g.get('stats','')}</div></div>
        </div>"""

    # Mementos HTML
    memo_html = ""
    for m in unit.get("recommended_mementos", []):
        memo_html += f"""
        <div class="rec-item">
          <img src="{img_path}ConceptCardIcon/{m['img']}.png" onerror="this.style.display='none'">
          <div><div class="rec-item-name"><a href="{m['href']}">{m['name']}</a></div>
          <div class="rec-item-stats">{m.get('stats','')}</div></div>
        </div>"""

    # Leader skill / Master ability
    ls_html = ""
    if unit.get("leader_skill"):
        ls = unit["leader_skill"]
        ls_html = f'<div class="ability-block"><span class="ability-label">Leader Skill</span> <a href="{ls["href"]}">{ls["name"]}</a><div class="ability-desc">{ls["desc"]}</div></div>'
    ma_html = ""
    if unit.get("master_ability"):
        ma = unit["master_ability"]
        ma_html = f'<div class="ability-block"><span class="ability-label">Master Ability</span> <a href="{ma["href"]}">{ma["name"]}</a><div class="ability-desc">{ma["desc"]}</div></div>'

    # Stats table con slider
    stats_rows = "".join(f'<tr><td>{k}</td><td id="stat-{k}">{v}</td></tr>' for k, v in stats.items())
    
    # Prepara dati JS per slider
    stats_data = {}
    stat_map = [("HP","hp","mhp"),("PATK","atk","matk"),("PDEF","def","mdef"),
                ("MATK","mag","mmag"),("MDEF","mnd","mmnd"),("DEX","dex","mdex"),
                ("AGI","spd","mspd"),("CRIT","cri","mcri"),("LUCK","luk","mluk"),
                ("Jewels","mp","mmp")]
    for stat_name, min_k, max_k in stat_map:
        stats_data[stat_name] = {"min": unit.get(min_k, 0), "max": unit.get(max_k, 0)}

    unit_name = unit.get("name", slug)

    html = f"""<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{unit_name} — Unit Planner (Static)</title>
<script>var t=localStorage.theme||"auto";document.documentElement.setAttribute("data-bs-theme",t==="auto"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t);</script>
<link rel="stylesheet" href="{root}cdn.alchemistcodedb.com/assets/application-a2b3cc5bb409793aa98e1c00d01f976654b0c9eca2d5049488e203b915554e70.css">
<script src="{root}cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<style>
/* Planner Static - stile simile all'originale */
*, *::before, *::after {{ box-sizing: border-box; }}
body {{ margin: 0; padding: 0; font-family: "Trebuchet MS", Verdana, Arial, sans-serif; font-size: 14px; }}
.nav-buttons {{ display: flex; gap: 8px; padding: 8px 12px; background: rgba(0,0,0,0.3); }}
.btn-switch {{ padding: 5px 12px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); cursor: pointer; font-size: 0.85em; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; }}
.btn-standard {{ background: rgba(255,255,255,0.1); color: #ccc; }}
.btn-unit {{ background: rgba(100,160,255,0.2); color: #7af; }}
.planner-grid {{ display: grid; grid-template-columns: 280px 1fr 240px; gap: 0; min-height: calc(100vh - 40px); }}

/* LEFT COLUMN */
.col-left {{ padding: 12px; border-right: 1px solid rgba(255,255,255,0.1); }}
.unit-portrait {{ width: 140px; height: 140px; object-fit: cover; border-radius: 4px; display: block; margin: 0 auto 8px; border: 2px solid rgba(255,255,255,0.2); }}
.unit-name {{ font-size: 1.1em; font-weight: bold; text-align: center; margin-bottom: 2px; }}
.unit-meta {{ text-align: center; font-size: 0.8em; opacity: 0.6; margin-bottom: 8px; }}
.planner-header {{ font-weight: bold; font-size: 0.85em; padding: 4px 8px; background: rgba(255,255,255,0.08); border-radius: 3px; margin: 8px 0 4px; text-transform: uppercase; letter-spacing: 0.5px; }}
.ability-block {{ padding: 4px 0; font-size: 0.82em; border-bottom: 1px solid rgba(255,255,255,0.06); margin-bottom: 4px; }}
.ability-label {{ font-size: 0.75em; opacity: 0.5; display: block; margin-bottom: 1px; }}
.ability-desc {{ font-size: 0.78em; opacity: 0.6; margin-top: 2px; }}
.jobs-grid {{ display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 0; }}
.job-block {{ text-align: center; width: 72px; }}
.job-block img {{ width: 52px; height: 52px; border-radius: 6px; border: 2px solid rgba(255,255,255,0.15); }}
.job-name {{ font-size: 0.68em; opacity: 0.8; margin-top: 2px; line-height: 1.2; }}
.passive-list {{ text-align: left; font-size: 0.72em; margin: 3px 0 0; padding-left: 10px; opacity: 0.75; list-style: disc; }}
.passive-list li {{ margin-bottom: 2px; }}

/* CENTER COLUMN */
.col-center {{ padding: 12px; border-right: 1px solid rgba(255,255,255,0.1); }}
.level-row {{ display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }}
.level-row label {{ font-size: 0.85em; opacity: 0.7; min-width: 40px; }}
.level-slider {{ flex: 1; accent-color: #4a9eff; }}
.level-display {{ min-width: 28px; text-align: right; font-weight: bold; }}
.stats-table {{ width: 100%; border-collapse: collapse; font-size: 0.88em; }}
.stats-table tr:nth-child(even) {{ background: rgba(255,255,255,0.03); }}
.stats-table td {{ padding: 4px 8px; }}
.stats-table td:first-child {{ opacity: 0.65; }}
.stats-table td:last-child {{ text-align: right; font-weight: bold; font-size: 0.95em; }}
.rec-section {{ margin-top: 12px; }}
.rec-item {{ display: flex; align-items: center; gap: 8px; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.83em; }}
.rec-item img {{ width: 36px; height: 36px; flex-shrink: 0; border-radius: 4px; border: 1px solid rgba(255,255,255,0.15); }}
.rec-item-name {{ font-weight: 500; }}
.rec-item-stats {{ font-size: 0.78em; opacity: 0.55; margin-top: 1px; }}

/* RIGHT COLUMN */
.col-right {{ padding: 12px; opacity: 0.35; }}

@media (max-width: 800px) {{
  .planner-grid {{ grid-template-columns: 1fr; }}
  .col-right {{ display: none; }}
}}
</style>
</head>
<body>
<div class="nav-buttons">
  <a href="{unit_href}" class="btn-switch btn-unit">📋 Unit Page</a>
  <a href="{planner_href}" class="btn-switch btn-standard">⚙️ Standard Planner</a>
</div>
<div class="planner-grid">
  <!-- LEFT -->
  <div class="col-left">
    <img src="{portrait}" onerror="this.style.display='none'" class="unit-portrait">
    <div class="unit-name">{unit_name}</div>
    <div class="unit-meta">{unit.get("elem_name","")} · {unit.get("birth_name","")}</div>
    {ls_html}
    {ma_html}
    <div class="planner-header">Jobs &amp; Passives</div>
    <div class="jobs-grid">{jobs_html}</div>
  </div>
  <!-- CENTER -->
  <div class="col-center">
    <div class="level-row">
      <label>Level</label>
      <input type="range" min="1" max="{max_level}" value="85" class="level-slider" id="levelSlider">
      <span class="level-display" id="levelDisplay">85</span>
    </div>
    <div class="planner-header">Primary Stats</div>
    <table class="stats-table">
      <tbody id="statsBody">{stats_rows}</tbody>
    </table>
    <div class="rec-section">
      <div class="planner-header">Recommended Gear</div>
      {gear_html if gear_html else '<div style="opacity:0.4;font-size:0.85em;padding:4px">No data</div>'}
    </div>
    <div class="rec-section">
      <div class="planner-header">Recommended Mementos</div>
      {memo_html if memo_html else '<div style="opacity:0.4;font-size:0.85em;padding:4px">No data</div>'}
    </div>
  </div>
  <!-- RIGHT: placeholder -->
  <div class="col-right">
    <div class="planner-header">Gear Slots</div>
    <p style="font-size:0.8em">Not available offline</p>
    <div class="planner-header">Mementos</div>
    <p style="font-size:0.8em">Not available offline</p>
    <div class="planner-header">Truth Seals</div>
    <p style="font-size:0.8em">Not available offline</p>
  </div>
</div>
<script>
var statsData = {json.dumps(stats_data)};
var maxLevel = {max_level};
function calcStat(min, max, level) {{
  if (maxLevel <= 1) return max;
  return Math.round(min + (max - min) * (level - 1) / (maxLevel - 1));
}}
document.getElementById("levelSlider").addEventListener("input", function() {{
  var level = parseInt(this.value);
  document.getElementById("levelDisplay").textContent = level;
  for (var stat in statsData) {{
    var el = document.getElementById("stat-" + stat);
    if (el) el.textContent = calcStat(statsData[stat].min, statsData[stat].max, level);
  }}
}});
</script>
</body>
</html>"""
    return html


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("site_root")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--slug", default=None)
    args = parser.parse_args()

    site_root = Path(args.site_root).resolve()
    www = site_root / "www.alchemistcodedb.com"

    configs = [
        (www, www / "api", "en"),
        (www / "jp", www / "jp" / "api", "jp"),
    ]

    total_ok = 0
    total_fail = 0

    for site_dir, api_dir, locale in configs:
        if not api_dir.exists():
            continue

        planner_files = list(site_dir.glob("planner*.html"))
        # Escludi già i -1
        planner_files = [p for p in planner_files if not p.stem.endswith("-1")]

        if args.slug:
            planner_files = [p for p in planner_files if args.slug in p.stem]

        print(f"\n[{locale.upper()}] {len(planner_files)} planner da processare")

        for planner_file in planner_files:
            # Leggi il build param per trovare lo slug
            content = planner_file.read_text(encoding="utf-8", errors="replace")
            m = re.search(r'build=([A-Za-z0-9+/=]+)', content)
            if not m:
                total_fail += 1
                continue
            build = decode_build(m.group(1))
            slug = build.get("u", "")
            if not slug:
                total_fail += 1
                continue

            unit = load_unit_data(api_dir, slug)
            if not unit:
                print(f"  [SKIP] {planner_file.name} — no API data for {slug}")
                total_fail += 1
                continue

            static_file = planner_file.parent / (planner_file.stem + "-1.html")
            html = generate_html(slug, unit, locale, planner_file, static_file)

            print(f"  ✔ {static_file.name} ({slug})")
            if not args.dry_run:
                static_file.write_text(html, encoding="utf-8")
            total_ok += 1

    print(f"\n{'═'*50}")
    print(f"Generati : {total_ok}")
    print(f"Saltati  : {total_fail}")
    if args.dry_run:
        print("\n⚠  DRY-RUN: nessun file scritto.")

if __name__ == "__main__":
    main()
