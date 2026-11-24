#!/usr/bin/env python3
"""
Lightweight Static HTTP Server for Service Incident Dashboard
Serves on http://localhost:3000
"""
import http.server
import socketserver
import os
import sys
import webbrowser

PORT = 3000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def end_headers(self):
        # Enable CORS and disable aggressive caching for local development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

def run():
    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            print(f"IncidentIQ running at http://localhost:{PORT}")
            print(f"Serving directory: {DIRECTORY}")
            print("Press Ctrl+C to stop.")
            if "--open" in sys.argv:
                webbrowser.open(f"http://localhost:{PORT}")
            httpd.serve_forever()
    except OSError as e:
        print(f"Port {PORT} in use or error: {e}")
        # Try alternate port 3001
        with socketserver.TCPServer(("", 3001), Handler) as httpd:
            print(f"Service Incident Review Dashboard running at http://localhost:3001")
            httpd.serve_forever()

if __name__ == "__main__":
    run()
