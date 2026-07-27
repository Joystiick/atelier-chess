"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { useEffect, useRef } from "react";

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

    const id = window.setInterval(() => beat("online"), 45_000);

    const onHide = () => {
      if (document.visibilityState === "hidden") {
        // heartbeat only; keep online while tab hidden briefly
      }
    };
    document.addEventListener("visibilitychange", onHide);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onHide);
      sent.current = false;
    };
  }, [user]);

  return null;
}
