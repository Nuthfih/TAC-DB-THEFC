#!/usr/bin/env python3
"""
fix_planner.py
--------------
1. Legge la cache HTTrack e costruisce la mappa slug → file planner statico
2. Per ogni pagina unit (unit/SLUG.html) trova il planner corrispondente
3. Sostituisce il link "Unit Planner" nella navbar con il file statico locale
4. Scarica dalla Wayback Machine i JS mancanti per far funzionare i planner statici

Uso:
    python fix_planner.py <site_root> [--cache hts-cache/new.txt] [--dry-run]

Esempio:
    python fix_planner.py "D:\alchemsitdb\way\ACDBfixed" --dry-run
    python fix_planner.py "D:\alchemsitdb\way\ACDBfixed"
"""

import argparse
import base64
import json
import re
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

# JS necessari per far funzionare i planner statici
JS_TO_DOWNLOAD = [
    "https://cdn.alchemistcodedb.com/assets/application-ad1aaf18d6cc0bdb593cef89d6641606594b9c51cc262c0308cb74b33bbbd321.js",
    "https://cdn.alchemistcodedb.com/assets/turbo.min-ecfeff9c81fc57c5e6a5873fbecb23ddb3fef90c50c5134e9867e04c4c602c0b.js",
    "https://cdn.alchemistcodedb.com/assets/stimulus.min-6afb6bb2ff09862f77125fd310ebb418e5570036adea98753b60ed6529ad328b.js",
    "https://cdn.alchemistcodedb.com/assets/stimulus-loading-3576ce92b149ad5d6959438c6f291e2426c86df3b874c525b30faad51b0d96b3.js",
    "https://cdn.alchemistcodedb.com/assets/controllers/application-368d98631bccbf2349e0d4f8269afb3fe9625118341966de054759d96ea86c7e.js",
    "https://cdn.alchemistcodedb.com/assets/controllers/form_controller-dc4b81ca94f366ea10045fd6b8be4645c57eb8537594af32ddccb6610b91f3f1.js",
    "https://cdn.alchemistcodedb.com/assets/controllers/index-2db729dddcc5b979110e98de4b6720f83f91a123172e87281d5a58410fc43806.js",
    "https://cdn.alchemistcodedb.com/assets/controllers/planner_controller-13884b106a9c48e9ac994ae652e4029ecda78e3c0c83d247de7431e2285812af.js",
    "https://cdn.alchemistcodedb.com/assets/controllers/search_controller-ab0535ec59647538edb44548609f231ce8bad80d57fd7ad34da97eed1a5ab64b.js",
    "https://cdn.alchemistcodedb.com/assets/controllers/tab_controller-277b56d8097c3956b52a26ff8d1cc38960f6931c4d8c934263542eecbb894d29.js",
    "https://cdn.alchemistcodedb.com/assets/controllers/theme_controller-c3357dfda7f50a76344be224390b55a89e0ec28a97db349955993aece3564177.js",
    "https://cdn.alchemistcodedb.com/assets/controllers/tooltip_controller-e1a62e987db93e2f37b52dda204b8d818e5ac43205c091e7fc580ec6ab656c7f.js",
    "https://cdn.alchemistcodedb.com/assets/controllers/visibility_controller-1c890f0e546f1e7d2a429ca7e419554e5064f7f53f01d3760751a942bc43ffae.js",
]

WAYBACK_DATE = "20250101000000"
WAYBACK_BASE = f"https://web.archive.org/web/{WAYBACK_DATE}if_/"


def wayback_url(url):
    return WAYBACK_BASE + url


def download_file(url, dest, dry_run):
    if dest.exists():
        print(f"    già presente, skip")
        return True
    if dry_run:
        print(f"    [DRY-RUN] scaricherebbe: {dest.name}")
        return True
    dest.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(1, 4):
        try:
            req = urllib.request.Request(wayback_url(url), headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read()
            dest.write_bytes(data)
            print(f"    ✔ scaricato ({len(data)//1024} KB)")
            return True
        except urllib.error.HTTPError as e:
            print(f"    ✘ HTTP {e.code}")
            return False
        except Exception as e:
            print(f"    tentativo {attempt}/3 fallito: {e}")
            if attempt < 3:
                wait = 10 * attempt
                print(f"    aspetto {wait}s...")
                time.sleep(wait)
    print(f"    ✘ tutti i tentativi falliti")
    return False


def load_planner_map(cache_path):
    """Legge la cache e restituisce {slug: filename_planner} per GL e JP."""
    gl_map = {}  # slug → "plannerXXXX.html"
    jp_map = {}  # slug → "jp/plannerXXXX.html"

    if not cache_path.exists():
        print(f"[WARN] Cache non trovata: {cache_path}")
        return gl_map, jp_map

    with open(cache_path, encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if "planner?build=" not in line:
                continue
            parts = line.split("\t")
            if len(parts) < 9:
                continue
            url = parts[7].strip()
            local = parts[8].strip().replace("\\", "/")

            # Estrai il parametro build dall'URL
            m = re.search(r'build=([A-Za-z0-9+/=]+)', url)
            if not m:
                continue
            try:
                data = json.loads(base64.b64decode(m.group(1)).decode("utf-8"))
                slug = data.get("u", "")
            except Exception:
                continue

            if not slug:
                continue

            # Ricava solo il filename (es. plannerbd91.html o jp/plannerXXXX.html)
            if "/jp/planner" in local:
                fname = "jp/" + local.split("/jp/")[-1]
                jp_map[slug] = fname
            else:
                fname = local.split("/www.alchemistcodedb.com/")[-1]
                gl_map[slug] = fname

    return gl_map, jp_map


def fix_unit_pages(site_root, gl_map, jp_map, dry_run):
    """Aggiorna il link 'Unit Planner' nelle pagine unit con il file statico."""
    unit_dir = site_root / "www.alchemistcodedb.com" / "unit"
    jp_unit_dir = site_root / "www.alchemistcodedb.com" / "jp" / "unit"

    fixed = 0
    not_found = []

    for html_dir, planner_map, prefix in [
        (unit_dir,    gl_map, ""),
        (jp_unit_dir, jp_map, "jp/"),
    ]:
        if not html_dir.exists():
            print(f"  [SKIP] cartella non trovata: {html_dir}")
            continue

        for html_file in html_dir.glob("*.html"):
            slug = html_file.stem  # es. "estela"
            if slug not in planner_map:
                not_found.append(f"{prefix}{slug}")
                continue

            planner_file = planner_map[slug]  # es. "plannerbd91.html"

            # Il link da sostituire — nella pagina unit punta a ../planner.html
            # o a data-turbo-prefetch="false" href="planner.html"
            try:
                content = html_file.read_text(encoding="utf-8", errors="replace")
            except Exception:
                continue

            # Sostituisce href="planner.html" o href="../planner.html" con il file statico
            # La pagina unit sta in unit/ quindi il planner statico è ../plannerXXXX.html
            if prefix == "":
                new_href = f"../{planner_file}"
            else:
                new_href = f"../../{planner_file}"

            old_pattern = re.compile(
                r'(href=")(?:\.\.\/)?(?:jp\/)?planner\.html(")',
                re.IGNORECASE
            )

            new_content, n = old_pattern.subn(
                lambda m: m.group(1) + new_href + m.group(2),
                content
            )

            if n > 0:
                fixed += 1
                print(f"  ✔ {prefix}unit/{slug}.html → {planner_file}")
                if not dry_run:
                    html_file.write_text(new_content, encoding="utf-8")

    return fixed, not_found


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("site_root", help="Cartella radice del sito (ACDBfixed)")
    parser.add_argument("--cache", default=None,
                        help="Percorso hts-cache/new.txt (default: <site_root>/hts-cache/new.txt)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Mostra cosa farebbe senza modificare niente")
    parser.add_argument("--skip-download", action="store_true",
                        help="Salta il download dei JS dalla Wayback Machine")
    args = parser.parse_args()

    site_root  = Path(args.site_root).resolve()
    cdn_root   = site_root / "cdn.alchemistcodedb.com"
    cache_path = Path(args.cache) if args.cache else site_root / "hts-cache" / "new.txt"

    print(f"Sito root : {site_root}")
    print(f"Modalità  : {'DRY-RUN' if args.dry_run else 'SCRITTURA'}")
    print()

    # ── STEP 1: Scarica JS mancanti ────────────────────────────────────────────
    if not args.skip_download:
        print("═" * 60)
        print("STEP 1 — Download JS dalla Wayback Machine")
        print("═" * 60)
        ok = 0
        fail = 0
        for url in JS_TO_DOWNLOAD:
            m = re.search(r'cdn\.alchemistcodedb\.com(/.*)', url)
            if not m:
                continue
            local = cdn_root / m.group(1).lstrip("/")
            print(f"  {local.name}")
            if download_file(url, local, args.dry_run):
                ok += 1
            else:
                fail += 1
            if not args.dry_run and not local.exists():
                time.sleep(3)
        print(f"\n  Scaricati: {ok}  Falliti: {fail}")
    else:
        print("STEP 1 — Download JS saltato (--skip-download)")

    print()

    # ── STEP 2: Costruisce mappa slug → planner statico ────────────────────────
    print("═" * 60)
    print("STEP 2 — Leggo cache HTTrack per mappa planner")
    print("═" * 60)
    gl_map, jp_map = load_planner_map(cache_path)
    print(f"  Planner GL trovati: {len(gl_map)}")
    print(f"  Planner JP trovati: {len(jp_map)}")
    print()

    # ── STEP 3: Aggiorna link nelle pagine unit ────────────────────────────────
    print("═" * 60)
    print("STEP 3 — Aggiorno link Unit Planner nelle pagine unit")
    print("═" * 60)
    fixed, not_found = fix_unit_pages(site_root, gl_map, jp_map, args.dry_run)

    print()
    print("═" * 60)
    print(f"Pagine aggiornate        : {fixed}")
    print(f"Slug senza planner statico: {len(not_found)}")
    if not_found and len(not_found) <= 20:
        print("  Mancanti:", ", ".join(not_found[:20]))
    elif not_found:
        print(f"  (primi 20): {', '.join(not_found[:20])}")

    if args.dry_run:
        print()
        print("⚠  DRY-RUN: nessun file modificato né scaricato.")


if __name__ == "__main__":
    main()
