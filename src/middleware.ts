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
];

/**
 * Lobby / client surfaces — desktop app only.
 * Phone QR flows (/join, /game, /watch, /handoff, /seat) stay on the web.
 */
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
  "/salon",
  "/kiosk",
  "/challenge",
];

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
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

  if (matchesPrefix(pathname, DESKTOP_ONLY_PREFIXES) && !isDesktopClient(request)) {
    const downloadUrl = new URL("/download", request.url);
    downloadUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(downloadUrl);
  }

  const needsAuth = matchesPrefix(pathname, AUTH_PREFIXES);
  if (!needsAuth) return NextResponse.next();

  const token = request.cookies.get("atelier_session")?.value;
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname + request.nextUrl.search);

  if (!token) {
    return NextResponse.redirect(loginUrl);
  }

  try {
    await jwtVerify(token, secretKey());
    return NextResponse.next();
  } catch {
    const res = NextResponse.redirect(loginUrl);
    res.cookies.set("atelier_session", "", { path: "/", maxAge: 0 });
    return res;
  }
}

export const config = {
  matcher: [
    "/play",
    "/play/:path*",
    "/ai/:path*",
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
  ],
};
