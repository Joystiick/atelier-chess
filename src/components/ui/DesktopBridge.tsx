"use client";

import { useDesktopClient } from "@/hooks/useDesktopClient";
import { useEffect } from "react";

/** Adds `desktop-client` on `<body>` when running inside the Electron shell. */
export function DesktopBridge() {
  const { isDesktop, ready } = useDesktopClient();

  useEffect(() => {
    if (!ready) return;
    document.body.classList.toggle("desktop-client", isDesktop);
    return () => {
      document.body.classList.remove("desktop-client");
    };
  }, [isDesktop, ready]);

  return null;
}
