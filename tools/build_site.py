#!/usr/bin/env python3
"""Build the GitHub Pages site in docs/ from web/index.html.

web/index.html is written for a Claude artifact (no <html>/<head>, Google Fonts,
inline script). This turns it into a standalone page: fonts served from docs/fonts,
the script moved to docs/app.js so a strict Content-Security-Policy can forbid
inline and outside scripts, plus home-screen icons and offline caching.

Run from the repository root:  python3 tools/build_site.py
"""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "web" / "index.html"
DOCS = ROOT / "docs"

CSP = "; ".join([
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
])

HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="{csp}">
<meta name="referrer" content="no-referrer">
<meta name="description" content="Count rows, stitches and pattern repeats for your knitting projects.">
<meta name="theme-color" content="#eef1ef" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#101614" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Knitting">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="stylesheet" href="fonts/fonts.css">
<style>
  :root {{ color-scheme: light; padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }}
  body {{ margin: 0; font: 14px system-ui, sans-serif; }}
  img {{ max-width: 100%; }}
  [hidden] {{ display: none !important; }}
</style>
"""


def main() -> None:
    html = SOURCE.read_text(encoding="utf-8")

    # Google Fonts and Claude-only tags are replaced by the head above.
    html = re.sub(r'<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>\n?', "", html)
    html = re.sub(r'<meta name="claude:[^>]*>\n?', "", html)

    title = re.search(r"<title>.*?</title>\n?", html, re.S)
    style = re.search(r"<style>.*?</style>\n?", html, re.S)
    script = re.search(r"<script>(.*)</script>\s*$", html, re.S)
    if not (title and style and script):
        raise SystemExit("web/index.html is missing its <title>, <style> or <script>")

    body = html[style.end():script.start()].strip()
    js = script.group(1).strip() + "\n"

    page = (
        HEAD.format(csp=CSP)
        + title.group(0).strip() + "\n"
        + style.group(0).strip() + "\n"
        + "</head>\n<body>\n"
        + body + "\n"
        + '<script src="app.js"></script>\n'
        + '<script src="sw-register.js"></script>\n'
        + "</body>\n</html>\n"
    )

    (DOCS / "index.html").write_text(page, encoding="utf-8")
    (DOCS / "app.js").write_text(js, encoding="utf-8")

    files = ["./", "index.html", "app.js", "sw-register.js", "manifest.webmanifest", "fonts/fonts.css"]
    files += sorted("fonts/" + p.name for p in (DOCS / "fonts").glob("*.woff2"))
    files += sorted("icons/" + p.name for p in (DOCS / "icons").iterdir() if p.suffix in {".png", ".svg"})

    digest = hashlib.sha256()
    for name in files[1:]:
        digest.update((DOCS / name).read_bytes())
    sw = (ROOT / "tools" / "sw.template.js").read_text(encoding="utf-8")
    sw = sw.replace("__VERSION__", digest.hexdigest()[:12]).replace("__FILES__", json.dumps(files, indent=2))
    (DOCS / "sw.js").write_text(sw, encoding="utf-8")

    print(f"Built docs/ ({len(files)} cached files)")


if __name__ == "__main__":
    main()
