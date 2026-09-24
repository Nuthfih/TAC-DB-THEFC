#!/usr/bin/env python3
"""
fix_planner_controller.py
-------------------------
Patcha il planner_controller.js per gestire elementi DOM mancanti
(job-buttons, job-change ecc.) senza crashare.

Uso:
    py fix_planner_controller.py <site_root>
"""

import sys
from pathlib import Path

CONTROLLER_FILENAME = "planner_controller-13884b106a9c48e9ac994ae652e4029ecda78e3c0c83d247de7431e2285812af.js"

def main():
    if len(sys.argv) < 2:
        print("Uso: py fix_planner_controller.py <site_root>")
        sys.exit(1)

    site_root = Path(sys.argv[1]).resolve()
    controller = site_root / "cdn.alchemistcodedb.com" / "assets" / "controllers" / CONTROLLER_FILENAME

    if not controller.exists():
        print(f"[ERROR] Controller non trovato: {controller}")
        sys.exit(1)

    content = controller.read_text(encoding="utf-8", errors="replace")

    # Fix 1: selectedJobChange[a] può essere undefined se ci sono meno di 3 .job-buttons
    old1 = 'var job = selectedJobChange[a].querySelector(".job-change");'
    new1 = 'var job = selectedJobChange[a] ? selectedJobChange[a].querySelector(".job-change") : null;'

    # Fix 2: buildShareLink crash su altri elementi mancanti — wrappa in try/catch
    old2 = '  buildShareLink();\n}'
    new2 = '  try { buildShareLink(); } catch(e) { console.warn("buildShareLink:", e.message); }\n}'

    changes = 0
    if old1 in content:
        content = content.replace(old1, new1)
        changes += 1
        print("  ✔ Fix selectedJobChange null check")
    if old2 in content:
        content = content.replace(old2, new2)
        changes += 1
        print("  ✔ Fix buildShareLink try/catch")

    if changes > 0:
        controller.write_text(content, encoding="utf-8")
        print(f"\nController aggiornato: {controller.name}")
    else:
        print("Nessuna modifica necessaria (già patchato?)")

if __name__ == "__main__":
    main()
