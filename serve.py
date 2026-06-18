#!/usr/bin/env python3
"""Dev server for StressTest My Plan with no-cache headers (so edits always reload)."""
import sys, os, http.server, socketserver

os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4180

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', PORT), Handler) as httpd:
    print(f'StressTest My Plan dev server on http://localhost:{PORT}')
    httpd.serve_forever()
