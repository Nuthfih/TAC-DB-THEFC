#!/usr/bin/env python3
"""
fix_turbo_actions.py
--------------------
Ripristina gli attributi action="..." di turbo-stream che sono stati
erroneamente convertiti in URL Wayback da fix_missing_links.py

Es. ripristina:
  action="https://web.archive.org/web/*/https://www.alchemistcodedb.com/replace"
  → action="replace"

  action="https://web.archive.org/web/*/https://www.alchemistcodedb.com/search"
  (nei form search) → lascia stare (quelli sono form action legittimi)

Uso:
    py fix_turbo_actions.py <site_root> [--dry-run]
"""

import re
import sys
from pathlib import Path

# Questi sono attributi Turbo che devono tornare al valore originale
# Il pattern wayback che li ha trasformati
WAYBACK_PREFIX = "https://web.archive.org/web/*/https://www.alchemistcodedb.com/"

# Mappa URL wayback → valore originale per gli action Turbo
# Solo quelli che sono attributi di turbo-stream o data-action Turbo
TURBO_ACTIONS = {
    WAYBACK_PREFIX + "replace": "replace",
    WAYBACK_PREFIX + "append":  "append",
    WAYBACK_PREFIX + "prepend": "prepend",
    WAYBACK_PREFIX + "update":  "update",
    WAYBACK_PREFIX + "remove":  "remove",
    WAYBACK_PREFIX + "before":  "before",
    WAYBACK_PREFIX + "after":   "after",
    WAYBACK_PREFIX + "refresh": "refresh",
    WAYBACK_PREFIX + "morph":   "morph",
}

# Pattern per trovare turbo-stream con action wayback
TURBO_STREAM_REGEX = re.compile(
    r'(<turbo-stream[^>]*action=")(' + re.escape(WAYBACK_PREFIX) + r'[^"]+)(")',
    re.IGNORECASE
)

def fix_turbo(match):
    prefix = match.group(1)
    url = match.group(2)
    suffix = match.group(3)
    # Estrai l'azione dall'URL (ultima parte dopo /)
    action = url.split("/")[-1]
    return prefix + action + suffix

def process_file(path, dry_run, stats):
    try:
        content = path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return

    if "turbo-stream" not in content and WAYBACK_PREFIX not in content:
        return

    new_content, n = TURBO_STREAM_REGEX.subn(fix_turbo, content)

    if n > 0:
        stats["fixed"] += n
        stats["files"] += 1
        print(f"  ✔ {path.name}: {n} turbo-stream ripristinati")
        if not dry_run:
            path.write_text(new_content, encoding="utf-8")

def main():
    if len(sys.argv) < 2:
        print("Uso: py fix_turbo_actions.py <site_root> [--dry-run]")
        sys.exit(1)

    site_root = Path(sys.argv[1]).resolve()
    dry_run = "--dry-run" in sys.argv

    if not site_root.exists():
        print("Cartella non trovata: " + str(site_root))
        sys.exit(1)

    print("Sito root : " + str(site_root))
    print("Modalita  : " + ("DRY-RUN" if dry_run else "SCRITTURA"))
    print()

    html_files = list(site_root.rglob("*.html"))
    print("File HTML : " + str(len(html_files)))
    print()

    stats = {"fixed": 0, "files": 0}
    for f in html_files:
        process_file(f, dry_run, stats)

    print()
    print("=" * 50)
    print("File modificati     : " + str(stats["files"]))
    print("Turbo-stream fixati : " + str(stats["fixed"]))
    if dry_run:
        print("\nDRY-RUN: nessun file modificato.")

if __name__ == "__main__":
    main()
