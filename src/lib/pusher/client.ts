"use client";

import PusherClient from "pusher-js";

let client: PusherClient | null = null;

export function getPusherClient(): PusherClient {
  if (client) return client;
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  if (!key || !cluster) {
    throw new Error("Pusher client env vars are not set");
  }
  client = new PusherClient(key, {
    cluster,
    authEndpoint: "/api/pusher/auth",
  });
  return client;
}
