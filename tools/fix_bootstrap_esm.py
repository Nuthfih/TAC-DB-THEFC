#!/usr/bin/env python3
"""
fix_bootstrap_esm.py
--------------------
Ripristina bootstrap@5.3.3/+esm nell'importmap 
(annulla la sostituzione precedente con bundle.min.js)

Uso:
    py fix_bootstrap_esm.py <site_root> [--dry-run]
"""

import re
import sys
from pathlib import Path

BUNDLE_PATTERN = re.compile(
    r'("bootstrap"\s*:\s*")([^"]+bootstrap@5\.3\.3/dist/js/bootstrap\.bundle\.min\.js)(")',
    re.IGNORECASE
)

def fix_file(path, dry_run, stats):
    try:
        content = path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return

    if "bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" not in content:
        return

    def restore_esm(m):
        new_path = re.sub(r'/dist/js/bootstrap\.bundle\.min\.js$', '/+esm', m.group(2))
        return m.group(1) + new_path + m.group(3)

    new_content = BUNDLE_PATTERN.sub(restore_esm, content)

    if new_content != content:
        stats["fixed"] += 1
        print(f"  ✔ {path.name}")
        if not dry_run:
            path.write_text(new_content, encoding="utf-8")

def main():
    if len(sys.argv) < 2:
        print("Uso: py fix_bootstrap_esm.py <site_root> [--dry-run]")
        sys.exit(1)

    site_root = Path(sys.argv[1]).resolve()
    dry_run = "--dry-run" in sys.argv

    print(f"Sito root : {site_root}")
    print(f"Ripristino +esm nell'importmap...")
    print()

    html_files = list(site_root.rglob("*.html"))
    print(f"File HTML : {len(html_files)}")
    print()

    stats = {"fixed": 0}
    for f in html_files:
        fix_file(f, dry_run, stats)

    print()
    print(f"File ripristinati: {stats['fixed']}")

if __name__ == "__main__":
    main()
