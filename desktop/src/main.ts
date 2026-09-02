import path from "node:path";
import fs from "node:fs";
import { app, BrowserWindow, Menu, dialog, shell, ipcMain, session } from "electron";
import type { MenuItemConstructorOptions, WebContents } from "electron";
import { loadConfig, saveConfig, type AppConfig } from "./config";
import { serverDir, binDir, userDataDir, runtimeDataDir, windowIcon, setupPortableMode, isPortable } from "./paths";
import { findFreePort, startBackend, probeDeps, type Backend } from "./server";

setupPortableMode();

const DEV = !app.isPackaged;
const FIXED_DEV_PORT = 4000;

let backend: Backend | null = null;
let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let warnedDeps = false;

async function ping(url: string, ms = 800): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function ensureBackend(): Promise<Backend> {
  if (backend && (backend.proc === null || backend.proc.exitCode === null)) return backend;

  if (DEV && (await ping(`http://127.0.0.1:${FIXED_DEV_PORT}/api/health`))) {
    console.log(`[desktop] 复用已在运行的后端 :${FIXED_DEV_PORT}`);
    backend = {
      port: FIXED_DEV_PORT,
      baseUrl: `http://127.0.0.1:${FIXED_DEV_PORT}`,
      proc: null,
      stop: () => {},
    };
    return backend;
  }

  const cfg = loadConfig();
  const port = DEV ? FIXED_DEV_PORT : await findFreePort();
  backend = await startBackend(port, cfg, !DEV, (line) => {
    console.log("[server]", line);
  });
  return backend;
}

async function waitForPortClosed(port: number, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await ping(`http://127.0.0.1:${port}/api/health`, 300);
    if (!ok) return;
    await new Promise((r) => setTimeout(r, 200));
  }
}

async function restartBackend(): Promise<Backend> {
  const old = backend;
  backend = null;
  if (old) {
    old.stop();
    await waitForPortClosed(old.port);
  }
  const next = await ensureBackend();
  return next;
}

async function resolveEntryUrl(b: Backend): Promise<string> {
  if (!DEV) return b.baseUrl;
  return (await ping("http://127.0.0.1:3000")) ? "http://127.0.0.1:3000" : b.baseUrl;
}

async function health(): Promise<{ outDir: string; llm: { baseUrl: string; model: string; configured: boolean } } | null> {
  if (!backend) return null;
  try {
    const res = await fetch(`${backend.baseUrl}/api/health`, { signal: AbortSignal.timeout(2000) });
    return (await res.json()) as any;
  } catch {
    return null;
  }
}

function createMainWindow(url: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: "#f6f9ff",
    title: "TextToTalk",
    icon: windowIcon(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.loadURL(url).catch((e) => {
    dialog.showErrorBox("加载失败", String(e));
  });
  win.once("ready-to-show", () => {
    win.show();
    if (DEV && process.env.TTT_OPEN_DEVTOOLS === "1") win.webContents.openDevTools({ mode: "detach" });
  });
  win.on("closed", () => {
    mainWindow = null;
  });
  attachWindowHandlers(win);
  return win;
}

function attachWindowHandlers(win: BrowserWindow) {
  win.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
}

function showSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 680,
    height: 880,
    minWidth: 560,
    minHeight: 600,
    resizable: true,
    parent: mainWindow ?? undefined,
    modal: !!mainWindow,
    title: "设置",
    backgroundColor: "#f6f9ff",
    autoHideMenuBar: true,
    icon: windowIcon(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.loadFile(path.join(__dirname, "..", "assets", "settings.html"));
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
  attachWindowHandlers(settingsWindow);
}

function activeWebContents(): WebContents | null {
  const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
  return win && !win.isDestroyed() ? win.webContents : null;
}

function buildMenu() {
  const template: MenuItemConstructorOptions[] = [];
  if (process.platform === "darwin") template.push({ role: "appMenu" });

  template.push(
    {
      label: "文件",
      submenu: [
        { label: "打开输出目录", accelerator: "CmdOrCtrl+O", click: () => void openOutputDir() },
        { label: "打开数据目录", click: () => void openDataDir() },
        { type: "separator" },
        { role: "quit", label: "退出" },
      ],
    },
    {
      label: "设置",
      submenu: [
        { label: "API 与渲染设置…", accelerator: "CmdOrCtrl+,", click: () => showSettings() },
        { label: "重新加载页面", accelerator: "CmdOrCtrl+R", click: () => activeWebContents()?.reload() },
        { label: "开发者工具", accelerator: "CmdOrCtrl+Shift+I", click: () => activeWebContents()?.openDevTools({ mode: "detach" }) },
      ],
    },
  );

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function outputDir(): Promise<string> {
  const h = await health();
  return h?.outDir || path.join(runtimeDataDir(), "out");
}

async function openOutputDir(): Promise<string | null> {
  const dir = await outputDir();
  fs.mkdirSync(dir, { recursive: true });
  const err = await shell.openPath(dir);
  return err || null;
}

async function openDataDir(): Promise<string | null> {
  const dir = runtimeDataDir();
  fs.mkdirSync(dir, { recursive: true });
  const err = await shell.openPath(dir);
  return err || null;
}

function registerIpc() {
  ipcMain.handle("ttt:get-runtime", async () => {
    const cfg = loadConfig();
    return {
      packaged: !DEV,
      portable: isPortable(),
      version: app.getVersion(),
      baseUrl: backend?.baseUrl ?? "",
      userData: userDataDir(),
      serverDir: serverDir(),
      outDir: await outputDir(),
      dataDir: runtimeDataDir(),
      binDir: binDir(),
      deps: probeDeps(cfg),
    };
  });

  ipcMain.handle("ttt:get-config", async () => ({
    config: loadConfig(),
    llm: (await health())?.llm ?? null,
  }));

  ipcMain.handle("ttt:get-tts-fields", async () => {
    if (!backend) return { fields: [] };
    try {
      const res = await fetch(`${backend.baseUrl}/api/tts/config-fields`, { signal: AbortSignal.timeout(3000) });
      return (await res.json()) as { fields: { name: string; label: string; secret?: boolean; required?: boolean; placeholder?: string }[] };
    } catch {
      return { fields: [] };
    }
  });

  ipcMain.handle("ttt:save-config", async (_e, cfg: Partial<AppConfig>) => {
    try {
      saveConfig(cfg ?? {});
      const next = await restartBackend();
      const url = await resolveEntryUrl(next);
      mainWindow?.loadURL(url).catch(() => {});
      return { ok: true, baseUrl: next.baseUrl };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });

  ipcMain.handle("ttt:restart", async () => {
    try {
      const next = await restartBackend();
      const url = await resolveEntryUrl(next);
      mainWindow?.loadURL(url).catch(() => {});
      return { ok: true, baseUrl: next.baseUrl };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });

  ipcMain.handle("ttt:open-output-dir", () => openOutputDir());
  ipcMain.handle("ttt:open-data-dir", () => openDataDir());
  ipcMain.handle("ttt:close-self", (e) => {
    BrowserWindow.fromWebContents(e.sender)?.close();
  });
}

const DEP_HELP: Record<"chrome" | "ffmpeg", string> = {
  chrome: "没有它：成片无法渲染（会尝试联网下载内核，可能失败或很慢）",
  ffmpeg: "没有它：配音无法转码，整段渲染会直接失败",
};

async function bootstrap() {
  const cfg = loadConfig();

  const b = await ensureBackend();

  if (!warnedDeps) {
    warnedDeps = true;
    const deps = probeDeps(cfg);
    const missing = (["chrome", "ffmpeg"] as const).filter((k) => !deps[k]);
    if (missing.length) {
      const ext = process.platform === "win32" ? ".exe" : "";
      const fix =
        `方式一（推荐）：把 ${missing.map((m) => m + ext).join("、")} 放进下面目录，重启应用：\n${binDir()}\n\n` +
        `方式二：安装到系统 PATH 后重启应用\n` +
        (missing.includes("chrome")
          ? "\n方式三（Chromium 专用）：在「设置」里手动指定 Edge / Chrome 的可执行文件路径"
          : "");
      await dialog.showMessageBox({
        type: "warning",
        title: "缺少运行依赖",
        message: `未检测到 ${missing.join(" / ")}，部分功能不可用。`,
        detail: `${missing.map((m) => `· ${m}：${DEP_HELP[m]}`).join("\n")}\n\n${fix}`,
        buttons: ["知道了"],
      });
    }
  }

  mainWindow = createMainWindow(await resolveEntryUrl(b));

  const h = await health();
  if (h && !h.llm.configured) showSettings();
}

app.on("before-quit", () => {
  backend?.stop();
  backend = null;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const b = await ensureBackend();
    mainWindow = createMainWindow(await resolveEntryUrl(b));
  }
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    if (process.platform === "win32") app.setAppUserModelId("com.texttotalk.app");

    buildMenu();
    registerIpc();

    session.defaultSession.on("will-download", (_e, item) => {
      item.setSaveDialogOptions({
        defaultPath: path.join(app.getPath("downloads"), item.getFilename()),
        filters: [{ name: "视频", extensions: ["mp4"] }],
      });
    });
    try {
      await bootstrap();
    } catch (e) {
      dialog.showErrorBox("启动失败", String(e instanceof Error ? e.message : e));
      app.quit();
    }
  });
}
