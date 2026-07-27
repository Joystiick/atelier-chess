"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { getPusherClient } from "@/lib/pusher/client";
import { useCallback, useEffect, useState } from "react";

export type FriendUser = {
  id: string;
  username: string;
  avatarId: string;
  avatar: string;
  elo: number;
  presence?: string;
  lastSeenAt?: string;
  activeGameCode?: string | null;
  spectateHref?: string | null;
};

export type GameInviteRow = {
  id: string;
  code: string;
  from: FriendUser | null;
};

export function useFriendsFeed() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [incoming, setIncoming] = useState<
    { friendshipId: string; user: FriendUser }[]
  >([]);
  const [outgoing, setOutgoing] = useState<
    { friendshipId: string; user: FriendUser }[]
  >([]);
  const [invites, setInvites] = useState<GameInviteRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const [fRes, iRes] = await Promise.all([
        fetch("/api/friends"),
        fetch("/api/friends/invite"),
      ]);
      const fData = await fRes.json();
      const iData = await iRes.json();
      if (fRes.ok) {
        setFriends(fData.friends ?? []);
        setIncoming(fData.incoming ?? []);
        setOutgoing(fData.outgoing ?? []);
      }
      if (iRes.ok) setInvites(iData.invites ?? []);
    } finally {
      setLoading(false);
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
      channel.bind("friend.request", () => void refresh());
      channel.bind("friend.accepted", () => void refresh());
      channel.bind("game.invite", () => void refresh());
    } catch {
      // polling fallback
    }
    const poll = window.setInterval(() => void refresh(), 20000);
    return () => {
      window.clearInterval(poll);
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

  return {
    friends,
    incoming,
    outgoing,
    invites,
    loading,
    refresh,
  };
}
