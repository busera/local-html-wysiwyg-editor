#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -m py_compile server.py
node --check app.js
node --check obsidian-plugin/open-html-in-local-editor/main.js
python3 - <<'PY'
import json
from pathlib import Path
json.loads(Path('obsidian-plugin/open-html-in-local-editor/manifest.json').read_text())
print('verification passed')
PY
