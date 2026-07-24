"use client";

import { getAmbient, getSoundEnabled, type AmbientMode } from "@/lib/names";
import { useEffect, useRef } from "react";

function noiseBuffer(ctx: AudioContext, seconds: number) {
  const len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/** Soft looping ambient beds. */
export function useAmbient(mode?: AmbientMode) {
  const nodes = useRef<{
    ctx: AudioContext;
    gain: GainNode;
    src?: AudioBufferSourceNode;
    filter?: BiquadFilterNode;
  } | null>(null);

  useEffect(() => {
    const active = mode ?? getAmbient();
    if (active === "off" || !getSoundEnabled()) {
      nodes.current?.gain.gain.setTargetAtTime(0, nodes.current.ctx.currentTime, 0.2);
      return;
    }

    const ctx = nodes.current?.ctx ?? new AudioContext();
    const gain = nodes.current?.gain ?? ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.value = 0;

    if (nodes.current?.src) {
      try {
        nodes.current.src.stop();
      } catch {
        // already stopped
      }
    }

    const filter = ctx.createBiquadFilter();
    filter.type = active === "rain" ? "lowpass" : active === "hall" ? "bandpass" : "highpass";
    filter.frequency.value =
      active === "rain" ? 1200 : active === "hall" ? 400 : 800;
    filter.Q.value = active === "hall" ? 0.7 : 1;

    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 2);
    src.loop = true;
    src.connect(filter);
    filter.connect(gain);
    src.start();

    const target =
      active === "rain" ? 0.035 : active === "room" ? 0.02 : 0.028;
    gain.gain.setTargetAtTime(target, ctx.currentTime, 0.4);

    nodes.current = { ctx, gain, src, filter };

    return () => {
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      window.setTimeout(() => {
        try {
          src.stop();
        } catch {
          // ignore
        }
      }, 400);
    };
  }, [mode]);
}
