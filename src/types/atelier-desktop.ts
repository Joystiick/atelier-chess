/** Browser-side shape of the Electron preload bridge (`window.atelierDesktop`). */
export type AtelierDesktopBridge = {
  isDesktop: true;
  platform: string;
  version: string;
  openExternal: (url: string) => void | Promise<void>;
  quit: () => void;
  /** Soft update check — unsigned builds report failure without crashing. */
  checkForUpdates?: () => void | Promise<void>;
};

declare global {
  interface Window {
    /** Present only inside the Atelier Electron shell. */
    atelierDesktop?: AtelierDesktopBridge;
  }
}

export {};
