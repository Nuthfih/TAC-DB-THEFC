#!/usr/bin/env python3
"""
ripristina_span.py
------------------
Fa il contrario di converti_span.py:
trova gli <span> con style background-image url(...elements/... o ...origins/...)
e li rimette con data-tippy-content e class CSS dal mappings.json

Uso:
    python ripristina_span.py <cartella> [--dry-run]

Esempi:
    # Cartella normale (../../elements/)
    python ripristina_span.py "D:\alchemsitdb\way\ACDBfixed\www.alchemistcodedb.com\unit"

    # Cartella jp (../../../elements/)
    python ripristina_span.py "D:\alchemsitdb\way\ACDBfixed\www.alchemistcodedb.com\jp\unit"
"""

import json
import re
import sys
from pathlib import Path

# Carica mappings.json dalla stessa cartella dello script
MAPPINGS_FILE = Path(__file__).parent / "mappings.json"

# Cattura lo span inline prodotto da converti_span.py
# Cerca: data-tippy-content="NOME" e url('...NOME.png') dentro uno span con style
SPAN_REGEX = re.compile(
    r'<span\s*\n?\s*data-tippy-content="([^"]+)"\s*\n?\s*style="[^"]*background-image:\s*url\([^)]+\)[^"]*"\s*\n?\s*></span>',
    re.IGNORECASE | re.DOTALL
)

def build_replacement(name, css_class):
    return f'<span data-tippy-content="{name}" class="{css_class}"></span>'

def process_file(path, name_to_class, dry_run, stats):
    try:
        content = path.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        print(f"  [ERROR] {path}: {e}")
        return

    new_content = content
    changes = 0

    for m in SPAN_REGEX.finditer(content):
        name = m.group(1).strip()
        if name in name_to_class:
            old = m.group(0)
            new = build_replacement(name, name_to_class[name])
            new_content = new_content.replace(old, new, 1)
            changes += 1
            stats["fixed"] += 1
        else:
            stats["unknown"] += 1

    if changes:
        stats["files"] += 1
        print(f"  ✔ {path.name}: {changes} sostituzione/i")
        if not dry_run:
            path.write_text(new_content, encoding="utf-8")

def main():
    if len(sys.argv) < 2:
        print("Uso: python ripristina_span.py <cartella> [--dry-run]")
        sys.exit(1)

    folder = Path(sys.argv[1]).resolve()
    dry_run = "--dry-run" in sys.argv

    if not folder.exists():
        print(f"[ERROR] Cartella non trovata: {folder}")
        sys.exit(1)

    if not MAPPINGS_FILE.exists():
        print(f"[ERROR] mappings.json non trovato: {MAPPINGS_FILE}")
        sys.exit(1)

    with open(MAPPINGS_FILE, encoding="utf-8") as f:
        name_to_class = json.load(f)

    print(f"Cartella  : {folder}")
    print(f"Mappings  : {len(name_to_class)} nomi caricati")
    print(f"Modalità  : {'DRY-RUN' if dry_run else 'SCRITTURA'}")
    print()

    html_files = list(folder.glob("*.html"))
    print(f"File HTML : {len(html_files)}")
    print()

    stats = {"files": 0, "fixed": 0, "unknown": 0}

    for f in html_files:
        process_file(f, name_to_class, dry_run, stats)

    print()
    print("═" * 50)
    print(f"File modificati   : {stats['files']}")
    print(f"Span ripristinati : {stats['fixed']}")
    if stats["unknown"]:
        print(f"Span non mappati  : {stats['unknown']} (nome non in mappings.json)")
    if dry_run:
        print("\n⚠  DRY-RUN: nessun file modificato.")

if __name__ == "__main__":
    main()
