"use client";

import { getSoundEnabled } from "@/lib/names";

type SoundKind = "move" | "capture" | "check" | "castle" | "promote" | "start" | "end" | "click";

let ctx: AudioContext | null = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function beep(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.04) {
  if (!getSoundEnabled()) return;
  const audio = getCtx();
  if (!audio) return;
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g);
  g.connect(audio.destination);
  const now = audio.currentTime;
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + dur);
  osc.start(now);
  osc.stop(now + dur);
}

export function playSound(kind: SoundKind) {
  try {
    switch (kind) {
      case "click":
        beep(420, 0.06, "triangle", 0.03);
        break;
      case "move":
        beep(520, 0.08, "triangle", 0.035);
        break;
      case "capture":
        beep(180, 0.12, "square", 0.04);
        window.setTimeout(() => beep(140, 0.08, "square", 0.03), 40);
        break;
      case "check":
        beep(660, 0.1, "sawtooth", 0.03);
        window.setTimeout(() => beep(880, 0.12, "sawtooth", 0.025), 70);
        break;
      case "castle":
        beep(400, 0.08, "triangle");
        window.setTimeout(() => beep(520, 0.1, "triangle"), 60);
        break;
      case "promote":
        beep(523, 0.08);
        window.setTimeout(() => beep(659, 0.08), 70);
        window.setTimeout(() => beep(784, 0.12), 140);
        break;
      case "start":
        beep(392, 0.1);
        window.setTimeout(() => beep(523, 0.14), 90);
        break;
      case "end":
        beep(330, 0.2, "sine", 0.05);
        window.setTimeout(() => beep(247, 0.35, "sine", 0.04), 160);
        break;
      default: {
        const _exhaustive: never = kind;
        return _exhaustive;
      }
    }
  } catch {
    // AudioContext can throw in locked autoplay / odd Electron states
  }
}
