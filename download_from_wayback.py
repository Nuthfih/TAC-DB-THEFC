#!/usr/bin/env python3
"""
download_from_wayback.py
------------------------
Legge external_urls.txt, scarica ogni asset dalla Wayback Machine
nella cartella locale corretta, poi aggiorna i CSS sostituendo
gli URL assoluti con percorsi relativi locali.

Uso:
    python download_from_wayback.py <site_root> [--urls external_urls.txt] [--dry-run]

Esempio:
    python download_from_wayback.py "D:\alchemsitdb\way\ACDBfixed" --dry-run
    python download_from_wayback.py "D:\alchemsitdb\way\ACDBfixed"
"""

import argparse
import re
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

# Data snapshot Wayback — usa una data recente generica, il if_ fa il redirect
# automatico allo snapshot più vicino
WAYBACK_DATE = "20240601000000"
WAYBACK_BASE = f"https://web.archive.org/web/{WAYBACK_DATE}if_/"

def wayback_url(original_url: str) -> str:
    return WAYBACK_BASE + original_url


def download_file(url: str, dest: Path, dry_run: bool) -> bool:
    """Scarica un file da Wayback. Ritorna True se successo."""
    if dest.exists():
        print(f"  già presente, skip")
        return True

    if dry_run:
        print(f"  [DRY-RUN] scaricherebbe da: {wayback_url(url)}")
        return True

    dest.parent.mkdir(parents=True, exist_ok=True)
    wb_url = wayback_url(url)

    for attempt in range(1, 4):
        try:
            req = urllib.request.Request(wb_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read()
            dest.write_bytes(data)
            print(f"  ✔ scaricato ({len(data)//1024} KB)")
            return True
        except urllib.error.HTTPError as e:
            print(f"  ✘ HTTP {e.code}")
            return False
        except Exception as e:
            print(f"  tentativo {attempt}/3 fallito: {e}")
            if attempt < 3:
                wait = 10 * attempt
                print(f"  aspetto {wait}s e riprovo...")
                time.sleep(wait)
    print(f"  ✘ tutti i tentativi falliti")
    return False


def update_css_files(css_dir: Path, url_to_local: dict[str, str], dry_run: bool):
    """Sostituisce gli URL assoluti CDN con percorsi relativi nei CSS."""
    css_files = list(css_dir.rglob("*.css"))
    print(f"\nAggiorno {len(css_files)} file CSS in {css_dir}")

    for css_file in css_files:
        content = css_file.read_text(encoding="utf-8", errors="replace")
        new_content = content
        changes = 0

        for original_url, relative_path in url_to_local.items():
            if original_url in new_content:
                new_content = new_content.replace(original_url, relative_path)
                changes += 1

        if changes:
            rel = css_file.name
            print(f"  {rel}: {changes} sostituzione/i")
            if not dry_run:
                css_file.write_text(new_content, encoding="utf-8")
        
    if dry_run:
        print("  [DRY-RUN] nessun file modificato")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("site_root", help="Cartella radice del sito (ACDBfixed)")
    parser.add_argument("--urls", default="external_urls.txt",
                        help="File con la lista degli URL (default: external_urls.txt)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Mostra cosa farebbe senza scaricare né modificare")
    args = parser.parse_args()

    site_root  = Path(args.site_root).resolve()
    cdn_root   = site_root / "cdn.alchemistcodedb.com"
    assets_dir = cdn_root / "assets"
    urls_file  = Path(args.urls)

    if not urls_file.exists():
        print(f"[ERROR] File URL non trovato: {urls_file}")
        print("Esegui prima extract_external_urls.py per generarlo.")
        sys.exit(1)

    urls = [
        line.strip() for line in urls_file.read_text(encoding="utf-8").splitlines()
        if line.strip() and line.strip().startswith("http")
    ]

    print(f"Sito root  : {site_root}")
    print(f"Assets dir : {assets_dir}")
    print(f"URL da file: {len(urls)}")
    print(f"Modalità   : {'DRY-RUN' if args.dry_run else 'SCRITTURA'}")
    print()

    # Mappa url_originale → percorso relativo da usare nel CSS
    # Il CSS è in cdn.alchemistcodedb.com/assets/ quindi il path relativo
    # per una risorsa nella stessa cartella è solo il filename
    url_to_local: dict[str, str] = {}
    ok = 0
    fail = 0

    for url in urls:
        # Ricava il path dopo il dominio
        # es. https://cdn.alchemistcodedb.com/assets/ability-types-xxx.png
        #  → /assets/ability-types-xxx.png
        match = re.search(r'cdn\.alchemistcodedb\.com(/.*)', url)
        if not match:
            continue

        cdn_path = match.group(1)  # /assets/xxx.png o /images/xxx.png
        local_file = cdn_root / cdn_path.lstrip("/")
        filename = local_file.name

        # Il CSS è nella stessa cartella assets, quindi il percorso relativo
        # è semplicemente il filename (per /assets/) o ../images/... (per /images/)
        parts = Path(cdn_path.lstrip("/")).parts  # ('assets', 'xxx.png')
        if parts[0] == "assets":
            relative = filename  # stesso livello del CSS
        else:
            relative = "../" + "/".join(parts)  # risale di un livello

        url_to_local[url] = relative

        print(f"[{urls.index(url)+1}/{len(urls)}] {filename}")
        if download_file(url, local_file, args.dry_run):
            ok += 1
        else:
            fail += 1

        if not args.dry_run:
            time.sleep(3)  # pausa tra download

    # Aggiorna i CSS
    update_css_files(assets_dir, url_to_local, args.dry_run)

    print()
    print("═" * 60)
    print(f"Scaricati con successo : {ok}")
    print(f"Falliti                : {fail}")
    if args.dry_run:
        print("\n⚠  DRY-RUN: nessun file scaricato né modificato.")
        print("   Rilancia senza --dry-run per applicare.")


if __name__ == "__main__":
    main()
