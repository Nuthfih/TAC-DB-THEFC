#!/usr/bin/env python3
"""
fix_missing_links.py
--------------------
Scansiona tutte le pagine HTML di un sito scaricato con HTTrack,
controlla se le risorse locali a cui puntano esistono davvero,
e riscrive i link mancanti verso Wayback Machine.

Uso:
    python fix_missing_links.py <cartella_sito> [--cache hts-cache/new.txt] [--dry-run]

Esempio:
    python fix_missing_links.py "D:/Archive/Websites/ACDB" --dry-run
    python fix_missing_links.py "D:/Archive/Websites/ACDB"
"""

import argparse
import os
import re
import sys
from pathlib import Path
from urllib.parse import urlparse, unquote

# ── Wayback Machine ────────────────────────────────────────────────────────────
# Usa il redirect "più recente disponibile" — Wayback sceglierà lo snapshot
# più vicino alla data richiesta. Il wildcard * funziona come redirect automatico.
WAYBACK = "https://web.archive.org/web/*/"

# ── Attributi HTML che contengono URL ─────────────────────────────────────────
# (attributo, tag opzionale per filtrare — None = qualsiasi tag)
URL_ATTRS = [
    ("href",   None),
    ("src",    None),
    ("action", None),
    ("data",   "object"),
    ("poster", "video"),
]

# Pattern per trovare gli attributi negli HTML (robusto anche su file non-valid)
ATTR_PATTERN = re.compile(
    r'''(?P<attr>href|src|action|data|poster)\s*=\s*(?P<q>["'])(?P<url>[^"'#?]+?)(?P=q)''',
    re.IGNORECASE,
)

# ── Helpers ────────────────────────────────────────────────────────────────────

def load_cache(cache_path: Path) -> dict[str, str]:
    """
    Legge hts-cache/new.txt e restituisce {url_originale: percorso_locale}.
    Il percorso locale è relativo alla radice del sito (es. www.example.com/page.html).
    """
    url_to_local: dict[str, str] = {}
    if not cache_path.exists():
        print(f"[WARN] Cache non trovata: {cache_path} — continuo senza mappa URL.")
        return url_to_local

    with open(cache_path, encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("date\t"):
                continue
            parts = line.split("\t")
            # Formato: time  size  flags  code  status  mime  etag  URL  localfile  (from)
            if len(parts) < 9:
                continue
            original_url = parts[7].strip()
            local_file   = parts[8].strip()
            if original_url and local_file:
                url_to_local[original_url] = local_file
    return url_to_local


def local_path_for_url(url: str, site_root: Path, url_to_local: dict[str, str]) -> Path | None:
    """
    Dato un URL (già risolto come assoluto oppure relativo al sito),
    restituisce il Path locale atteso, cercando prima nella cache HTTrack
    e poi costruendo il percorso per convenzione.
    """
    # 1) Cerca nella cache (percorso esatto registrato da HTTrack)
    if url in url_to_local:
        raw = url_to_local[url]
        # Il percorso nella cache usa backslash Windows; normalizza
        raw = raw.replace("\\", "/")
        # Estrae la parte dopo la cartella di output (es. "www.example.com/...")
        # Cerca il dominio nell'URL per trovare dove inizia il path locale
        parsed = urlparse(url)
        host = parsed.netloc
        if host and host in raw:
            idx = raw.find(host)
            relative = raw[idx:]
            return site_root / relative
        # Fallback: usa il path così com'è se è assoluto
        p = Path(raw)
        if p.is_absolute():
            return p
        return site_root / raw

    # 2) Convenzione HTTrack: host/percorso
    parsed = urlparse(url)
    if not parsed.netloc:
        return None
    local = site_root / parsed.netloc / unquote(parsed.path.lstrip("/"))
    # HTTrack aggiunge .html ai percorsi senza estensione
    if not local.suffix:
        local = local.with_suffix(".html")
    return local


def is_external(url: str) -> bool:
    """Ritorna True se l'URL è assoluto (http/https/ftp/...)."""
    return bool(urlparse(url).scheme)


def is_anchor_or_js(url: str) -> bool:
    """Salta ancore, javascript:, mailto: ecc."""
    return url.startswith(("#", "javascript:", "mailto:", "data:", "tel:"))


def wayback_url(original_url: str) -> str:
    return WAYBACK + original_url


# ── Logica principale ──────────────────────────────────────────────────────────

def process_html(
    html_path: Path,
    site_root: Path,
    url_to_local: dict[str, str],
    local_to_url: dict[str, str],
    dry_run: bool,
    stats: dict,
    site_domain: str = "",
):
    """Processa un singolo file HTML."""
    try:
        content = html_path.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        print(f"  [ERROR] Impossibile leggere {html_path}: {e}")
        return

    # Percorso relativo del file corrente rispetto alla root
    html_rel = html_path.relative_to(site_root)
    # Directory del file (per risolvere path relativi)
    html_dir = html_path.parent

    replacements: list[tuple[str, str, str]] = []  # (match_completo, url_vecchio, url_nuovo)

    for m in ATTR_PATTERN.finditer(content):
        url_val = m.group("url").strip()

        if not url_val or is_anchor_or_js(url_val):
            continue

        # Salta già-wayback
        if "web.archive.org" in url_val:
            continue

        # Determina l'URL originale assoluto per cercare nella cache
        if is_external(url_val):
            original_url = url_val
            local = local_path_for_url(original_url, site_root, url_to_local)
        else:
            # URL relativo → risolvi rispetto alla directory del file HTML
            resolved = (html_dir / unquote(url_val)).resolve()
            local = resolved
            # Cerca l'URL originale dalla mappa inversa
            rel_from_root = None
            try:
                rel_from_root = str(resolved.relative_to(site_root)).replace("\\", "/")
            except ValueError:
                pass
            original_url = local_to_url.get(rel_from_root) if rel_from_root else None
            if not original_url:
                # Non è nella cache — probabilmente un link interno che esiste
                # Verifica solo esistenza fisica
                if local.exists():
                    stats["ok"] += 1
                    continue
                # Non esiste e non abbiamo URL originale → skip (non possiamo fare wayback)
                stats["no_url"] += 1
                continue

        if local is None:
            stats["no_url"] += 1
            continue

        if local.exists():
            stats["ok"] += 1
            continue

        # File mancante — ma tocca solo risorse del dominio principale del sito,
        # non CDN esterni (jsdelivr, unpkg, googleapis, ecc.)
        parsed_orig = urlparse(original_url)
        if parsed_orig.netloc and parsed_orig.netloc != site_domain:
            stats["external_skip"] += 1
            continue
        new_url = wayback_url(original_url)
        full_match = m.group(0)
        new_match = full_match.replace(url_val, new_url)
        replacements.append((full_match, url_val, new_url))
        stats["fixed"] += 1
        print(f"  MANCANTE  {url_val}")
        print(f"  → WAYBACK {new_url}")

    if replacements and not dry_run:
        new_content = content
        for full_match, old_url, new_url in replacements:
            new_content = new_content.replace(full_match, full_match.replace(old_url, new_url), 1)
        html_path.write_text(new_content, encoding="utf-8")
        print(f"  ✔ Salvato {html_rel}")
    elif replacements and dry_run:
        print(f"  [DRY-RUN] {len(replacements)} sostituzione/i in {html_rel}")


def build_local_to_url(url_to_local: dict[str, str], site_root: Path) -> dict[str, str]:
    """Mappa inversa: percorso relativo dalla root → URL originale."""
    result: dict[str, str] = {}
    for url, raw_local in url_to_local.items():
        raw_local = raw_local.replace("\\", "/")
        parsed = urlparse(url)
        host = parsed.netloc
        if host and host in raw_local:
            idx = raw_local.find(host)
            relative = raw_local[idx:]
            result[relative] = url
        else:
            # Prova a ricavare il relativo dalla root
            p = Path(raw_local)
            try:
                rel = str(p.relative_to(site_root)).replace("\\", "/")
                result[rel] = url
            except (ValueError, TypeError):
                pass
    return result


def main():
    parser = argparse.ArgumentParser(description="Ripara link mancanti in un sito HTTrack.")
    parser.add_argument("site_root", help="Cartella radice del sito scaricato")
    parser.add_argument(
        "--cache",
        default=None,
        help="Percorso di hts-cache/new.txt (default: <site_root>/hts-cache/new.txt)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Mostra cosa verrebbe cambiato senza modificare i file",
    )
    parser.add_argument(
        "--ext",
        default=".html,.htm",
        help="Estensioni da scansionare, separate da virgola (default: .html,.htm)",
    )
    args = parser.parse_args()

    site_root = Path(args.site_root).resolve()
    if not site_root.exists():
        print(f"[ERROR] Cartella non trovata: {site_root}")
        sys.exit(1)

    cache_path = Path(args.cache) if args.cache else site_root / "hts-cache" / "new.txt"
    extensions = {e.strip().lower() for e in args.ext.split(",")}

    print(f"Sito root : {site_root}")
    print(f"Cache     : {cache_path}")
    print(f"Modalità  : {'DRY-RUN (nessuna modifica)' if args.dry_run else 'SCRITTURA'}")
    print()

    print("Carico cache HTTrack…")
    url_to_local = load_cache(cache_path)
    local_to_url = build_local_to_url(url_to_local, site_root)
    print(f"  {len(url_to_local)} risorse mappate dalla cache.")
    print()

    # Trova tutti gli HTML
    html_files = [
        p for p in site_root.rglob("*")
        if p.suffix.lower() in extensions and p.is_file()
    ]
    print(f"File HTML trovati: {len(html_files)}")
    print()

    stats = {"ok": 0, "fixed": 0, "no_url": 0, "external_skip": 0}

    # Ricava il dominio principale dal primo URL nella cache (es. www.alchemistcodedb.com)
    site_domain = ""
    for url in url_to_local:
        parsed = urlparse(url)
        if parsed.netloc:
            site_domain = parsed.netloc
            break
    print(f"Dominio principale: {site_domain}")
    print()

    for i, html_path in enumerate(html_files, 1):
        rel = html_path.relative_to(site_root)
        print(f"[{i}/{len(html_files)}] {rel}")
        process_html(html_path, site_root, url_to_local, local_to_url, args.dry_run, stats, site_domain)

    print()
    print("═" * 60)
    print(f"Risorse OK (file esiste)    : {stats['ok']}")
    print(f"Link riparati → Wayback     : {stats['fixed']}")
    print(f"Link saltati (URL ignoto)   : {stats['no_url']}")
    print(f"Link esterni ignorati       : {stats['external_skip']}")
    if args.dry_run:
        print()
        print("⚠  Modalità DRY-RUN: nessun file è stato modificato.")
        print("   Riesegui senza --dry-run per applicare le modifiche.")


if __name__ == "__main__":
    main()
