#!/usr/bin/env python3
"""
extract_external_urls.py
------------------------
Estrae tutti gli URL esterni (non locali) da un file CSS.

Uso:
    python extract_external_urls.py <file.css>

Esempio:
    python extract_external_urls.py "D:\alchemsitdb\way\ACDBfixed\cdn.alchemistcodedb.com\assets\application-a2b3.css"
"""

import re
import sys
from pathlib import Path

URL_PATTERN = re.compile(r'url\(["\']?(https?://[^\s"\')\]>]+)["\']?\)', re.IGNORECASE)

def main():
    if len(sys.argv) < 2:
        print("Uso: python extract_external_urls.py <file.css>")
        sys.exit(1)

    css_file = Path(sys.argv[1])
    if not css_file.exists():
        print(f"[ERROR] File non trovato: {css_file}")
        sys.exit(1)

    content = css_file.read_text(encoding="utf-8", errors="replace")
    urls = sorted(set(m.group(1) for m in URL_PATTERN.finditer(content)))

    print(f"URL esterni trovati: {len(urls)}\n")
    for url in urls:
        print(url)

    out_file = Path("external_urls.txt")
    out_file.write_text("\n".join(urls), encoding="utf-8")
    print(f"\nSalvati in: {out_file.resolve()}")

if __name__ == "__main__":
    main()
