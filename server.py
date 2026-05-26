#!/usr/bin/env python3
"""Local-only HTML editor server with a vault-scoped load/save API."""

from __future__ import annotations

import argparse
import json
import mimetypes
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

EDITOR_ROOT = Path(__file__).resolve().parent
DEFAULT_VAULT_ROOT = Path.cwd().resolve()
HTML_SUFFIXES = {".html", ".htm"}
MAX_SAVE_BYTES = 20_000_000


class EditorRequestHandler(SimpleHTTPRequestHandler):
    """Serve static editor files and a vault-scoped JSON API."""

    server_version = "LocalHtmlEditor/0.3"

    def __init__(self, *args, directory: str | None = None, **kwargs) -> None:
        super().__init__(*args, directory=str(EDITOR_ROOT), **kwargs)

    @property
    def vault_root(self) -> Path:
        return self.server.vault_root  # type: ignore[attr-defined]

    def log_message(self, format: str, *args: object) -> None:
        # Keep routine request logs quiet; API errors are returned to the browser.
        return

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def do_GET(self) -> None:  # noqa: N802 - http.server API
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self.write_json(HTTPStatus.OK, {"ok": True, "service": "local-html-editor"})
            return
        if parsed.path == "/api/file":
            self.handle_get_file(parsed.query)
            return
        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802 - http.server API
        parsed = urlparse(self.path)
        if parsed.path == "/api/file":
            self.handle_save_file()
            return
        self.send_error(HTTPStatus.NOT_FOUND, "Unknown endpoint")

    def resolve_vault_html_path(self, raw_path: str) -> Path:
        if not raw_path:
            raise ValueError("Missing path")
        decoded = unquote(raw_path)
        candidate = (self.vault_root / decoded).resolve()
        if self.vault_root not in candidate.parents and candidate != self.vault_root:
            raise ValueError("Path is outside the configured vault/root")
        if candidate.suffix.lower() not in HTML_SUFFIXES:
            raise ValueError("Only .html and .htm files are allowed")
        return candidate

    def write_json(self, status: HTTPStatus, payload: dict[str, object]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_get_file(self, query: str) -> None:
        params = parse_qs(query)
        raw_path = params.get("path", [""])[0]
        try:
            file_path = self.resolve_vault_html_path(raw_path)
            if not file_path.exists() or not file_path.is_file():
                raise FileNotFoundError("File does not exist")
            html = file_path.read_text(encoding="utf-8")
        except (OSError, UnicodeError, ValueError) as exc:
            self.write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(exc)})
            return
        self.write_json(
            HTTPStatus.OK,
            {
                "ok": True,
                "path": str(file_path.relative_to(self.vault_root)),
                "name": file_path.name,
                "html": html,
            },
        )

    def handle_save_file(self) -> None:
        origin = self.headers.get("Origin")
        host = self.headers.get("Host", "")
        allowed_origins = {f"http://{host}"} if host else set()
        if origin and origin not in allowed_origins:
            self.write_json(HTTPStatus.FORBIDDEN, {"ok": False, "error": "Origin rejected"})
            return
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > MAX_SAVE_BYTES:
                raise ValueError("Invalid content length")
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            file_path = self.resolve_vault_html_path(str(payload.get("path", "")))
            html = str(payload.get("html", ""))
            if not file_path.exists() or not file_path.is_file():
                raise FileNotFoundError("File does not exist")
            file_path.write_text(html, encoding="utf-8")
        except (json.JSONDecodeError, OSError, UnicodeError, ValueError) as exc:
            self.write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(exc)})
            return
        self.write_json(
            HTTPStatus.OK,
            {"ok": True, "path": str(file_path.relative_to(self.vault_root)), "name": file_path.name},
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the local HTML WYSIWYG editor server.")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host; loopback only by default.")
    parser.add_argument("--port", type=int, default=8787, help="Bind port.")
    parser.add_argument(
        "--vault",
        type=Path,
        default=DEFAULT_VAULT_ROOT,
        help="Root directory allowed for API load/save operations.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.host not in {"127.0.0.1", "localhost"}:
        raise SystemExit("Refusing non-local bind host")
    vault_root = args.vault.expanduser().resolve()
    if not vault_root.exists() or not vault_root.is_dir():
        raise SystemExit(f"Vault/root directory does not exist: {vault_root}")
    mimetypes.add_type("text/javascript", ".js")
    server = ThreadingHTTPServer((args.host, args.port), EditorRequestHandler)
    server.vault_root = vault_root  # type: ignore[attr-defined]
    print(f"Local HTML WYSIWYG Editor: http://{args.host}:{args.port}/")
    print(f"Allowed file root: {vault_root}")
    server.serve_forever()


if __name__ == "__main__":
    main()
