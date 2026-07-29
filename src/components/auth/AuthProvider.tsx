"use client";

import { avatarEmoji } from "@/lib/auth/avatars";
import { NotificationBell } from "@/components/ui/NotificationBell";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  avatarId: string;
  elo: number;
  gamesPlayed: number;
  seasonElo?: number;
  seasonKey?: string;
};

type AuthCtx = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, refresh, logout }),
    [user, loading, refresh, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}

export function UserChip() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) {
    return (
      <a href="/login?next=%2Fplay" className="chip inline-flex items-center gap-1">
        Sign in
      </a>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <NotificationBell />
      <a href="/profile" className="chip inline-flex items-center gap-2">
        <span aria-hidden>{avatarEmoji(user.avatarId)}</span>
        <span>{user.username}</span>
        <span className="text-[var(--brass)]">{user.elo}</span>
      </a>
    </span>
  );
}
