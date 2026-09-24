#!/usr/bin/env python3
"""
fix_importmap.py
----------------
Converte gli URL assoluti nell'importmap di tutti gli HTML
in percorsi relativi locali, in modo che funzionino con un server locale.

Uso:
    python fix_importmap.py <site_root> [--dry-run]
"""

import re
import sys
from pathlib import Path

# URL da convertire → percorso relativo dalla root del sito
# (lo script calcola automaticamente il percorso relativo corretto
#  in base alla profondità del file HTML)
CDN_REPLACEMENTS = {
    "https://cdn.alchemistcodedb.com/": "../cdn.alchemistcodedb.com/",
    "https://cdn.jsdelivr.net/":        "../cdn.jsdelivr.net/",
    "https://unpkg.com/":               "../unpkg.com/",
}

# Profondità → prefisso relativo
# es. www.alchemistcodedb.com/planner.html → profondità 1 → ../
# es. www.alchemistcodedb.com/unit/estela.html → profondità 2 → ../../
# es. www.alchemistcodedb.com/jp/planner.html → profondità 2 → ../../

def relative_prefix(html_path, site_root):
    """Calcola quanti ../ servono per tornare alla root dal file HTML."""
    try:
        rel = html_path.relative_to(site_root)
        depth = len(rel.parts) - 1  # -1 per il filename stesso
        return "../" * depth if depth > 0 else ""
    except ValueError:
        return "../"

def fix_file(html_path, site_root, dry_run, stats):
    try:
        content = html_path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return

    # Salta file senza importmap
    if "importmap" not in content and "modulepreload" not in content:
        return

    prefix = relative_prefix(html_path, site_root)
    new_content = content
    changes = 0

    for absolute_url, default_relative in CDN_REPLACEMENTS.items():
        # Calcola il percorso relativo corretto per questo file
        relative = prefix + absolute_url.split("://")[1]  # es. ../../cdn.alchemistcodedb.com/

        if absolute_url in new_content:
            new_content = new_content.replace(absolute_url, relative)
            changes += new_content.count(relative) - content.count(relative)
            # Riconteggio corretto
            changes = content.count(absolute_url)

    if changes > 0:
        stats["fixed"] += 1
        rel = html_path.relative_to(site_root)
        print(f"  ✔ {rel}  ({changes} sostituzioni)")
        if not dry_run:
            html_path.write_text(new_content, encoding="utf-8")

def main():
    if len(sys.argv) < 2:
        print("Uso: python fix_importmap.py <site_root> [--dry-run]")
        sys.exit(1)

    site_root = Path(sys.argv[1]).resolve()
    dry_run = "--dry-run" in sys.argv

    if not site_root.exists():
        print(f"[ERROR] Cartella non trovata: {site_root}")
        sys.exit(1)

    print(f"Sito root : {site_root}")
    print(f"Modalità  : {'DRY-RUN' if dry_run else 'SCRITTURA'}")
    print()

    html_files = list(site_root.rglob("*.html"))
    print(f"File HTML : {len(html_files)}")
    print()

    stats = {"fixed": 0}
    for f in html_files:
        fix_file(f, site_root, dry_run, stats)

    print()
    print("═" * 50)
    print(f"File aggiornati: {stats['fixed']}")
    if dry_run:
        print("\n⚠  DRY-RUN: nessun file modificato.")

if __name__ == "__main__":
    main()
