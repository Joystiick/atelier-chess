import { readSession, type SessionUser } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export async function requireUser(): Promise<
  { user: SessionUser; error?: undefined } | { user?: undefined; error: NextResponse }
> {
  const user = await readSession();
  if (!user) {
    return {
      error: NextResponse.json(
        { error: "Sign in required" },
        { status: 401 },
      ),
    };
  }
  return { user };
}
