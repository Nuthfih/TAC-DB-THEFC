#!/usr/bin/env python3
"""
fix_navbar_dropdowns.py
-----------------------
Aggiunge data-turbo="false" ai link dropdown della navbar
per evitare che Turbo.js intercetti i click di Bootstrap.

Uso:
    py fix_navbar_dropdowns.py <site_root> [--dry-run]
"""

import re
import sys
from pathlib import Path

# Sostituisce i dropdown toggle nella navbar
DROPDOWN_PATTERN = re.compile(
    r'(<a\s[^>]*class="[^"]*nav-link dropdown-toggle[^"]*"[^>]*)(data-bs-toggle="dropdown")([^>]*>)',
    re.IGNORECASE
)

def fix_file(path, dry_run, stats):
    try:
        content = path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return

    if 'nav-link dropdown-toggle' not in content:
        return

    def add_turbo_false(m):
        # Aggiunge data-turbo="false" se non c'è già
        full = m.group(0)
        if 'data-turbo="false"' in full:
            return full
        return m.group(1) + m.group(2) + ' data-turbo="false"' + m.group(3)

    new_content = DROPDOWN_PATTERN.sub(add_turbo_false, content)

    if new_content != content:
        stats["fixed"] += 1
        print(f"  ✔ {path.name}")
        if not dry_run:
            path.write_text(new_content, encoding="utf-8")

def main():
    if len(sys.argv) < 2:
        print("Uso: py fix_navbar_dropdowns.py <site_root> [--dry-run]")
        sys.exit(1)

    site_root = Path(sys.argv[1]).resolve()
    dry_run = "--dry-run" in sys.argv

    if not site_root.exists():
        print("Cartella non trovata: " + str(site_root))
        sys.exit(1)

    print(f"Sito root : {site_root}")
    print(f"Modalità  : {'DRY-RUN' if dry_run else 'SCRITTURA'}")
    print()

    html_files = list(site_root.rglob("*.html"))
    print(f"File HTML : {len(html_files)}")
    print()

    stats = {"fixed": 0}
    for f in html_files:
        fix_file(f, dry_run, stats)

    print()
    print("═" * 50)
    print(f"File aggiornati: {stats['fixed']}")
    if dry_run:
        print("\n⚠  DRY-RUN: nessun file modificato.")

if __name__ == "__main__":
    main()
