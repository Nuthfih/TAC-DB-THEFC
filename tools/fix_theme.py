#!/usr/bin/env python3
"""
fix_theme.py
------------
Inietta uno script inline che sostituisce il theme_controller di Stimulus
con codice vanilla JS. Funziona offline senza dipendenze CDN.

Uso:
    python fix_theme.py <cartella_sito> [--dry-run]

Esempio:
    python fix_theme.py "D:\alchemsitdb\way\ACDBfixed\www.alchemistcodedb.com" --dry-run
    python fix_theme.py "D:\alchemsitdb\way\ACDBfixed\www.alchemistcodedb.com"
"""

import re
import sys
from pathlib import Path

# Script da iniettare — sostituisce theme_controller.js
THEME_SCRIPT = """<script>
(function() {
  // Applica il tema salvato al caricamento
  function applyTheme(theme) {
    var resolved = theme === "auto"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;
    document.body.classList.remove("dark", "light");
    document.body.classList.add(resolved);
    document.body.setAttribute("data-bs-theme", resolved);
    localStorage.theme = theme;
    // Aggiorna i check nel dropdown
    document.querySelectorAll("[data-bs-theme-value]").forEach(function(el) {
      var check = el.querySelector(".fa-check");
      if (!check) return;
      if (el.getAttribute("data-bs-theme-value") === theme) {
        check.classList.remove("d-none");
      } else {
        check.classList.add("d-none");
      }
    });
  }

  // Gestisce il click sui bottoni light/dark/auto
  document.addEventListener("click", function(e) {
    var el = e.target.closest("[data-action*='theme#updateTheme']");
    if (!el) return;
    e.preventDefault();
    applyTheme(el.getAttribute("data-bs-theme-value"));
  });

  // Applica subito al caricamento
  var saved = localStorage.theme || "auto";
  applyTheme(saved);
})();
</script>"""

# Cerca il tag </body> per iniettare prima di esso
INJECT_BEFORE = "</body>"

# Marker per non iniettare due volte
MARKER = "theme#updateTheme"
ALREADY_FIXED = "applyTheme"

def process_file(path, dry_run, stats):
    try:
        content = path.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        print(f"  [ERROR] {path}: {e}")
        return

    # Salta file senza il theme switcher
    if MARKER not in content:
        return

    # Salta file già fixati
    if ALREADY_FIXED in content:
        stats["skipped"] += 1
        return

    if INJECT_BEFORE not in content:
        return

    new_content = content.replace(INJECT_BEFORE, THEME_SCRIPT + "\n" + INJECT_BEFORE, 1)
    stats["fixed"] += 1
    print(f"  ✔ {path.name}")

    if not dry_run:
        path.write_text(new_content, encoding="utf-8")


def main():
    if len(sys.argv) < 2:
        print("Uso: python fix_theme.py <cartella> [--dry-run]")
        sys.exit(1)

    folder = Path(sys.argv[1]).resolve()
    dry_run = "--dry-run" in sys.argv

    if not folder.exists():
        print(f"[ERROR] Cartella non trovata: {folder}")
        sys.exit(1)

    print(f"Cartella : {folder}")
    print(f"Modalità : {'DRY-RUN' if dry_run else 'SCRITTURA'}")
    print()

    html_files = list(folder.rglob("*.html"))
    print(f"File HTML: {len(html_files)}")
    print()

    stats = {"fixed": 0, "skipped": 0}

    for f in html_files:
        process_file(f, dry_run, stats)

    print()
    print("═" * 50)
    print(f"File aggiornati  : {stats['fixed']}")
    print(f"Già fixati (skip): {stats['skipped']}")
    if dry_run:
        print("\n⚠  DRY-RUN: nessun file modificato.")

if __name__ == "__main__":
    main()
