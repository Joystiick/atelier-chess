import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";

/** Auth-gated routes (browser QR join paths stay reachable after login). */
const AUTH_PREFIXES = [
  "/play",
  "/ai",
  "/game",
  "/join",
  "/friends",
  "/profile",
  "/analyze",
  "/ranked",
  "/arena",
  "/clubs",
  "/history",
  "/study",
  "/train",
  "/correspondence",
  "/settings",
  "/puzzle",
  "/puzzles",
  "/salon",
  "/kiosk",
  "/challenge",
  "/handoff",
  "/seat",
  "/watch",
  "/remote",
  "/ghost-league",
];

/**
 * Lobby / client surfaces — desktop app only.
 * Phone QR flows (/join, /game, /watch, /handoff, /seat, /remote, /salon/[slug]) stay on the web.
 * Host create desk (/salon exact) stays desktop-preferred.
 */
const DESKTOP_ONLY_EXACT = ["/salon"];

const DESKTOP_ONLY_PREFIXES = [
  "/play",
  "/ai",
  "/friends",
  "/profile",
  "/analyze",
  "/ranked",
  "/arena",
  "/clubs",
  "/history",
  "/study",
  "/train",
  "/correspondence",
  "/settings",
  "/puzzle",
  "/puzzles",
  "/kiosk",
  "/challenge",
  "/ghost-league",
];

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isKioskJoinPath(pathname: string) {
  return pathname === "/kiosk/join" || pathname.startsWith("/kiosk/join/");
}

function isDesktopOnlyPath(pathname: string) {
  if (isKioskJoinPath(pathname)) return false;
  if (DESKTOP_ONLY_EXACT.includes(pathname)) return true;
  return matchesPrefix(pathname, DESKTOP_ONLY_PREFIXES);
}

function isDesktopClient(request: NextRequest) {
  if (request.headers.get("x-atelier-desktop") === "1") return true;
  if (request.cookies.get("atelier_desktop")?.value === "1") return true;
  const ua = request.headers.get("user-agent") ?? "";
  return /\bElectron\//i.test(ua) || /\bAtelierDesktop\//i.test(ua);
}

function secretKey() {
  const raw =
    process.env.AUTH_SECRET ||
    process.env.PUSHER_SECRET ||
    "atelier-dev-insecure-secret-change-me";
  return new TextEncoder().encode(raw);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isDesktopOnlyPath(pathname) && !isDesktopClient(request)) {
    const downloadUrl = new URL("/download", request.url);
    downloadUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(downloadUrl);
  }

  // Phone QR guest join — no account required for café kiosk seats
  if (isKioskJoinPath(pathname)) {
    return NextResponse.next();
  }

  if (!matchesPrefix(pathname, AUTH_PREFIXES)) {
    return NextResponse.next();
  }

  const token = request.cookies.get("atelier_session")?.value;
  if (!token) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  try {
    await jwtVerify(token, secretKey());
    return NextResponse.next();
  } catch {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    const res = NextResponse.redirect(login);
    res.cookies.delete("atelier_session");
    return res;
  }
}

export const config = {
  matcher: [
    "/play",
    "/play/:path*",
    "/ai",
    "/ai/:path*",
    "/game",
    "/game/:path*",
    "/join",
    "/join/:path*",
    "/friends",
    "/friends/:path*",
    "/profile",
    "/profile/:path*",
    "/analyze",
    "/analyze/:path*",
    "/ranked",
    "/ranked/:path*",
    "/arena",
    "/arena/:path*",
    "/clubs",
    "/clubs/:path*",
    "/history",
    "/history/:path*",
    "/study",
    "/study/:path*",
    "/train",
    "/train/:path*",
    "/correspondence",
    "/correspondence/:path*",
    "/settings",
    "/settings/:path*",
    "/puzzle",
    "/puzzle/:path*",
    "/puzzles",
    "/puzzles/:path*",
    "/salon",
    "/salon/:path*",
    "/kiosk",
    "/kiosk/:path*",
    "/challenge",
    "/challenge/:path*",
    "/handoff",
    "/handoff/:path*",
    "/seat",
    "/seat/:path*",
    "/watch",
    "/watch/:path*",
    "/remote",
    "/remote/:path*",
    "/ghost-league",
    "/ghost-league/:path*",
  ],
};
