"use client";

import { getPusherClient } from "@/lib/pusher/client";
import { useEffect, useRef, useState } from "react";

type VoiceRoomProps = {
  code?: string;
};

/**
 * Local mic mute/unmute stub. Peer voice signaling via Pusher is planned.
 */
export function VoiceRoom({ code }: VoiceRoomProps) {
  const [live, setLive] = useState(false);
  const [muted, setMuted] = useState(true);
  const [error, setError] = useState("");
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const ensureStream = async () => {
    if (streamRef.current) return streamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    for (const t of stream.getAudioTracks()) t.enabled = !muted;
    setLive(true);
    return stream;
  };

  const toggle = async () => {
    setError("");
    try {
      const stream = await ensureStream();
      const nextMuted = !muted;
      for (const t of stream.getAudioTracks()) t.enabled = !nextMuted;
      setMuted(nextMuted);

      if (code) {
        try {
          const pusher = getPusherClient();
          const ch = pusher.channel(`private-game-${code}`);
          ch?.trigger("client-voice.signal", {
            muted: nextMuted,
            ts: Date.now(),
          });
        } catch {
          // optional future signaling
        }
      }
    } catch {
      setError("Mic permission denied or unavailable");
      setLive(false);
    }
  };

  return (
    <div className="space-y-1">
      <button type="button" className="chip touch-target" onClick={() => void toggle()}>
        Table voice (beta) · {muted || !live ? "Mic off" : "Mic on"}
      </button>
      <p className="text-[10px] text-[var(--mist)]">
        Peer voice signaling via Pusher coming — mic test only for now.
      </p>
      {error && <p className="text-[10px] text-red-300">{error}</p>}
    </div>
  );
}
