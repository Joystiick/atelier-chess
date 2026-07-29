"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { startVisibilityAwareInterval } from "@/lib/poll";
import { useEffect, useRef } from "react";

/** ~90s is enough for "online" UX; pause while Electron/window is hidden. */
const HEARTBEAT_MS = 90_000;

export function PresenceHeartbeat() {
  const { user } = useAuth();
  const sent = useRef(false);

  useEffect(() => {
    if (!user) return;

    const beat = (presence: "online" | "lfg" | "offline" = "online") => {
      void fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presence }),
        keepalive: true,
      }).catch(() => {
        // optional
      });
    };

    if (!sent.current) {
      sent.current = true;
      beat("online");
    }

    const stop = startVisibilityAwareInterval(() => beat("online"), HEARTBEAT_MS);

    return () => {
      stop();
      sent.current = false;
    };
  }, [user]);

  return null;
}
