# Open HTML in Local Editor

Obsidian helper plugin for Local HTML WYSIWYG Editor. This is the main integration point: select an HTML companion file inside Obsidian and open it in the local browser editor for visual edits and save-back.

It adds:
- file-explorer right-click action for `.html` / `.htm` files: `Open in Local HTML WYSIWYG Editor`
- command-palette action for the active HTML file
- command-palette action to start/check the local editor server
- settings for browser, host, port, auto-start, editor directory, and vault path override


## Why this plugin exists

Obsidian is excellent at organizing notes and companion files, but editing raw HTML inside the vault is awkward. This plugin keeps file selection inside Obsidian and moves the actual WYSIWYG editing to the local browser editor. The local server then saves back to the same vault-relative file path.

This gives you:
- vault-native file discovery and right-click workflow
- browser-grade WYSIWYG editing instead of fragile embedded HTML editing
- local-only save-back through `127.0.0.1`
- no external service, CDN, analytics, or account

The action opens a URL like:

```text
http://127.0.0.1:8787/?path=<vault-relative-path>
```

## Install

1. Copy this `open-html-in-local-editor/` folder into your vault's `.obsidian/plugins/` directory.
2. Restart Obsidian or reload community plugins.
3. Enable `Open HTML in Local Editor`.
4. Set `Editor directory` to the cloned `local-html-wysiwyg-editor` repository folder.
5. Right-click an `.html` / `.htm` file and choose `Open in Local HTML WYSIWYG Editor`.

## Settings

Open Obsidian Settings -> Community plugins -> Open HTML in Local Editor.

Defaults:
- Browser: system default
- Host: `127.0.0.1`
- Port: `8787`
- Auto-start server: enabled
- Editor directory: blank until configured
- Vault path override: blank, meaning current Obsidian vault path when available

Browser choices:
- System default
- Safari
- Google Chrome

Auto-start is restricted to `127.0.0.1` / `localhost` for safety. If you configure another host/IP, start that server yourself.

Safety:
- local URL by default
- no external network
- only passes the vault-relative file path
- the editor server validates that the path stays inside the configured root and is `.html` / `.htm`
- browser opening uses `/usr/bin/open -a <browser>` on macOS, without shell interpolation
