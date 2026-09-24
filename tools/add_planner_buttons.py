#!/usr/bin/env python3
"""
add_planner_buttons.py
----------------------
Aggiunge il bottone "Static Planner" ai plannerXXXX.html esistenti
che punta a plannerXXXX-1.html

Uso:
    py add_planner_buttons.py <site_root> [--dry-run]
"""

import re
import sys
from pathlib import Path

BUTTON_HTML = """<div style="position:fixed;top:70px;right:16px;z-index:9999">
  <a href="{static_href}" style="background:#2a2a4a;color:#aaa;padding:6px 12px;border-radius:6px;text-decoration:none;font-size:0.85em;border:1px solid #444">
    📋 Static Planner
  </a>
</div>"""

def process_file(path, dry_run, stats):
    content = path.read_text(encoding="utf-8", errors="replace")
    
    # Salta già modificati e i -1
    if "Static Planner" in content or path.stem.endswith("-1"):
        return
    
    # Salta se non ha build param (non è un planner di un personaggio)
    if "build=" not in content and "plannerTarget" not in content:
        return

    static_name = path.stem + "-1.html"
    button = BUTTON_HTML.format(static_href=static_name)
    
    new_content = content.replace("<body", button + "\n<body", 1)
    if new_content == content:
        new_content = content.replace("</body>", button + "\n</body>", 1)

    if new_content != content:
        stats["fixed"] += 1
        print(f"  ✔ {path.name}")
        if not dry_run:
            path.write_text(new_content, encoding="utf-8")

def main():
    if len(sys.argv) < 2:
        print("Uso: py add_planner_buttons.py <site_root> [--dry-run]")
        sys.exit(1)

    site_root = Path(sys.argv[1]).resolve()
    dry_run = "--dry-run" in sys.argv
    www = site_root / "www.alchemistcodedb.com"

    print(f"Sito root: {site_root}")
    print(f"Modalità : {'DRY-RUN' if dry_run else 'SCRITTURA'}")
    print()

    planner_files = list(www.rglob("planner*.html"))
    planner_files = [p for p in planner_files if not p.stem.endswith("-1")]
    print(f"Planner  : {len(planner_files)}")
    print()

    stats = {"fixed": 0}
    for f in planner_files:
        process_file(f, dry_run, stats)

    print()
    print(f"File aggiornati: {stats['fixed']}")

if __name__ == "__main__":
    main()
