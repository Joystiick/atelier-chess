"use client";

import { UserChip, useAuth } from "@/components/auth/AuthProvider";
import {
  BOARD_THEMES,
  getAmbient,
  getBoardTheme,
  getSoundEnabled,
  isThemeUnlocked,
  setAmbient,
  setBoardTheme,
  setSoundEnabled,
  type AmbientMode,
  type BoardTheme,
} from "@/lib/names";
import {
  getBlindfold,
  getCoachMode,
  getConfirmMove,
  getLampAuto,
  getMood,
  getPieceSet,
  getPremoveEnabled,
  MOOD_PACKS,
  PIECE_SETS,
  setBlindfold,
  setCoachMode,
  setConfirmMove,
  setLampAuto,
  setMood,
  setPieceSet,
  setPremoveEnabled,
  type MoodId,
  type PieceSetId,
} from "@/lib/prefs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sound, setSound] = useState(true);
  const [premove, setPremove] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [coach, setCoach] = useState(false);
  const [blindfold, setBlind] = useState(false);
  const [lampAuto, setLamp] = useState(true);
  const [pieceSet, setPiece] = useState<PieceSetId>("classic");
  const [boardTheme, setBoardThemeState] = useState<BoardTheme>("salon-emerald");
  const [mood, setMoodState] = useState<MoodId | "">("");
  const [ambient, setAmbientState] = useState<AmbientMode>("off");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/settings");
  }, [loading, user, router]);

  useEffect(() => {
    setSound(getSoundEnabled());
    setPremove(getPremoveEnabled());
    setConfirm(getConfirmMove());
    setCoach(getCoachMode());
    setBlind(getBlindfold());
    setLamp(getLampAuto());
    setPiece(getPieceSet());
    setBoardThemeState(getBoardTheme());
    setMoodState(getMood() ?? "");
    setAmbientState(getAmbient());
  }, []);

  const persist = () => {
    setSoundEnabled(sound);
    setPremoveEnabled(premove);
    setConfirmMove(confirm);
    setCoachMode(coach);
    setBlindfold(blindfold);
    setLampAuto(lampAuto);
    setPieceSet(pieceSet);
    setBoardTheme(boardTheme);
    setMood(mood || null);
    if (mood) {
      setAmbient(MOOD_PACKS[mood].ambient);
      setAmbientState(MOOD_PACKS[mood].ambient);
    } else {
      setAmbient(ambient);
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  };

  if (loading || !user) {
    return (
      <main className="grid min-h-screen place-items-center text-[var(--mist)]">
        Loading…
      </main>
    );
  }

  const Toggle = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <input
        type="checkbox"
        className="touch-target h-5 w-5"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );

  const unlockedThemes = (Object.keys(BOARD_THEMES) as BoardTheme[]).filter(
    isThemeUnlocked,
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 px-4 py-10">
      <div className="flex items-center justify-between">
        <Link href="/play" className="text-sm text-[var(--mist)] hover:text-[var(--brass)]">
          ← Lobby
        </Link>
        <UserChip />
      </div>

      <h1 className="font-[family-name:var(--font-display)] text-4xl">Settings</h1>
      <p className="text-[var(--mist)]">Local preferences for the board and salon.</p>

      <section className="panel space-y-3">
        <Toggle label="Sound" value={sound} onChange={setSound} />
        <Toggle label="Premoves" value={premove} onChange={setPremove} />
        <Toggle label="Confirm move" value={confirm} onChange={setConfirm} />
        <Toggle label="Coach mode" value={coach} onChange={setCoach} />
        <Toggle label="Blindfold" value={blindfold} onChange={setBlind} />
        <Toggle label="Lamp auto (by hour)" value={lampAuto} onChange={setLamp} />

        <label className="block text-sm">
          Table skin
          <select
            className="field mt-1"
            value={boardTheme}
            onChange={(e) => setBoardThemeState(e.target.value as BoardTheme)}
          >
            {unlockedThemes.map((id) => (
              <option key={id} value={id}>
                {BOARD_THEMES[id].label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          Piece set
          <select
            className="field mt-1"
            value={pieceSet}
            onChange={(e) => setPiece(e.target.value as PieceSetId)}
          >
            {(Object.keys(PIECE_SETS) as PieceSetId[]).map((id) => (
              <option key={id} value={id}>
                {PIECE_SETS[id].label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          Mood pack
          <select
            className="field mt-1"
            value={mood}
            onChange={(e) => setMoodState(e.target.value as MoodId | "")}
          >
            <option value="">None (manual ambient)</option>
            {(Object.keys(MOOD_PACKS) as MoodId[]).map((id) => (
              <option key={id} value={id}>
                {MOOD_PACKS[id].label}
              </option>
            ))}
          </select>
        </label>

        {!mood && (
          <label className="block text-sm">
            Ambient
            <select
              className="field mt-1"
              value={ambient}
              onChange={(e) => setAmbientState(e.target.value as AmbientMode)}
            >
              {(["off", "rain", "room", "hall"] as AmbientMode[]).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        )}

        <button type="button" className="btn-primary w-full" onClick={persist}>
          {saved ? "Saved" : "Save preferences"}
        </button>
      </section>
    </main>
  );
}