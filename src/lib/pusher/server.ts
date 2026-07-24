import Pusher from "pusher";

let pusher: Pusher | null = null;

export function getPusher(): Pusher {
  if (pusher) return pusher;
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;
  if (!appId || !key || !secret || !cluster) {
    throw new Error("Pusher server env vars are not set");
  }
  pusher = new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });
  return pusher;
}

export function gameChannel(code: string) {
  return `private-game-${code}`;
}
