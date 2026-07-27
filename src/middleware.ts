import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/play", "/ai", "/game", "/friends", "/profile", "/analyze"];

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
    "/play/:path*",
    "/ai/:path*",
    "/game/:path*",
    "/friends/:path*",
    "/profile/:path*",
    "/analyze/:path*",
  ],
};
