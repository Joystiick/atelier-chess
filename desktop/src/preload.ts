import { contextBridge, ipcRenderer, shell } from "electron";

/** Mirrors `src/types/atelier-desktop.ts` on the web side. */
export type AtelierDesktopBridge = {
  isDesktop: true;
  platform: NodeJS.Platform;
  version: string;
  openExternal: (url: string) => Promise<void>;
  quit: () => void;
  checkForUpdates: () => void;
};

function readDesktopVersion(): string {
  const flag = process.argv.find((arg) =>
    arg.startsWith("--atelier-desktop-version="),
  );
  if (flag) return flag.slice("--atelier-desktop-version=".length) || "0.1.0";
  return "0.1.0";
}

const bridge: AtelierDesktopBridge = {
  isDesktop: true,
  platform: process.platform,
  version: readDesktopVersion(),
  openExternal: async (url: string) => {
    if (typeof url !== "string" || !url.trim()) return;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return;
    await shell.openExternal(parsed.toString());
  },
  quit: () => {
    ipcRenderer.send("atelier:quit");
  },
  checkForUpdates: () => {
    ipcRenderer.send("atelier:check-updates");
  },
};

contextBridge.exposeInMainWorld("atelierDesktop", bridge);
