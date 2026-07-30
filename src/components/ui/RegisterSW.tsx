"use client";

import { useEffect } from "react";

function isDesktopShell(): boolean {
  if (typeof window === "undefined") return false;
  if (window.atelierDesktop?.isDesktop) return true;
  const ua = navigator.userAgent ?? "";
  return /\bElectron\//i.test(ua) || /\bAtelierDesktop\//i.test(ua);
}

async function clearServiceWorkers(): Promise<void> {
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((r) => r.unregister()));
  const keys = await caches.keys();
  await Promise.all(keys.map((k) => caches.delete(k)));
}

export function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Electron loads the live site; a PWA SW causes stale /play shells.
    if (isDesktopShell()) {
      void clearServiceWorkers();
      return;
    }

    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // optional
    });
  }, []);
  return null;
}
