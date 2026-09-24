# AlchemistCodeDB — Offline Tools

Local mirror of alchemistcodedb.com with an enhanced unit planner.

## Requirements

- **Python 3.8+** — standard library only, no pip installs needed
- The site folder structure produced by HTTrack (e.g. `ACDBfixed/`)

---

## Quick Start

Place all files in a `tools/` folder inside `ACDBfixed/`, then double-click `avvia_server.bat`.  
The site opens at `http://localhost:8080/www.alchemistcodedb.com/index.html`.

---

## Files

### Daily Use

| File | Description |
|------|-------------|
| `avvia_server.bat` | Double-click to start the local server. No setup required. |
| `server.py` | HTTP server on port 8080. Serves the HTTrack mirror, handles JSON APIs (`/get-unit`, `/get-gear-stats`, `/get-card-stats`, `/get-skill-stats`, `/get-rune-data`) and injects `planner_enhance.js` into all planner pages. |
| `planner_enhance.js` | Script injected into every planner page. Adds gate controls, total stat calculator, gear/memento selectors with icons and stats, passive equip system, truth seal (rune) builder with set bonuses, enlightened bond, spirit gear, and a level selector up to the unit's actual max level. |

### Build Scripts — run after downloading new unit/gear/card pages

| File | Description |
|------|-------------|
| `build_unit_api.py` | Reads every unit HTML page and generates `api/unit_SLUG.json`. Extracts base stats, gates, passives with numeric buff values, job equipment/modifier/master bonus, advanced jobs, spirit gear levels, enlightened bond, and recommended gear/memento with numeric stats. |
| `build_gear_api.py` | Reads gear and card HTML pages and generates `api/gear/SLUG.json` and `api/card/SLUG.json` with max numerical stats. |
| `build_skill_api.py` | Reads passive skill pages and generates `api/skill/SLUG.json`. Used as a fallback for passives whose buff values are not present in the unit HTML. |
| `build_rune_api.py` | Reads `rune.zip` and generates `api/runes.json` with rune stats per rarity and stat variant, set effects, and the slot-to-sin mapping. Requires `--rune-zip <path>` argument. |

**Typical usage:**
```
py build_unit_api.py "D:\path\to\ACDBfixed"
py build_unit_api.py "D:\path\to\ACDBfixed" --locale jp
py build_gear_api.py "D:\path\to\ACDBfixed"
py build_skill_api.py "D:\path\to\ACDBfixed"
py build_rune_api.py "D:\path\to\ACDBfixed" --rune-zip "C:\Users\...\rune.zip"
```

### Fix Scripts — re-run if the site stops working correctly

| File | Description |
|------|-------------|
| `fix_bootstrap_order.py` | Moves `bootstrap.bundle.min.js` before the importmap in `<head>` so Bootstrap loads correctly. |
| `fix_bootstrap_popper.py` | Creates an ESM wrapper for Bootstrap that re-exports from `window.bootstrap`. |
| `fix_bootstrap_esm.py` | Restores the `"bootstrap": ".../+esm"` entry in the importmap. |
| `fix_importmap_bootstrap.py` | Combines the above: ensures Bootstrap is correctly referenced in the importmap. |
| `fix_importmap.py` | Converts absolute CDN URLs to relative local paths inside importmaps. |
| `fix_navbar_dropdowns.py` | Adds `data-turbo="false"` to navbar dropdown links to prevent Turbo from intercepting them. |
| `fix_planner_controller.py` | Patches `planner_controller.js` to add null checks and fix the `buildShareLink` function. |
| `fix_missing_links.py` | Fixes broken internal links identified in the HTTrack mirror. |
| `fix_theme.py` | Injects the light/dark theme toggle script into all pages. |
| `fix_turbo_actions.py` | Restores Turbo Stream `action="..."` attributes removed during mirroring. |

### Utility Scripts — occasional use

| File | Description |
|------|-------------|
| `generate_static_planner.py` | Generates static pre-built planner files (`plannerXXXX-1.html`) for units that don't load dynamically. |
| `add_planner_buttons.py` | Adds a "Static Planner" button to unit pages that have a static planner available. |
| `fix_planner.py` | Rebuilds the slug→planner file mapping from the HTTrack cache. Uses `mappings.json`. |
| `download_from_wayback.py` | Downloads missing assets (gear pages, card pages, skill pages) from the Wayback Machine. |
| `download_bootstrap.py` | Downloads Bootstrap and other CDN libraries to serve them locally. |
| `check_missing_assets.py` | Scans CSS files to find referenced assets that are missing locally. |
| `extract_external_urls.py` | Extracts all external URLs from a CSS file (useful before running `download_from_wayback.py`). |
| `find_class_mappings.py` | Finds CSS class name differences between the old and current version of the site. |
| `ripristina_span.py` | Restores `<span>` tags that were converted to other elements in a previous fix pass. |
| `mappings.json` | Slug-to-planner-file map used by `fix_planner.py`. |
