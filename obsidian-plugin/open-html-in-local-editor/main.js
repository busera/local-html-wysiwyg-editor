const { Notice, Plugin, PluginSettingTab, Setting, TFile } = require("obsidian");
const { execFile, spawn } = require("child_process");
const http = require("http");
const path = require("path");

const HTML_EXTENSIONS = new Set(["html", "htm"]);
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

const DEFAULT_SETTINGS = {
  editorHost: "127.0.0.1",
  editorPort: 8787,
  browser: "default",
  autoStartServer: true,
  editorDirectory: "",
  vaultPath: "",
};

const BROWSER_APPS = {
  default: null,
  safari: "Safari",
  chrome: "Google Chrome",
};

function isHtmlFile(file) {
  return file instanceof TFile && HTML_EXTENSIONS.has(file.extension.toLowerCase());
}

function isLocalHost(host) {
  return LOCAL_HOSTS.has(String(host || "").trim().toLowerCase());
}

function normalizePort(port) {
  const parsed = Number.parseInt(String(port), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) return DEFAULT_SETTINGS.editorPort;
  return parsed;
}

function buildEditorUrl(file, settings) {
  const host = settings.editorHost || DEFAULT_SETTINGS.editorHost;
  const port = normalizePort(settings.editorPort);
  const url = new URL(`http://${host}:${port}/`);
  url.searchParams.set("path", file.path);
  return url.toString();
}

function healthUrl(settings) {
  const host = settings.editorHost || DEFAULT_SETTINGS.editorHost;
  const port = normalizePort(settings.editorPort);
  return `http://${host}:${port}/api/health`;
}

function checkServer(settings) {
  return new Promise((resolve) => {
    const request = http.get(healthUrl(settings), { timeout: 1000 }, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
  });
}

function waitForServer(settings, attempts = 20) {
  return new Promise((resolve) => {
    let remaining = attempts;
    const tick = async () => {
      if (await checkServer(settings)) {
        resolve(true);
        return;
      }
      remaining -= 1;
      if (remaining <= 0) {
        resolve(false);
        return;
      }
      window.setTimeout(tick, 250);
    };
    tick();
  });
}

module.exports = class OpenHtmlInLocalEditorPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.settings.editorPort = normalizePort(this.settings.editorPort);

    this.addSettingTab(new OpenHtmlInLocalEditorSettingTab(this.app, this));

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!isHtmlFile(file)) return;
        menu.addItem((item) => {
          item
            .setTitle("Open in Local HTML WYSIWYG Editor")
            .setIcon("pencil")
            .onClick(() => this.openFileInEditor(file));
        });
      })
    );

    this.addCommand({
      id: "open-active-html-in-local-editor",
      name: "Open active HTML file in Local HTML WYSIWYG Editor",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!isHtmlFile(file)) return false;
        if (!checking) this.openFileInEditor(file);
        return true;
      },
    });

    this.addCommand({
      id: "start-local-html-editor-server",
      name: "Start Local HTML WYSIWYG Editor server",
      callback: () => this.ensureServerRunning(true),
    });
  }

  async saveSettings() {
    this.settings.editorPort = normalizePort(this.settings.editorPort);
    await this.saveData(this.settings);
  }

  getVaultPath() {
    if (this.settings.vaultPath && this.settings.vaultPath.trim()) return this.settings.vaultPath.trim();
    if (this.app.vault.adapter && typeof this.app.vault.adapter.getBasePath === "function") {
      return this.app.vault.adapter.getBasePath();
    }
    return "";
  }

  getEditorDirectory() {
    return String(this.settings.editorDirectory || "").trim();
  }

  async ensureServerRunning(showSuccessNotice = false) {
    if (await checkServer(this.settings)) {
      if (showSuccessNotice) new Notice("Local HTML editor server is already running.");
      return true;
    }

    if (!this.settings.autoStartServer && !showSuccessNotice) {
      new Notice("Local HTML editor server is not running. Enable auto-start or start it manually.");
      return false;
    }

    if (!isLocalHost(this.settings.editorHost)) {
      new Notice("Auto-start is allowed only for 127.0.0.1 / localhost.");
      return false;
    }

    const editorDirectory = this.getEditorDirectory();
    if (!editorDirectory) {
      new Notice("Set the Local HTML editor directory in plugin settings before using auto-start.");
      return false;
    }

    const vaultPath = this.getVaultPath();
    if (!vaultPath) {
      new Notice("Could not determine vault path. Set the vault path override in plugin settings.");
      return false;
    }

    const serverScript = path.join(editorDirectory, "server.py");
    const args = [
      serverScript,
      "--host",
      this.settings.editorHost,
      "--port",
      String(normalizePort(this.settings.editorPort)),
      "--vault",
      vaultPath,
    ];

    try {
      const child = spawn("python3", args, {
        cwd: editorDirectory,
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    } catch (error) {
      new Notice(`Failed to start local HTML editor server: ${error.message}`);
      return false;
    }

    const started = await waitForServer(this.settings);
    if (started) {
      new Notice("Started Local HTML WYSIWYG Editor server.");
      return true;
    }

    new Notice("Tried to start Local HTML editor server, but it did not become ready.");
    return false;
  }

  openUrl(url) {
    const appName = BROWSER_APPS[this.settings.browser] || null;
    if (!appName) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    execFile("/usr/bin/open", ["-a", appName, url], (error) => {
      if (error) {
        new Notice(`Could not open ${appName}; opening with default browser instead.`);
        window.open(url, "_blank", "noopener,noreferrer");
      }
    });
  }

  async openFileInEditor(file) {
    const ready = await this.ensureServerRunning(false);
    if (!ready) return;
    this.openUrl(buildEditorUrl(file, this.settings));
    new Notice("Opening HTML file in Local HTML WYSIWYG Editor");
  }
};

class OpenHtmlInLocalEditorSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Open HTML in Local Editor" });

    new Setting(containerEl)
      .setName("Browser")
      .setDesc("Choose which browser opens the local editor.")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("default", "System default")
          .addOption("safari", "Safari")
          .addOption("chrome", "Google Chrome")
          .setValue(this.plugin.settings.browser)
          .onChange(async (value) => {
            this.plugin.settings.browser = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Editor host")
      .setDesc("Default: 127.0.0.1. Auto-start is restricted to localhost for safety.")
      .addText((text) => {
        text
          .setPlaceholder("127.0.0.1")
          .setValue(this.plugin.settings.editorHost)
          .onChange(async (value) => {
            this.plugin.settings.editorHost = value.trim() || DEFAULT_SETTINGS.editorHost;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Editor port")
      .setDesc("Default: 8787.")
      .addText((text) => {
        text
          .setPlaceholder("8787")
          .setValue(String(this.plugin.settings.editorPort))
          .onChange(async (value) => {
            this.plugin.settings.editorPort = normalizePort(value);
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Auto-start server")
      .setDesc("Start the local editor server automatically before opening a file if it is not running.")
      .addToggle((toggle) => {
        toggle
          .setValue(Boolean(this.plugin.settings.autoStartServer))
          .onChange(async (value) => {
            this.plugin.settings.autoStartServer = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Editor directory")
      .setDesc("Folder containing server.py and the local HTML editor files.")
      .addText((text) => {
        text
          .setPlaceholder("/path/to/local-html-wysiwyg-editor")
          .setValue(this.plugin.settings.editorDirectory)
          .onChange(async (value) => {
            this.plugin.settings.editorDirectory = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Vault path override")
      .setDesc("Optional. Leave blank to use the current Obsidian vault path.")
      .addText((text) => {
        text
          .setPlaceholder("/path/to/your/vault")
          .setValue(this.plugin.settings.vaultPath)
          .onChange(async (value) => {
            this.plugin.settings.vaultPath = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Server status")
      .setDesc("Check or start the configured local editor server.")
      .addButton((button) => {
        button
          .setButtonText("Start / Check")
          .onClick(async () => {
            await this.plugin.ensureServerRunning(true);
          });
      });
  }
}
