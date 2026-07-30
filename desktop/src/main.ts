import {
  app,
  BrowserWindow,
  Menu,
  shell,
  dialog,
  session,
  ipcMain,
  type MenuItemConstructorOptions,
} from "electron";
import { autoUpdater } from "electron-updater";
import fs from "node:fs";
import path from "node:path";

const PROD_URL = "https://atelierchess.netlify.app";
const PARTITION = "persist:atelier";
const BG = "#0c1210";
const PROTOCOL = "atelier";

/** Production site by default; set ATELIER_URL (e.g. http://localhost:3000) for local web. */
function resolveAppUrl(): string {
  const override = process.env.ATELIER_URL?.trim();
  if (override) return override.replace(/\/$/, "");
  return PROD_URL;
}

function isAllowedNavigation(targetUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  const host = parsed.hostname;
  if (host === "atelierchess.netlify.app") return true;

  const override = process.env.ATELIER_URL?.trim();
  let overrideHost: string | null = null;
  if (override) {
    try {
      overrideHost = new URL(override).hostname;
    } catch {
      /* ignore */
    }
  }

  // Loopback only in unpackaged builds, or when ATELIER_URL explicitly targets it.
  if (host === "localhost" || host === "127.0.0.1") {
    if (!app.isPackaged) return true;
    return overrideHost === host;
  }

  if (overrideHost && overrideHost === host) return true;
  return false;
}

/** Only http(s) may leave the shell via openExternal (blocks file:, custom URI handlers, etc.). */
function isSafeExternalUrl(targetUrl: string): boolean {
  try {
    const parsed = new URL(targetUrl);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function openExternalSafe(url: string): void {
  if (isSafeExternalUrl(url)) void shell.openExternal(url);
}

/**
 * Map atelier://join/ABC123 → /join/ABC123
 * Also supports atelier://challenge/user, atelier://watch/CODE, atelier://friends.
 */
function deepLinkToSitePath(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== `${PROTOCOL}:`) return null;
    const hostPart = parsed.hostname;
    const pathPart = parsed.pathname.replace(/\/+$/, "") || "";
    let sitePath: string;
    if (hostPart) {
      sitePath = `/${hostPart}${pathPart}`;
    } else {
      sitePath = pathPart || "/";
    }
    if (!sitePath.startsWith("/")) sitePath = `/${sitePath}`;
    // Protocol-relative paths (//evil.com) would resolve off-origin via new URL().
    if (sitePath.startsWith("//")) return null;
    return `${sitePath}${parsed.search || ""}${parsed.hash || ""}`;
  } catch {
    return null;
  }
}

let mainWindow: BrowserWindow | null = null;
let pendingDeepLink: string | null = null;

function getIconPath(): string | undefined {
  const candidates = [
    path.join(__dirname, "..", "build", "icon.png"),
    path.join(process.resourcesPath, "build", "icon.png"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

function navigateToPath(sitePath: string): void {
  const base = resolveAppUrl();
  let target: string;
  try {
    target = new URL(sitePath, `${base}/`).toString();
  } catch {
    return;
  }
  if (!isAllowedNavigation(target)) return;
  if (!mainWindow) {
    pendingDeepLink = sitePath;
    return;
  }
  void mainWindow.loadURL(target);
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

function handleDeepLink(rawUrl: string): void {
  const sitePath = deepLinkToSitePath(rawUrl);
  if (!sitePath) return;
  navigateToPath(sitePath);
}

async function stampDesktopCookie(): Promise<void> {
  const base = resolveAppUrl();
  let parsed: URL;
  try {
    parsed = new URL(base);
  } catch {
    return;
  }
  const ses = session.fromPartition(PARTITION);
  const url = `${parsed.protocol}//${parsed.host}/`;
  try {
    await ses.cookies.set({
      url,
      name: "atelier_desktop",
      value: "1",
      path: "/",
      secure: parsed.protocol === "https:",
      httpOnly: false,
      sameSite: parsed.protocol === "https:" ? "no_restriction" : "lax",
      expirationDate: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 400,
    });
  } catch (err) {
    console.warn("[desktop] cookie stamp failed", err);
  }
}

/**
 * Drop PWA service workers / Cache Storage for the app origin.
 * Stale SW HTML for /play caused blank black shells and multi-click opens.
 */
async function clearStaleWebCaches(): Promise<void> {
  const ses = session.fromPartition(PARTITION);
  try {
    await ses.clearStorageData({
      storages: ["serviceworkers", "cachestorage"],
    });
  } catch (err) {
    console.warn("[desktop] web cache clear failed", err);
  }
}

async function prepareDesktopSession(): Promise<void> {
  await stampDesktopCookie();
  await clearStaleWebCaches();
}

/** Mark every cloud request as coming from the desktop shell (middleware + APIs). */
function installDesktopRequestHeaders(): void {
  const ses = session.fromPartition(PARTITION);
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders };
    try {
      const host = new URL(details.url).hostname;
      if (
        host === "atelierchess.netlify.app" ||
        host === "localhost" ||
        host === "127.0.0.1"
      ) {
        headers["X-Atelier-Desktop"] = "1";
      }
    } catch {
      /* ignore bad urls */
    }
    callback({ requestHeaders: headers });
  });
}

function createWindow(): BrowserWindow {
  const icon = getIconPath();
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: BG,
    show: false,
    title: "Atelier Chess",
    autoHideMenuBar: process.platform === "win32",
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: PARTITION,
      spellcheck: false,
      additionalArguments: [`--atelier-desktop-version=${app.getVersion()}`],
    },
  });

  // Ensure UA is detectable even if Chromium omits "Electron/"
  const ua = win.webContents.getUserAgent();
  if (!/Electron\//i.test(ua) && !/AtelierDesktop\//i.test(ua)) {
    win.webContents.setUserAgent(`${ua} AtelierDesktop/${app.getVersion()}`);
  }

  win.once("ready-to-show", () => {
    win.show();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedNavigation(url)) {
      void win.loadURL(url);
    } else {
      openExternalSafe(url);
    }
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedNavigation(url)) {
      event.preventDefault();
      openExternalSafe(url);
    }
  });

  win.webContents.on("did-finish-load", () => {
    void stampDesktopCookie();
  });

  // Catch renderer crashes instead of silent quit
  win.webContents.on("render-process-gone", (_event, details) => {
    console.error("[desktop] renderer gone", details);
    void dialog.showMessageBox({
      type: "error",
      title: "Atelier Chess",
      message: "The window crashed and will reload.",
      detail: details.reason,
    });
    void prepareDesktopSession().then(() => {
      if (!win.isDestroyed()) void win.loadURL(resolveAppUrl());
    });
  });

  let start = resolveAppUrl();
  if (pendingDeepLink != null) {
    try {
      const candidate = new URL(
        pendingDeepLink,
        `${resolveAppUrl()}/`,
      ).toString();
      if (isAllowedNavigation(candidate)) start = candidate;
    } catch {
      /* ignore malformed deep link */
    }
  }
  pendingDeepLink = null;
  void prepareDesktopSession().then(() => win.loadURL(start));

  return win;
}

function buildMenu(): void {
  const base = resolveAppUrl();
  const isMac = process.platform === "darwin";

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),
    {
      label: "Play",
      submenu: [
        {
          label: "Home",
          accelerator: "CmdOrCtrl+1",
          click: () => navigateToPath("/"),
        },
        {
          label: "New game",
          accelerator: "CmdOrCtrl+N",
          click: () => navigateToPath("/play"),
        },
        {
          label: "Friends",
          accelerator: "CmdOrCtrl+F",
          click: () => navigateToPath("/friends"),
        },
        { type: "separator" },
        {
          label: "Reload",
          role: "reload",
        },
      ],
    },
    {
      label: "Friends",
      submenu: [
        {
          label: "Open friends",
          click: () => navigateToPath("/friends"),
        },
        {
          label: "Profile",
          click: () => navigateToPath("/profile"),
        },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "How to play",
          click: () => navigateToPath("/how-to"),
        },
        {
          label: "Download page",
          click: () => {
            void shell.openExternal(`${PROD_URL}/download`);
          },
        },
        {
          label: "Open in browser",
          click: () => {
            void shell.openExternal(base);
          },
        },
        { type: "separator" },
        {
          label: "Check for updates…",
          click: () => {
            void checkForUpdates(true);
          },
        },
        ...(isMac
          ? []
          : [
              { type: "separator" as const },
              { role: "quit" as const, label: "Quit" },
            ]),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function setupAutoUpdater(): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  // Soft-fail: unsigned builds / missing feed must not crash the app.
  autoUpdater.on("error", (err) => {
    console.warn("[updater]", err.message);
  });
  autoUpdater.on("update-available", (info) => {
    console.info("[updater] update available:", info.version);
    void dialog.showMessageBox({
      type: "info",
      title: "Update available",
      message: `Atelier Chess ${info.version} is downloading.`,
      detail:
        "Signed builds install automatically when ready. Unsigned betas may soft-fail — see docs/desktop-updates.md.",
    });
  });
  autoUpdater.on("update-not-available", () => {
    // Quiet unless user-initiated path already handled below
  });
  autoUpdater.on("update-downloaded", (info) => {
    console.info("[updater] update downloaded:", info.version);
    void dialog
      .showMessageBox({
        type: "info",
        title: "Update ready",
        message: `Atelier Chess ${info.version} is ready to install.`,
        detail:
          "The update will apply when you quit the app, or you can restart now.",
        buttons: ["Restart now", "Later"],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
  });
}

async function checkForUpdates(userInitiated: boolean): Promise<void> {
  if (!app.isPackaged) {
    if (userInitiated) {
      void dialog.showMessageBox({
        type: "info",
        title: "Updates",
        message: "Auto-update only runs in packaged builds.",
      });
    }
    return;
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    if (userInitiated && result?.updateInfo) {
      // update-available handler may also fire; avoid double dialogs when none
    } else if (userInitiated && !result?.updateInfo) {
      void dialog.showMessageBox({
        type: "info",
        title: "Up to date",
        message: "You're on the latest packaged build (or no feed is configured yet).",
        detail:
          "Without code signing / a published latest.yml feed, checks soft-fail. See docs/desktop-updates.md.",
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[updater] check failed (soft):", message);
    if (userInitiated) {
      void dialog.showMessageBox({
        type: "warning",
        title: "Update check failed",
        message:
          "Could not check for updates. This is normal for unsigned betas or when no release feed is published yet.",
        detail: `${message}\n\nSee docs/desktop-updates.md for signing notes.`,
      });
    }
  }
}

function registerProtocol(): void {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
        path.resolve(process.argv[1]),
      ]);
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }
}

function collectDeepLinkFromArgv(argv: string[]): string | null {
  return argv.find((arg) => arg.startsWith(`${PROTOCOL}://`)) ?? null;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const link = collectDeepLinkFromArgv(argv);
    if (link) handleDeepLink(link);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });

  const coldLink = collectDeepLinkFromArgv(process.argv);
  if (coldLink) pendingDeepLink = deepLinkToSitePath(coldLink);

  ipcMain.on("atelier:quit", () => {
    app.quit();
  });

  ipcMain.on("atelier:check-updates", () => {
    void checkForUpdates(true);
  });

  app.whenReady().then(() => {
    registerProtocol();
    installDesktopRequestHeaders();
    void stampDesktopCookie();
    buildMenu();
    setupAutoUpdater();
    mainWindow = createWindow();
    mainWindow.on("closed", () => {
      mainWindow = null;
    });
    void checkForUpdates(false);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow();
        mainWindow.on("closed", () => {
          mainWindow = null;
        });
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
