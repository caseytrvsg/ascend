#!/usr/bin/env python3
"""ASCEND dev server.

Serves the prototype (like `python3 -m http.server`) and additionally handles
POST /api/exercise-request — each user-submitted custom exercise is appended to
exercise-requests.md so Casey can review and decide what to add officially.

Run:  python3 serve.py          (port 5188, all interfaces — phone can connect over LAN)
"""
import http.server, json, datetime, pathlib

ROOT = pathlib.Path(__file__).parent
DOC = ROOT / "exercise-requests.md"
PORT = 5188


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        if self.path == "/api/exercise-request":
            length = int(self.headers.get("Content-Length", 0) or 0)
            try:
                data = json.loads(self.rfile.read(length) or b"{}")
            except Exception:
                data = {}
            entry = (
                f"\n## {data.get('name', '(unnamed)')}\n"
                f"- Muscle group: {data.get('group', '?')}\n"
                f"- Equipment: {data.get('equipment') or '-'}\n"
                f"- Suggested by: {data.get('by', '?')}\n"
                f"- Submitted: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}\n"
                f"- Status: PENDING REVIEW\n"
            )
            with open(DOC, "a", encoding="utf-8") as f:
                f.write(entry)
            self.send_response(204)
            self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, *args):
        pass  # keep the console quiet


if __name__ == "__main__":
    print(f"ASCEND running on http://localhost:{PORT}  (LAN: http://<your-mac-ip>:{PORT})")
    http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
