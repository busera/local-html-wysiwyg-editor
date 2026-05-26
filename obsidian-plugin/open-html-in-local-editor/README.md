# Open HTML in Local Editor

Optional Obsidian helper plugin for Local HTML WYSIWYG Editor.

It adds:
- file-explorer right-click action for `.html` / `.htm` files: `Open in Local HTML WYSIWYG Editor`
- command-palette action for the active HTML file
- command-palette action to start/check the local editor server
- settings for browser, host, port, auto-start, editor directory, and vault path override

The action opens a URL like:

```text
http://127.0.0.1:8787/?path=<vault-relative-path>
```

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
