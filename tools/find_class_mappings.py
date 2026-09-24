#!/usr/bin/env python3
"""
find_class_mappings.py
----------------------
Scansiona i file HTML della versione vecchia del sito e trova
la corrispondenza tra data-tippy-content (nome) e class CSS.

Uso:
    python find_class_mappings.py <cartella_vecchio_sito>

Output:
    mappings.json  — dizionario {nome: classe_css}
    mappings.txt   — leggibile a occhio
"""

import json
import re
import sys
from pathlib import Path

ELEMENTS = {
    "All", "Dark", "Fire", "Wind", "Light", "Thunder", "Water",
    "轟雷", "宵闇", "翠風", "烈火", "暁光", "蒼水"
}

ORIGINS = {
    "Desert Zone", "Envylia", "Gluttony Foss", "Greed Dike", "Lost Blue",
    "Lustburg", "Northern Pride", "Other", "Saga Region",
    "Slothstein", "Wadatsumi", "Wratharis"
}

ALL_NAMES = ELEMENTS | ORIGINS

# Cerca <span data-tippy-content="NOME" class="...">
SPAN_REGEX = re.compile(
    r'<span\s+data-tippy-content="([^"]+)"\s+class="([^"]+)"',
    re.IGNORECASE
)
# Anche nell'ordine inverso: class prima di data-tippy-content
SPAN_REGEX_REV = re.compile(
    r'<span\s+class="([^"]+)"\s+data-tippy-content="([^"]+)"',
    re.IGNORECASE
)

def scan_file(path, found):
    try:
        content = path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return

    # Ordine: data-tippy-content prima
    for m in SPAN_REGEX.finditer(content):
        name = m.group(1).strip()
        css_class = m.group(2).strip()
        if name in ALL_NAMES and name not in found:
            found[name] = css_class
            print(f"  TROVATO: '{name}' → '{css_class}'")

    # Ordine inverso: class prima
    for m in SPAN_REGEX_REV.finditer(content):
        css_class = m.group(1).strip()
        name = m.group(2).strip()
        if name in ALL_NAMES and name not in found:
            found[name] = css_class
            print(f"  TROVATO: '{name}' → '{css_class}'")


def main():
    if len(sys.argv) < 2:
        print("Uso: python find_class_mappings.py <cartella_vecchio_sito>")
        sys.exit(1)

    root = Path(sys.argv[1]).resolve()
    if not root.exists():
        print(f"[ERROR] Cartella non trovata: {root}")
        sys.exit(1)

    print(f"Scansiono: {root}")
    print(f"Cerco {len(ALL_NAMES)} nomi...")
    print()

    found = {}
    # Scansiona solo le due cartelle specifiche
    folders = [
        root / "unit",
        root / "jp" / "unit",
    ]
    html_files = []
    for folder in folders:
        if folder.exists():
            html_files += list(folder.glob("*.html")) + list(folder.glob("*.htm"))
            print(f"  Cartella: {folder} ({len(list(folder.glob('*.html')))} file)")
        else:
            print(f"  [SKIP] non trovata: {folder}")
    print(f"File HTML totali: {len(html_files)}")
    print()

    for i, f in enumerate(html_files, 1):
        if len(found) == len(ALL_NAMES):
            print(f"\nTutti i nomi trovati dopo {i} file! Mi fermo.")
            break

        # Progress ogni 500 file
        if i % 500 == 0:
            print(f"  [{i}/{len(html_files)}] trovati finora: {len(found)}/{len(ALL_NAMES)}")

        scan_file(f, found)

    print()
    print("═" * 60)
    print(f"Trovati: {len(found)}/{len(ALL_NAMES)}")

    # Mostra cosa manca
    missing = ALL_NAMES - set(found.keys())
    if missing:
        print(f"\nAncora mancanti ({len(missing)}):")
        for m in sorted(missing):
            print(f"  - {m}")

    # Salva JSON
    out_json = Path("mappings.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(found, f, ensure_ascii=False, indent=2)
    print(f"\nSalvato: {out_json.resolve()}")

    # Salva TXT leggibile
    out_txt = Path("mappings.txt")
    with open(out_txt, "w", encoding="utf-8") as f:
        f.write("ELEMENTI\n" + "="*40 + "\n")
        for name in sorted(ELEMENTS):
            cls = found.get(name, "NON TROVATO")
            f.write(f"  {name:<20} → {cls}\n")
        f.write("\nORIGINI\n" + "="*40 + "\n")
        for name in sorted(ORIGINS):
            cls = found.get(name, "NON TROVATO")
            f.write(f"  {name:<20} → {cls}\n")
    print(f"Salvato: {out_txt.resolve()}")


if __name__ == "__main__":
    main()
