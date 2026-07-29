"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { startVisibilityAwareInterval } from "@/lib/poll";
import { getPusherClient } from "@/lib/pusher/client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

const NOTIFY_POLL_MS = 90_000;

type Note = {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;
};

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Note[]>([]);
  const root = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      if (!res.ok) return;
      setUnread(data.unreadCount ?? 0);
      setItems(data.notifications ?? []);
    } catch {
      // optional
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    let channel: ReturnType<ReturnType<typeof getPusherClient>["subscribe"]> | null =
      null;
    try {
      const pusher = getPusherClient();
      channel = pusher.subscribe(`private-user-${user.id}`);
      channel.bind("notify", () => void refresh());
      channel.bind("queue.match", () => void refresh());
      channel.bind("arena.pair", () => void refresh());
    } catch {
      // polling fallback
    }
    const stopPoll = startVisibilityAwareInterval(
      () => void refresh(),
      NOTIFY_POLL_MS,
    );
    return () => {
      stopPoll();
      if (channel) {
        channel.unbind_all();
        try {
          getPusherClient().unsubscribe(`private-user-${user.id}`);
        } catch {
          // ignore
        }
      }
    };
  }, [user, refresh]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!user) return null;

  const markAll = async () => {
    await fetch("/api/notifications", { method: "POST" });
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="relative" ref={root}>
      <button
        type="button"
        className="chip relative inline-flex items-center gap-1"
        aria-label="Notifications"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void refresh();
        }}
      >
        <span aria-hidden>◎</span>
        {unread > 0 && (
          <span className="min-w-[1.1rem] rounded-full bg-[var(--brass)] px-1 text-center text-[10px] font-semibold text-[var(--ink)]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-[var(--brass-dim)] bg-[var(--panel)] p-2 shadow-xl backdrop-blur">
          <div className="mb-1 flex items-center justify-between px-1">
            <p className="text-xs uppercase tracking-wide text-[var(--mist)]">
              Notices
            </p>
            {unread > 0 && (
              <button
                type="button"
                className="text-xs text-[var(--brass)] hover:underline"
                onClick={() => void markAll()}
              >
                Mark read
              </button>
            )}
          </div>
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {items.length === 0 && (
              <li className="px-2 py-3 text-sm text-[var(--mist)]">
                Quiet for now.
              </li>
            )}
            {items.map((n) => {
              const inner = (
                <>
                  <p
                    className={`text-sm ${n.read ? "text-[var(--mist)]" : "text-[var(--cream)]"}`}
                  >
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="text-xs text-[var(--mist)]">{n.body}</p>
                  )}
                </>
              );
              return (
                <li key={n.id}>
                  {n.href ? (
                    <Link
                      href={n.href}
                      className="block rounded-lg px-2 py-1.5 hover:bg-black/30"
                      onClick={() => setOpen(false)}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="rounded-lg px-2 py-1.5">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
