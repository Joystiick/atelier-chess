/**
 * Peer voice over Pusher client events + WebRTC.
 * Best-effort without TURN: works on same LAN / friendly NATs; documents soft fail.
 */
"use client";

import { getPusherClient } from "@/lib/pusher/client";
import { useEffect, useRef, useState } from "react";

type VoiceRoomProps = {
  code?: string;
};

type SignalPayload = {
  from: string;
  type: "hello" | "offer" | "answer" | "ice" | "mute";
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  muted?: boolean;
};

function peerId(): string {
  if (typeof window === "undefined") return "srv";
  const k = "atelier.voicePeerId";
  let id = sessionStorage.getItem(k);
  if (!id) {
    id = `p-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(k, id);
  }
  return id;
}

export function VoiceRoom({ code }: VoiceRoomProps) {
  const [live, setLive] = useState(false);
  const [muted, setMuted] = useState(true);
  const [peers, setPeers] = useState(0);
  const [error, setError] = useState("");
  const [note, setNote] = useState(
    "Best-effort peer voice (no TURN). Same Wi‑Fi works best.",
  );
  const streamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const selfId = useRef(peerId());

  const cleanupPeer = (id: string) => {
    const pc = pcsRef.current.get(id);
    if (pc) {
      pc.close();
      pcsRef.current.delete(id);
    }
    const el = audioElsRef.current.get(id);
    if (el) {
      el.srcObject = null;
      el.remove();
      audioElsRef.current.delete(id);
    }
    setPeers(pcsRef.current.size);
  };

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      for (const id of [...pcsRef.current.keys()]) cleanupPeer(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount only
  }, []);

  useEffect(() => {
    if (!code || !live) return;
    let channel: ReturnType<ReturnType<typeof getPusherClient>["subscribe"]> | null =
      null;
    try {
      const pusher = getPusherClient();
      channel = pusher.subscribe(`private-game-${code}`);

      const ensurePc = (remoteId: string) => {
        let pc = pcsRef.current.get(remoteId);
        if (pc) return pc;
        pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        pcsRef.current.set(remoteId, pc);
        setPeers(pcsRef.current.size);

        const local = streamRef.current;
        if (local) {
          for (const track of local.getAudioTracks()) {
            pc.addTrack(track, local);
          }
        }

        pc.onicecandidate = (ev) => {
          if (!ev.candidate || !channel) return;
          const payload: SignalPayload = {
            from: selfId.current,
            type: "ice",
            candidate: ev.candidate.toJSON(),
          };
          channel.trigger(`client-voice-${remoteId}`, payload);
        };

        pc.ontrack = (ev) => {
          let el = audioElsRef.current.get(remoteId);
          if (!el) {
            el = document.createElement("audio");
            el.autoplay = true;
            el.setAttribute("playsinline", "true");
            document.body.appendChild(el);
            audioElsRef.current.set(remoteId, el);
          }
          el.srcObject = ev.streams[0] ?? null;
        };

        pc.onconnectionstatechange = () => {
          if (
            pc.connectionState === "failed" ||
            pc.connectionState === "closed" ||
            pc.connectionState === "disconnected"
          ) {
            setNote(
              "Peer link dropped (no TURN). Stay on the same network if possible.",
            );
          }
        };

        return pc;
      };

      const signal = async (data: SignalPayload) => {
        if (!data?.from || data.from === selfId.current) return;
        if (data.type === "mute") return;

        if (data.type === "hello") {
          const pc = ensurePc(data.from);
          if (pc.signalingState !== "stable") return;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          channel?.trigger(`client-voice-${data.from}`, {
            from: selfId.current,
            type: "offer",
            sdp: offer,
          } satisfies SignalPayload);
          return;
        }

        if (data.type === "offer" && data.sdp) {
          const pc = ensurePc(data.from);
          await pc.setRemoteDescription(data.sdp);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channel?.trigger(`client-voice-${data.from}`, {
            from: selfId.current,
            type: "answer",
            sdp: answer,
          } satisfies SignalPayload);
          return;
        }

        if (data.type === "answer" && data.sdp) {
          const pc = pcsRef.current.get(data.from) ?? ensurePc(data.from);
          await pc.setRemoteDescription(data.sdp);
          return;
        }

        if (data.type === "ice" && data.candidate) {
          const pc = pcsRef.current.get(data.from) ?? ensurePc(data.from);
          try {
            await pc.addIceCandidate(data.candidate);
          } catch {
            // race with remote description
          }
        }
      };

      channel.bind(`client-voice-${selfId.current}`, (data: SignalPayload) => {
        void signal(data);
      });
      channel.bind("client-voice.signal", (data: SignalPayload) => {
        void signal(data);
      });

      channel.trigger("client-voice.signal", {
        from: selfId.current,
        type: "hello",
      } satisfies SignalPayload);
    } catch {
      setNote("Pusher client events unavailable — mic still works locally.");
    }

    return () => {
      if (channel) {
        channel.unbind(`client-voice-${selfId.current}`);
        channel.unbind("client-voice.signal");
      }
    };
  }, [code, live]);

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
            from: selfId.current,
            type: "mute",
            muted: nextMuted,
          } satisfies SignalPayload);
          if (!nextMuted) {
            ch?.trigger("client-voice.signal", {
              from: selfId.current,
              type: "hello",
            } satisfies SignalPayload);
          }
        } catch {
          // optional
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
        Table voice · {muted || !live ? "Mic off" : "Mic on"}
        {peers > 0 ? ` · ${peers} peer${peers === 1 ? "" : "s"}` : ""}
      </button>
      <p className="text-[10px] text-[var(--mist)]">{note}</p>
      {error && <p className="text-[10px] text-red-300">{error}</p>}
    </div>
  );
}
