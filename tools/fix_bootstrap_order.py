#!/usr/bin/env python3
"""
fix_bootstrap_order.py
----------------------
1. Sposta bootstrap.bundle.min.js PRIMA dell'importmap nell'<head>
2. Ricrea il wrapper +esm che legge window.bootstrap (ora disponibile)

Uso:
    py fix_bootstrap_order.py <site_root> [--dry-run]
"""

import re
import sys
from pathlib import Path

# Script bootstrap da spostare/aggiungere nell'head
BUNDLE_SCRIPT = '<script src="{prefix}cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>'

# Pattern per trovare il bundle in fondo alla pagina
BUNDLE_AT_BOTTOM = re.compile(
    r'\s*<script src="([^"]*cdn\.jsdelivr\.net/npm/bootstrap@5\.3\.3/dist/js/bootstrap\.bundle\.min\.js)"></script>\s*\n?',
    re.IGNORECASE
)

# Pattern per trovare l'importmap (dove inserire il bundle prima)
IMPORTMAP_START = re.compile(
    r'(<script type="importmap")',
    re.IGNORECASE
)

def fix_file(path, dry_run, stats):
    try:
        content = path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return

    if 'bootstrap.bundle.min.js' not in content:
        return
    if '<script type="importmap"' not in content:
        return

    # Trova il path del bundle già presente
    m = BUNDLE_AT_BOTTOM.search(content)
    if not m:
        return

    bundle_src = m.group(1)  # es. ../../cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js

    # Rimuovi il bundle dal fondo
    new_content = BUNDLE_AT_BOTTOM.sub('\n', content)

    # Inserisci il bundle PRIMA dell'importmap
    bundle_tag = f'<script src="{bundle_src}"></script>\n'
    new_content = IMPORTMAP_START.sub(bundle_tag + r'\1', new_content, count=1)

    if new_content != content:
        stats["fixed"] += 1
        print(f"  ✔ {path.name}")
        if not dry_run:
            path.write_text(new_content, encoding="utf-8")

def main():
    if len(sys.argv) < 2:
        print("Uso: py fix_bootstrap_order.py <site_root> [--dry-run]")
        sys.exit(1)

    site_root = Path(sys.argv[1]).resolve()
    dry_run = "--dry-run" in sys.argv

    # Ricrea anche il wrapper +esm
    esm_path = site_root / "cdn.jsdelivr.net" / "npm" / "bootstrap@5.3.3" / "+esm"
    wrapper = """// Bootstrap ESM wrapper
// bootstrap.bundle.min.js e' gia caricato nell'<head> prima di questo modulo
var _bs = window.bootstrap || {};
export var Alert = _bs.Alert;
export var Button = _bs.Button;
export var Carousel = _bs.Carousel;
export var Collapse = _bs.Collapse;
export var Dropdown = _bs.Dropdown;
export var Modal = _bs.Modal;
export var Offcanvas = _bs.Offcanvas;
export var Popover = _bs.Popover;
export var ScrollSpy = _bs.ScrollSpy;
export var Tab = _bs.Tab;
export var Toast = _bs.Toast;
export var Tooltip = _bs.Tooltip;
export default _bs;
"""
    if not dry_run:
        esm_path.parent.mkdir(parents=True, exist_ok=True)
        esm_path.write_text(wrapper, encoding="utf-8")
        print(f"Wrapper +esm aggiornato: {esm_path}")
    print()

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
