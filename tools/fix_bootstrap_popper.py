#!/usr/bin/env python3
"""
fix_bootstrap_popper.py
-----------------------
Scarica il vero Bootstrap ESM bundle (con Popper incluso)
e lo salva come +esm in locale.

Il file +esm deve essere il bundle ESM che include Popper,
non il solo bootstrap.esm.min.js che richiede Popper esterno.

Uso:
    py fix_bootstrap_popper.py <site_root>
"""

import sys
import time
import urllib.request
from pathlib import Path

def download(url, dest):
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
    return False

def main():
    if len(sys.argv) < 2:
        print("Uso: py fix_bootstrap_popper.py <site_root>")
        sys.exit(1)

    site_root = Path(sys.argv[1]).resolve()
    esm_dest = site_root / "cdn.jsdelivr.net" / "npm" / "bootstrap@5.3.3" / "+esm"

    print(f"Scarico Bootstrap ESM bundle (con Popper incluso)...")
    print(f"Destinazione: {esm_dest}")
    print()

    # Questo è il vero bundle ESM di Bootstrap che include Popper
    # Usiamo unpkg che serve il bundle completo per il path +esm
    url = "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.esm.min.js"
    
    # Però il problema è che bootstrap.esm.min.js NON include Popper.
    # La soluzione corretta è creare un wrapper che re-esporta tutto
    # dal bundle UMD come modulo ES
    
    wrapper = r"""// Bootstrap ESM wrapper - include Popper via global
// Carica prima il bundle UMD (già in pagina via <script src>)
// poi re-esporta le classi come named exports ES
const _bs = window.bootstrap || {};

export const Alert = _bs.Alert;
export const Button = _bs.Button;
export const Carousel = _bs.Carousel;
export const Collapse = _bs.Collapse;
export const Dropdown = _bs.Dropdown;
export const Modal = _bs.Modal;
export const Offcanvas = _bs.Offcanvas;
export const Popover = _bs.Popover;
export const ScrollSpy = _bs.ScrollSpy;
export const Tab = _bs.Tab;
export const Toast = _bs.Toast;
export const Tooltip = _bs.Tooltip;

export default _bs;
"""
    
    esm_dest.parent.mkdir(parents=True, exist_ok=True)
    esm_dest.write_text(wrapper, encoding="utf-8")
    print(f"  ✔ Wrapper ESM creato ({len(wrapper)} bytes)")
    print()
    print("Il wrapper re-esporta le classi Bootstrap dal bundle UMD")
    print("già caricato via <script src='bootstrap.bundle.min.js'>")

if __name__ == "__main__":
    main()
