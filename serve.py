#!/usr/bin/env python3
"""
Local server for the Saransh Singh portfolio.

Why this exists: the site is a Next.js app. Some content (the /work grid) is
rendered in the browser, and every <img> points at Next's image optimizer
(/_next/image?url=/images/...&w=...&q=...), which does not exist in a static
download. This server resolves those requests to the original image file so
the clone looks identical without a Node build.

    python3 serve.py [port]        # default 8000
"""
import http.server
import os
import posixpath
import sys
import urllib.parse

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *args):
        pass

    def translate_path(self, path):
        parsed = urllib.parse.urlparse(path)

        # Next.js image optimizer -> serve the underlying original file
        if parsed.path.rstrip("/") == "/_next/image":
            qs = urllib.parse.parse_qs(parsed.query)
            src = qs.get("url", [""])[0].lstrip("/")
            if src:
                return os.path.join(ROOT, urllib.parse.unquote(src))

        # /work  ->  /work/index.html
        p = super().translate_path(path)
        if os.path.isdir(p):
            index = os.path.join(p, "index.html")
            if os.path.isfile(index):
                return index
        return p

    def do_GET(self):
        # Vercel analytics beacons are not part of the clone
        if urllib.parse.urlparse(self.path).path.startswith("/_vercel/"):
            body = b"/* analytics disabled in local clone */"
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def send_head(self):
        path = self.translate_path(self.path)
        if not os.path.exists(path) and not urllib.parse.urlparse(self.path).path.startswith("/_vercel/"):
            notfound = os.path.join(ROOT, "404.html")
            if os.path.isfile(notfound):
                self.path = "/404.html"
                self._notfound = True
        return super().send_head()

    def send_response(self, code, message=None):
        if getattr(self, "_notfound", False) and code == 200:
            code = 404
        super().send_response(code, message)


if __name__ == "__main__":
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler) as httpd:
        print(f"portfolio -> http://127.0.0.1:{PORT}/")
        httpd.serve_forever()
