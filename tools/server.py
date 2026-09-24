import http.server
import json
import mimetypes
import os
import re
import sys
import webbrowser
from pathlib import Path
from urllib.parse import urlparse, parse_qs

mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("application/javascript", ".mjs")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("image/png", ".png")
mimetypes.add_type("image/jpeg", ".jpg")
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("font/woff", ".woff")

SITE_ROOT = None

class FixedMimeHandler(http.server.SimpleHTTPRequestHandler):

    def do_GET(self):
        # API: /get-gear-stats?slug=X e /get-card-stats?slug=X
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        if parsed.path in ("/get-gear-stats", "/get-card-stats"):
            slug   = qs.get("slug", [""])[0]
            locale = qs.get("locale", ["en"])[0]
            kind   = "gear" if parsed.path == "/get-gear-stats" else "card"
            if locale == "jp":
                api_file = SITE_ROOT / "www.alchemistcodedb.com" / "jp" / "api" / kind / f"{slug}.json"
            else:
                api_file = SITE_ROOT / "www.alchemistcodedb.com" / "api" / kind / f"{slug}.json"
            if api_file.exists():
                self.send_json(json.loads(api_file.read_text(encoding="utf-8")))
            else:
                self.send_json({"error": "not found"}, 404)
            return

        # Serve planner_enhance.js
        if self.path == "/planner_enhance.js":
            import os
            js_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "planner_enhance.js")
            if os.path.exists(js_path):
                data = open(js_path, "rb").read()
                self.send_response(200)
                self.send_header("Content-Type", "application/javascript")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return

        # Fix doppio slash (imgPath termina con / e il codice aggiunge /images/)
        if "//" in self.path:
            self.path = self.path.replace("//", "/")

        # Reindirizza JobIconM → JobIcon (le icone grandi non esistono in locale)
        if "/images/JobIconM/" in self.path:
            new_path = self.path.replace("/images/JobIconM/", "/images/JobIcon/")
            self.send_response(302)
            self.send_header("Location", new_path)
            self.end_headers()
            return

        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)

        # ── API: /get-unit?slug=X&locale=Y ──────────────────────────────────
        if parsed.path == "/get-unit":
            slug   = qs.get("slug",   [""])[0]
            locale = qs.get("locale", ["en"])[0]
            self.serve_unit_api(slug, locale)
            return

        # API: /get-gear-stats?slug=X e /get-card-stats?slug=X
        if parsed.path in ("/get-gear-stats", "/get-card-stats"):
            slug   = qs.get("slug", [""])[0]
            locale = qs.get("locale", ["en"])[0]
            kind   = "gear" if parsed.path == "/get-gear-stats" else "card"
            if locale == "jp":
                api_file = SITE_ROOT / "www.alchemistcodedb.com" / "jp" / "api" / kind / f"{slug}.json"
            else:
                api_file = SITE_ROOT / "www.alchemistcodedb.com" / "api" / kind / f"{slug}.json"
            if api_file.exists():
                self.send_json(json.loads(api_file.read_text(encoding="utf-8")))
            else:
                self.send_json({"error": "not found"}, 404)
            return

        # API: /get-rune-data
        if parsed.path == "/get-rune-data":
            locale = qs.get("locale", ["en"])[0]
            if locale == "jp":
                api_file = SITE_ROOT / "www.alchemistcodedb.com" / "jp" / "api" / "runes.json"
            else:
                api_file = SITE_ROOT / "www.alchemistcodedb.com" / "api" / "runes.json"
            if api_file.exists():
                self.send_json(json.loads(api_file.read_text(encoding="utf-8")))
            else:
                self.send_json({"error": "runes.json not found"}, 404)
            return

        # API: /get-skill-stats?slug=X
        if parsed.path == "/get-skill-stats":
            slug   = qs.get("slug", [""])[0]
            locale = qs.get("locale", ["en"])[0]
            if locale == "jp":
                api_file = SITE_ROOT / "www.alchemistcodedb.com" / "jp" / "api" / "skill" / f"{slug}.json"
            else:
                api_file = SITE_ROOT / "www.alchemistcodedb.com" / "api" / "skill" / f"{slug}.json"
            if api_file.exists():
                self.send_json(json.loads(api_file.read_text(encoding="utf-8")))
            else:
                self.send_json({"error": "not found"}, 404)
            return

        # ── API stub: /get-gears /get-cards /get-runes /get-expeditions /get-crystals
        # Risponde con lista vuota — il planner funziona senza gear/cards/runes
        for stub in ["/get-gears", "/get-cards", "/get-runes",
                     "/get-expeditions", "/get-crystals"]:
            if parsed.path == stub:
                self.send_json({"data": [], "version": 1})
                return

        super().do_GET()

    def serve_unit_api(self, slug, locale):
        if not slug:
            self.send_json({"error": "missing slug"}, 400)
            return

        if locale == "jp":
            api_file = SITE_ROOT / "www.alchemistcodedb.com" / "jp" / "api" / f"unit_{slug}.json"
        else:
            api_file = SITE_ROOT / "www.alchemistcodedb.com" / "api" / f"unit_{slug}.json"

        if not api_file.exists():
            self.send_json({"error": f"unit not found: {slug}"}, 404)
            return

        data = json.loads(api_file.read_text(encoding="utf-8"))
        self.send_json(data)

    def send_json(self, data, code=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def inject_enhancement(self, html_content):
        SCRIPT = b'<script src="/planner_enhance.js"></script>'


        return html_content.replace(b'<body', SCRIPT + b'\n<body', 1)

    def send_head(self):
        path = self.translate_path(self.path)
        p = str(path)
        if p.endswith("+esm") or (os.path.isfile(p) and "." not in os.path.basename(p)):
            try:
                f = open(p, "rb")
            except OSError:
                self.send_error(404, "File not found")
                return None
            fs = os.fstat(f.fileno())
            self.send_response(200)
            self.send_header("Content-type", "application/javascript")
            self.send_header("Content-Length", str(fs[6]))
            self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
            self.end_headers()
            return f
        # Inietta enhancement script nei file planner
        path_str = str(path).replace("\\", "/")
        if "planner" in path_str and path_str.endswith(".html"):
            try:
                html = open(path, 'rb').read()
                html = self.inject_enhancement(html)
                self.send_response(200)
                self.send_header("Content-type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(html)))
                self.end_headers()
                import io
                return io.BytesIO(html)
            except Exception:
                pass
        return super().send_head()

    def log_message(self, fmt, *args):
        try:
            if len(args) >= 2 and str(args[1]) == "404":
                print("  [404] " + str(self.path))
        except Exception:
            pass


def main():
    global SITE_ROOT
    site_root = sys.argv[1] if len(sys.argv) > 1 else "."
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8080

    SITE_ROOT = Path(site_root).resolve()
    if not SITE_ROOT.exists():
        print("Cartella non trovata: " + str(SITE_ROOT))
        sys.exit(1)

    os.chdir(SITE_ROOT)

    url = "http://localhost:" + str(port) + "/www.alchemistcodedb.com/index.html"
    print("Serving : " + str(SITE_ROOT))
    print("URL     : " + url)
    print("API     : /get-unit?slug=X&locale=en")
    print("Premi CTRL+C per fermare\n")

    webbrowser.open(url)

    with http.server.HTTPServer(("", port), FixedMimeHandler) as httpd:
        httpd.serve_forever()


if __name__ == "__main__":
    main()
