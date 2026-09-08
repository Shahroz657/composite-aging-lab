#!/usr/bin/env python3
"""Static dev server with caching disabled (so edits show up on reload).

Also accepts POST /__save?name=<file> (localhost only) so the page can hand back a rendered
screenshot for the README; the file is written under screenshots/.
"""
import http.server, os, sys, re, urllib.parse
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()
    def log_message(self, *a): pass
    def do_POST(self):
        u = urllib.parse.urlparse(self.path)
        name = urllib.parse.parse_qs(u.query).get('name', [''])[0]
        if u.path != '/__save' or not re.fullmatch(r'[a-z0-9-]+\.(png|jpg)', name):
            self.send_response(404); self.end_headers(); return
        n = int(self.headers.get('Content-Length', 0)); data = self.rfile.read(n)
        d = os.path.join(ROOT, 'screenshots'); os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, name), 'wb') as f: f.write(data)
        self.send_response(200); self.end_headers(); self.wfile.write(b'saved')
http.server.ThreadingHTTPServer.allow_reuse_address = True
http.server.ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
