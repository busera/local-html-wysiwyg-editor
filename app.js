const DEFAULT_HTML = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Untitled HTML Document</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.55; margin: 2rem; }
  </style>
</head>
<body>
  <h1>Untitled HTML Document</h1>
  <p>Edit this document.</p>
</body>
</html>`;

const state = {
  fileHandle: null,
  serverPath: null,
  fileName: "untitled.html",
  isDirty: false,
  isSourceVisible: false,
};

const els = {
  status: document.getElementById("status"),
  openFile: document.getElementById("open-file"),
  saveFile: document.getElementById("save-file"),
  saveAs: document.getElementById("save-as"),
  downloadFile: document.getElementById("download-file"),
  newDoc: document.getElementById("new-doc"),
  cleanHtml: document.getElementById("clean-html"),
  toggleSource: document.getElementById("toggle-source"),
  applySource: document.getElementById("apply-source"),
  createLink: document.getElementById("create-link"),
  editorFrame: document.getElementById("editor-frame"),
  sourceEditor: document.getElementById("source-editor"),
  workspace: document.querySelector(".workspace"),
  fallbackRow: document.getElementById("fallback-row"),
  manualFile: document.getElementById("manual-file"),
  helpButton: document.getElementById("help-button"),
  helpDialog: document.getElementById("help-dialog"),
};

function supportsFileSystemAccess() {
  return typeof window.showOpenFilePicker === "function" &&
    typeof window.showSaveFilePicker === "function";
}

function setStatus(message, mode = "normal") {
  els.status.textContent = message;
  els.status.classList.toggle("dirty", mode === "dirty");
  els.status.classList.toggle("error", mode === "error");
}

function markDirty() {
  state.isDirty = true;
  setStatus(`${state.fileName} - unsaved`, "dirty");
}

function looksLikeFullHtml(html) {
  return /<html[\s>]/i.test(html) || /<body[\s>]/i.test(html);
}

function normalizeHtml(html) {
  const trimmed = String(html || "").trim();
  if (!trimmed) return DEFAULT_HTML;
  if (looksLikeFullHtml(trimmed)) return trimmed;
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>HTML Fragment</title>
</head>
<body>
${trimmed}
</body>
</html>`;
}

function setHtml(html) {
  const normalized = normalizeHtml(html);
  els.editorFrame.onload = prepareEditorDocument;
  els.editorFrame.srcdoc = normalized;
  els.sourceEditor.value = normalized;
  window.setTimeout(prepareEditorDocument, 100);
}

function getEditorDocument() {
  return els.editorFrame.contentDocument;
}

function prepareEditorDocument() {
  const doc = getEditorDocument();
  if (!doc) return;
  doc.designMode = "on";
  if (doc.body) {
    doc.body.contentEditable = "true";
    doc.body.dataset.localHtmlEditor = "true";
  }
  ["input", "keyup", "paste"].forEach((eventName) => {
    doc.addEventListener(eventName, markDirty);
  });
}

function serializeDocument() {
  if (state.isSourceVisible) return els.sourceEditor.value;
  const doc = getEditorDocument();
  if (!doc || !doc.documentElement) return els.sourceEditor.value || DEFAULT_HTML;
  const doctype = doc.doctype ? `<!doctype ${doc.doctype.name}>` : "<!doctype html>";
  return `${doctype}\n${doc.documentElement.outerHTML}`;
}

function enterManualFileMode() {
  els.fallbackRow.hidden = false;
  els.openFile.textContent = "Open via File Input";
  els.saveFile.disabled = true;
  els.saveAs.textContent = "Download Copy";
}

async function openFile() {
  if (!supportsFileSystemAccess()) {
    enterManualFileMode();
    els.manualFile.click();
    setStatus("Safari/manual mode: open with file input, save with Download Copy.");
    return;
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [{
        description: "HTML files",
        accept: { "text/html": [".html", ".htm"] },
      }],
    });
    const file = await handle.getFile();
    const html = await file.text();
    state.fileHandle = handle;
    state.serverPath = null;
    state.fileName = file.name;
    state.isDirty = false;
    els.saveFile.disabled = false;
    setHtml(html);
    setStatus(`${state.fileName} - loaded`);
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error(error);
      setStatus(`Open failed: ${error.message}`, "error");
    }
  }
}

async function saveToServerPath() {
  if (!state.serverPath) return false;
  const response = await fetch("/api/file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: state.serverPath, html: serializeDocument() }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || `Save failed with HTTP ${response.status}`);
  }
  state.fileName = payload.name || state.fileName;
  state.isDirty = false;
  els.saveFile.disabled = false;
  setStatus(`${state.fileName} - saved to vault`);
  return true;
}

async function saveToHandle(handle) {
  const writable = await handle.createWritable();
  await writable.write(serializeDocument());
  await writable.close();
  state.fileHandle = handle;
  state.fileName = handle.name || state.fileName;
  state.isDirty = false;
  els.saveFile.disabled = false;
  setStatus(`${state.fileName} - saved`);
}

async function saveFile() {
  try {
    if (state.serverPath && await saveToServerPath()) return;
    if (!state.fileHandle) {
      await saveAs();
      return;
    }
    await saveToHandle(state.fileHandle);
  } catch (error) {
    console.error(error);
    setStatus(`Save failed: ${error.message}`, "error");
  }
}

async function saveAs() {
  if (!supportsFileSystemAccess()) {
    downloadFile();
    return;
  }
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: state.fileName || "document.html",
      types: [{
        description: "HTML files",
        accept: { "text/html": [".html", ".htm"] },
      }],
    });
    await saveToHandle(handle);
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error(error);
      setStatus(`Save As failed: ${error.message}`, "error");
    }
  }
}

function downloadFile() {
  const blob = new Blob([serializeDocument()], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = state.fileName || "document.html";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setStatus(`${link.download} - downloaded`);
}

function newDocument() {
  state.fileHandle = null;
  state.serverPath = null;
  state.fileName = "untitled.html";
  state.isDirty = false;
  els.saveFile.disabled = true;
  setHtml(DEFAULT_HTML);
  setStatus("New document");
}

function exec(command, value = null) {
  const doc = getEditorDocument();
  if (!doc) return;
  doc.execCommand(command, false, value);
  markDirty();
}

function isSafeLinkTarget(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return false;
  if (/^(#|\/|\.\/|\.\.\/)/.test(trimmed)) return true;
  return /^(https?:|mailto:|obsidian:|file:)/i.test(trimmed);
}

function createLink() {
  const url = window.prompt("Link URL");
  if (!url) return;
  if (!isSafeLinkTarget(url)) {
    setStatus("Blocked unsafe link URL", "error");
    return;
  }
  exec("createLink", url.trim());
}

function removeComments(root) {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  const comments = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  comments.forEach((comment) => comment.remove());
}

function unwrap(element) {
  const parent = element.parentNode;
  if (!parent) return;
  while (element.firstChild) parent.insertBefore(element.firstChild, element);
  element.remove();
}

function cleanHtml() {
  const doc = getEditorDocument();
  if (!doc || !doc.body) return;
  removeComments(doc.body);
  doc.body.querySelectorAll("script,object,embed").forEach((el) => el.remove());
  doc.body.querySelectorAll("*").forEach((el) => {
    el.removeAttribute("style");
    el.removeAttribute("class");
    el.removeAttribute("id");
    if (el.tagName.toLowerCase() === "b") {
      const strong = doc.createElement("strong");
      strong.innerHTML = el.innerHTML;
      el.replaceWith(strong);
    }
    if (el.tagName.toLowerCase() === "i") {
      const emphasis = doc.createElement("em");
      emphasis.innerHTML = el.innerHTML;
      el.replaceWith(emphasis);
    }
  });
  doc.body.querySelectorAll("span").forEach(unwrap);
  doc.body.innerHTML = doc.body.innerHTML.replace(/(&nbsp;|\u00a0){2,}/g, " ");
  markDirty();
  setStatus(`${state.fileName} - cleaned`, "dirty");
}

function toggleSource() {
  state.isSourceVisible = !state.isSourceVisible;
  if (state.isSourceVisible) {
    els.sourceEditor.value = serializeDocument();
    els.sourceEditor.hidden = false;
    els.workspace.classList.add("source-visible");
    els.applySource.disabled = false;
    els.toggleSource.textContent = "Hide Source";
  } else {
    els.sourceEditor.hidden = true;
    els.workspace.classList.remove("source-visible");
    els.applySource.disabled = true;
    els.toggleSource.textContent = "Source";
  }
}

function applySource() {
  setHtml(els.sourceEditor.value);
  markDirty();
  setStatus(`${state.fileName} - source applied`, "dirty");
}

function loadManualFile(event) {
  const [file] = event.target.files || [];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.fileHandle = null;
    state.serverPath = null;
    state.fileName = file.name;
    state.isDirty = false;
    els.saveFile.disabled = true;
    setHtml(String(reader.result || ""));
    setStatus(`${state.fileName} - loaded in Safari/manual mode. Use Download Copy to save.`);
  };
  reader.onerror = () => setStatus("Manual file load failed", "error");
  reader.readAsText(file);
}

function bindEvents() {
  els.openFile.addEventListener("click", openFile);
  els.saveFile.addEventListener("click", saveFile);
  els.saveAs.addEventListener("click", saveAs);
  els.downloadFile.addEventListener("click", downloadFile);
  els.newDoc.addEventListener("click", newDocument);
  els.cleanHtml.addEventListener("click", cleanHtml);
  els.toggleSource.addEventListener("click", toggleSource);
  els.applySource.addEventListener("click", applySource);
  els.createLink.addEventListener("click", createLink);
  els.manualFile.addEventListener("change", loadManualFile);
  els.helpButton.addEventListener("click", () => els.helpDialog.showModal());
  document.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("click", () => exec(button.dataset.command, button.dataset.value || null));
  });
  window.addEventListener("beforeunload", (event) => {
    if (!state.isDirty) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

async function loadServerPathFromUrl() {
  const path = new URLSearchParams(window.location.search).get("path");
  if (!path) return false;
  try {
    const response = await fetch(`/api/file?path=${encodeURIComponent(path)}`);
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || `Open failed with HTTP ${response.status}`);
    }
    state.fileHandle = null;
    state.serverPath = payload.path;
    state.fileName = payload.name;
    state.isDirty = false;
    setHtml(payload.html);
    els.saveFile.disabled = false;
    setStatus(`${state.fileName} - loaded from vault`);
    return true;
  } catch (error) {
    console.error(error);
    setStatus(`Vault open failed: ${error.message}`, "error");
    return false;
  }
}

async function init() {
  if (!supportsFileSystemAccess()) enterManualFileMode();
  bindEvents();
  setHtml(DEFAULT_HTML);
  if (!await loadServerPathFromUrl()) {
    setStatus(supportsFileSystemAccess() ? "Ready" : "Ready - Safari/manual mode");
  }
}

init();
