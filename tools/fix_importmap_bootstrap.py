#!/usr/bin/env python3
"""
fix_importmap_bootstrap.py
--------------------------
Ripristina "bootstrap": ".../+esm" nell'importmap
(lascia il bundle.min.js nell'head che è già stato spostato da fix_bootstrap_order.py)

Uso:
    py fix_importmap_bootstrap.py <site_root> [--dry-run]
"""

import re
import sys
from pathlib import Path

BUNDLE_IN_IMPORTMAP = re.compile(
    r'("bootstrap"\s*:\s*")([^"]+bootstrap@5\.3\.3/dist/js/bootstrap\.bundle\.min\.js)(")',
    re.IGNORECASE
)

def fix_file(path, dry_run, stats):
    try:
        content = path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return

    if '"bootstrap"' not in content:
        return
    if "bootstrap.bundle.min.js" not in content:
        return
    if '<script type="importmap"' not in content:
        return

    def restore_esm(m):
        new_path = re.sub(r'/dist/js/bootstrap\.bundle\.min\.js$', '/+esm', m.group(2))
        return m.group(1) + new_path + m.group(3)

    new_content = BUNDLE_IN_IMPORTMAP.sub(restore_esm, content)

    if new_content != content:
        stats["fixed"] += 1
        print(f"  ✔ {path.name}")
        if not dry_run:
            path.write_text(new_content, encoding="utf-8")

def main():
    if len(sys.argv) < 2:
        print("Uso: py fix_importmap_bootstrap.py <site_root> [--dry-run]")
        sys.exit(1)

    site_root = Path(sys.argv[1]).resolve()
    dry_run = "--dry-run" in sys.argv

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
