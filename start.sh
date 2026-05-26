#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
PORT="${1:-8787}"
VAULT="${LOCAL_HTML_EDITOR_ROOT:-$PWD}"
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $PORT is already in use. Stop the existing server or pass another port, for example: ./start.sh 8788" >&2
  exit 1
fi
python3 server.py --host 127.0.0.1 --port "$PORT" --vault "$VAULT"
