#!/usr/bin/env python3
"""
download_bootstrap.py
---------------------
Scarica Bootstrap e le altre librerie CDN mancanti in locale.

Uso:
    py download_bootstrap.py <site_root>
"""

import sys
import time
import urllib.request
from pathlib import Path

# File da scaricare → dove salvarli (relativo alla site_root)
FILES = [
    # Bootstrap JS (bundle con Popper incluso)
    (
        "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js",
        "cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"
    ),
    # Bootstrap ESM
    (
        "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.esm.min.js",
        "cdn.jsdelivr.net/npm/bootstrap@5.3.3/+esm"
    ),
    # Popper
    (
        "https://cdn.jsdelivr.net/npm/@popperjs/core@2.11.8/dist/umd/popper.min.js",
        "cdn.jsdelivr.net/npm/@popperjs/core@2.11.8/dist/umd/popper.min.js"
    ),
    # Rails request.js
    (
        "https://cdn.jsdelivr.net/npm/@rails/request.js@0.0.9/dist/requestjs.min.js",
        "cdn.jsdelivr.net/npm/@rails/request.js@0.0.9/dist/requestjs.min.js"
    ),
    # Combobox nav
    (
        "https://cdn.jsdelivr.net/npm/@github/combobox-nav@3.0.1/dist/index.min.js",
        "cdn.jsdelivr.net/npm/@github/combobox-nav@3.0.1/dist/index.min.js"
    ),
    # Dexie
    (
        "https://cdn.jsdelivr.net/npm/dexie@4.0.7/dist/dexie.min.js",
        "cdn.jsdelivr.net/npm/dexie@4.0.7/dist/dexie.min.js"
    ),
    # Tippy
    (
        "https://unpkg.com/tippy.js@6.3.7/dist/tippy-bundle.umd.min.js",
        "unpkg.com/tippy.js@6.3.7/dist/tippy-bundle.umd.min.js"
    ),
]

def download(url, dest):
    if dest.exists():
        print(f"  già presente: {dest.name}")
        return True
    dest.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(1, 4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read()
            dest.write_bytes(data)
            print(f"  ✔ {dest.name} ({len(data)//1024} KB)")
            return True
        except Exception as e:
            print(f"  tentativo {attempt}/3: {e}")
            if attempt < 3:
                time.sleep(5)
    print(f"  ✘ fallito: {url}")
    return False

def main():
    if len(sys.argv) < 2:
        print("Uso: py download_bootstrap.py <site_root>")
        sys.exit(1)

    site_root = Path(sys.argv[1]).resolve()
    print(f"Sito root: {site_root}\n")

    for url, rel_path in FILES:
        dest = site_root / rel_path
        print(f"{rel_path}")
        download(url, dest)
        time.sleep(1)

    print("\nFatto! Ricarica il browser.")

if __name__ == "__main__":
    main()
