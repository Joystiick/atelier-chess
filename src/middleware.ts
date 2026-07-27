import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";

  const PROTECTED_PREFIXES = [
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
  "/puzzles",
];

function secretKey() {
  const raw =
    process.env.AUTH_SECRET ||
    process.env.PUSHER_SECRET ||
    "atelier-dev-insecure-secret-change-me";
  return new TextEncoder().encode(raw);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
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
    "/puzzles",
    "/puzzles/:path*",
  ],
};
