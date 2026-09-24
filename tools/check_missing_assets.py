#!/usr/bin/env python3
"""
check_missing_assets.py
-----------------------
Legge i CSS in cdn.alchemistcodedb.com/assets/ e trova quali
sottocartelle di cdn.alchemistcodedb.com/images/ sono referenziate
ma mancano fisicamente.

Uso:
    python check_missing_assets.py <site_root>

Esempio:
    python check_missing_assets.py "D:\alchemsitdb\way\ACDBfixed"
"""

import argparse
import re
import sys
from pathlib import Path
from collections import defaultdict

CDN_PATTERN = re.compile(
    r'cdn\.alchemistcodedb\.com(/images/[^\s"\')\]>]+)',
    re.IGNORECASE,
)

def scan_file(file_path):
    try:
        content = file_path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return set()
    return set(m.group(1) for m in CDN_PATTERN.finditer(content))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("site_root", help="Cartella radice del sito (ACDBfixed)")
    args = parser.parse_args()

    site_root = Path(args.site_root).resolve()
    cdn_root  = site_root / "cdn.alchemistcodedb.com"
    assets_dir = cdn_root / "assets"
    images_dir = cdn_root / "images"

    if not assets_dir.exists():
        print(f"[ERROR] Cartella assets non trovata: {assets_dir}")
        sys.exit(1)

    print(f"Leggo CSS da  : {assets_dir}")
    print(f"Controllo in  : {images_dir}")
    print()

    # Scansiona tutti i CSS nella cartella assets
    css_files = list(assets_dir.rglob("*.css"))
    print(f"File CSS trovati: {len(css_files)}")

    all_paths = set()
    for f in css_files:
        all_paths |= scan_file(f)

    print(f"URL /images/... unici trovati: {len(all_paths)}")
    print()

    # Raggruppa per sottocartella di /images/
    # es. /images/PortraitsM/xxx.png  → sottocartella: PortraitsM
    # es. /images/xxx.png             → sottocartella: (root)
    folder_files = defaultdict(list)
    for cdn_path in sorted(all_paths):
        # cdn_path è tipo /images/PortraitsM/file.png
        parts = Path(cdn_path.lstrip("/")).parts  # ('images', 'PortraitsM', 'file.png')
        if len(parts) >= 3:
            subfolder = parts[1]  # 'PortraitsM'
        else:
            subfolder = "(root)"
        folder_files[subfolder].append(cdn_path)

    # Controlla quali sottocartelle esistono in images/
    missing = []
    present = []

    for subfolder in sorted(folder_files):
        if subfolder == "(root)":
            local = images_dir
        else:
            local = images_dir / subfolder

        if local.exists():
            present.append(subfolder)
        else:
            missing.append(subfolder)

    print(f"Sottocartelle presenti : {len(present)}")
    print(f"Sottocartelle mancanti : {len(missing)}")
    print()

    if present:
        print("PRESENTI in images/:")
        for f in present:
            print(f"  images/{f}  ({len(folder_files[f])} file referenziati)")
        print()

    if missing:
        print("MANCANTI in images/:")
        for f in missing:
            print(f"  images/{f}  ({len(folder_files[f])} file referenziati)")

        out_file = Path("missing_assets.txt")
        with open(out_file, "w", encoding="utf-8") as f:
            f.write(f"Sottocartelle mancanti in images/ ({len(missing)} totali)\n")
            f.write("=" * 60 + "\n\n")
            for subfolder in missing:
                f.write(f"\nimages/{subfolder}/  ({len(folder_files[subfolder])} file)\n")
                for cdn_path in sorted(folder_files[subfolder]):
                    f.write(f"   https://cdn.alchemistcodedb.com{cdn_path}\n")

        print()
        print(f"Lista salvata in: {out_file.resolve()}")
    else:
        print("Tutte le sottocartelle sono presenti!")


if __name__ == "__main__":
    main()
