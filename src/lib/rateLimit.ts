const buckets = new Map<string, { count: number; reset: number }>();

/** Simple in-memory rate limit (best-effort on serverless). */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || now > cur.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true };
  }
  if (cur.count >= limit) {
    return { ok: false, retryAfterMs: cur.reset - now };
  }
  cur.count += 1;
  return { ok: true };
}

export function clientKey(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anon"
  );
}
