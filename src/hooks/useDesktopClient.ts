"use client";

import type { AtelierDesktopBridge } from "@/types/atelier-desktop";
import { useEffect, useState } from "react";

export type DesktopClientState = {
  isDesktop: boolean;
  bridge: AtelierDesktopBridge | null;
  ready: boolean;
};

function readBridge(): AtelierDesktopBridge | null {
  if (typeof window === "undefined") return null;
  const bridge = window.atelierDesktop;
  if (!bridge?.isDesktop) return null;
  return bridge;
}

export function useDesktopClient(): DesktopClientState {
  const [state, setState] = useState<DesktopClientState>({
    isDesktop: false,
    bridge: null,
    ready: false,
  });

  useEffect(() => {
    const apply = () => {
      const bridge = readBridge();
      setState({
        isDesktop: Boolean(bridge),
        bridge,
        ready: true,
      });
    };

    apply();

    // Preload may inject slightly after first paint in some builds.
    const t = window.setTimeout(apply, 50);
    return () => window.clearTimeout(t);
  }, []);

  return state;
}
