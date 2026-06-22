import { app, BrowserWindow, shell } from "electron";
import path from "path";
import os from "os";
import { initDb, getDb } from "./store/db";
import { registerIpcHandlers } from "./ipc";
import { initUpdater } from "./updater";
import { CronEngine } from "./scheduler/cron-engine";

// Must run before app.whenReady() — redirects SQLite to a temp dir so each
// E2E test run starts with a clean database, and opens CDP port for Playwright
if (process.env.E2E_TEST === "1" && !app.isPackaged) {
  app.setPath("userData", path.join(os.tmpdir(), "bii-e2e-test"));
  app.commandLine.appendSwitch("remote-debugging-port", "9222");
}

function loadWindowState(): {
  x?: number;
  y?: number;
  width: number;
  height: number;
  maximized: boolean;
} {
  try {
    const db = getDb();
    const data = db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get("window_state") as any;
    if (data?.value) return JSON.parse(data.value);
  } catch {
    /* fallback */
  }
  return { width: 1200, height: 800, maximized: false };
}

function saveWindowState(win: BrowserWindow): void {
  try {
    const isMaximized = win.isMaximized();
    const bounds = win.getNormalBounds();
    const state = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      maximized: isMaximized,
    };
    const db = getDb();
    db.prepare(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    ).run("window_state", JSON.stringify(state));
  } catch {
    /* silent */
  }
}

function createWindow(): BrowserWindow {
  const state = loadWindowState();
  const win = new BrowserWindow({
    ...state,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (state.maximized) win.maximize();

  let saveTimer: NodeJS.Timeout | null = null;
  const debouncedSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveWindowState(win), 500);
  };
  win.on("resize", debouncedSave);
  win.on("move", debouncedSave);
  win.on("maximize", debouncedSave);
  win.on("unmaximize", debouncedSave);

  // Open external links in OS browser, not Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    let csp =
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'";
    // Vite HMR uses ws://localhost:<port> in dev mode — allow it
    const devUrl = process.env.ELECTRON_RENDERER_URL;
    if (devUrl) {
      const { port } = new URL(devUrl);
      csp += ` ws://localhost:${port}`;
    }
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [csp],
      },
    });
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  return win;
}

app.whenReady().then(() => {
  const userDataPath = app.getPath("userData");
  initDb(`${userDataPath}/conversations.db`);

  const win = createWindow();
  registerIpcHandlers(win);
  CronEngine.start();
  if (app.isPackaged) {
    initUpdater(win);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
