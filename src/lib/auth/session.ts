import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "atelier_session";
const WEEK = 60 * 60 * 24 * 7;

function secretKey() {
  const raw =
    process.env.AUTH_SECRET ||
    process.env.PUSHER_SECRET ||
    "atelier-dev-insecure-secret-change-me";
  return new TextEncoder().encode(raw);
}

export type SessionUser = {
  id: string;
  email: string;
  username: string;
  avatarId: string;
  elo: number;
  gamesPlayed: number;
  seasonElo?: number;
  seasonKey?: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function randomToken() {
  return randomBytes(32).toString("hex");
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({
    email: user.email,
    username: user.username,
    avatarId: user.avatarId,
    elo: user.elo,
    gamesPlayed: user.gamesPlayed,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function readSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const id = payload.sub;
    if (!id) return null;
    return {
      id,
      email: String(payload.email ?? ""),
      username: String(payload.username ?? ""),
      avatarId: String(payload.avatarId ?? "knight-brass"),
      elo: Number(payload.elo ?? 1200),
      gamesPlayed: Number(payload.gamesPlayed ?? 0),
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(user: SessionUser) {
  const token = await createSessionToken(user);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: WEEK,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function publicUser(u: {
  id: string;
  email: string;
  username: string;
  avatarId: string;
  elo: number;
  gamesPlayed: number;
  seasonElo?: number;
  seasonKey?: string;
}) {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    avatarId: u.avatarId,
    elo: u.elo,
    gamesPlayed: u.gamesPlayed,
    seasonElo: u.seasonElo ?? 1200,
    seasonKey: u.seasonKey ?? "",
  };
}
