# Local HTML WYSIWYG Editor

A small local-only WYSIWYG editor for simple `.html` and `.htm` files.

As AI harnesses and local agents increasingly generate standalone HTML artifacts, I wanted a fast way to update and refine those files directly instead of sending every small visual or wording change back through the agent loop. This editor is for that workflow: open the generated HTML, make the quick human edits, clean it, and save it locally.

It is built for people who keep HTML companion files next to notes or documents and want a lightweight edit/clean/save workflow without a hosted editor, CDN, account, or external service.

## Features

- Local browser editor served from `127.0.0.1`
- WYSIWYG editing via an iframe with browser `designMode`
- Source view with explicit apply step
- Direct local file open/save in Chromium-family browsers through the File System Access API
- Manual file input and download fallback for browsers without direct file access
- Optional vault/root-scoped server API for opening and saving files by relative path
- Basic cleanup tools:
  - remove comments
  - remove `script`, `object`, and `embed`
  - strip inline `style`, `class`, and `id`
  - unwrap `span`
  - convert `b/i` to `strong/em`
- Optional Obsidian helper plugin for right-click opening from the file explorer

## Quick start

```bash
git clone https://github.com/busera/local-html-wysiwyg-editor.git
cd local-html-wysiwyg-editor
./start.sh
```

Open:

```text
http://127.0.0.1:8787/
```

For direct open/save to arbitrary local files, use Chrome, Edge, Brave, or Arc.

## Root-scoped API mode

The server can load and save `.html` / `.htm` files below a configured root directory:

```bash
python3 server.py --host 127.0.0.1 --port 8787 --vault /path/to/your/vault-or-folder
```

Then open a file by relative path:

```text
http://127.0.0.1:8787/?path=relative/path/to/file.html
```

The server rejects:
- non-HTML suffixes
- paths outside the configured root
- non-local bind hosts
- save requests from unexpected browser origins

## Obsidian integration

This repository includes a small Obsidian helper plugin in:

```text
obsidian-plugin/open-html-in-local-editor/
```

It adds:
- a file-explorer right-click action for `.html` / `.htm` files
- a command-palette action for the active HTML file
- settings for browser choice, host, port, editor directory, root/vault path, and auto-start

Install manually:

1. Copy `obsidian-plugin/open-html-in-local-editor/` into your vault's `.obsidian/plugins/` folder.
2. Enable `Open HTML in Local Editor` in Obsidian Community Plugins.
3. Open the plugin settings and set `Editor directory` to this repository folder.
4. Optional: choose Safari, Google Chrome, or the system default browser.
5. Right-click an `.html` or `.htm` file and choose `Open in Local HTML WYSIWYG Editor`.

If auto-start is enabled, the plugin checks `/api/health`, starts the local server if needed, waits for readiness, then opens the editor URL.

Auto-start is restricted to `127.0.0.1` / `localhost` for safety. If you configure another host or IP, start that server yourself.

## Browser notes

### Chrome / Arc / Brave / Edge

Best workflow. These browsers support the File System Access API for direct open/save even without the Obsidian plugin.

### Safari / Firefox

These browsers do not support direct write-back to arbitrary local files from a normal browser page. Use one of these workflows:

- Obsidian helper plugin + local server API: `Save` writes back through the local server.
- Manual mode: choose a file, edit, then download a copy and replace the original manually.

## Files

```text
index.html      app shell
app.js          editor logic
styles.css      UI styling
server.py       localhost server and root-scoped file API
start.sh        convenience launcher
obsidian-plugin/open-html-in-local-editor/  optional Obsidian launcher plugin
```

## Verification

```bash
python3 -m py_compile server.py
node --check app.js
node --check obsidian-plugin/open-html-in-local-editor/main.js
python3 server.py --host 127.0.0.1 --port 8787 --vault .
```

Then open `http://127.0.0.1:8787/` and verify the editor loads.

## Security model

This is a local-first utility, not a web service.

- No external CDN
- No analytics
- No cloud API
- No external network dependency
- Default bind is loopback only
- Root-scoped API validates paths before reading or writing
- Obsidian plugin launches browsers with argument arrays, not shell strings

Do not expose this server to untrusted networks.

## AI assistance

This project was built with AI assistance and manually reviewed/tested before publication.

## License

MIT
