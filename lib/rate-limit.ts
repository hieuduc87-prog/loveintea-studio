import { NextRequest, NextResponse } from 'next/server';

/**
 * Lightweight in-memory rate limiter (sliding window, single-container).
 *
 * The app runs as ONE Docker container (Hetzner), so a process-local Map is a
 * correct enough limiter for brute-force + cost-abuse protection. It resets on
 * restart and does NOT coordinate across replicas — if this ever scales
 * horizontally, back it with Redis. It is a throttle, not an accounting ledger.
 */

type Hit = { count: number; resetAt: number };
const buckets = new Map<string, Hit>();

// Opportunistic cleanup so the Map can't grow unbounded.
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
}

/** Core check. `key` must already be namespaced (e.g. `login:<ip>`). */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const cur = buckets.get(key);
  if (!cur || cur.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt, retryAfterSec: 0 };
  }
  cur.count += 1;
  const ok = cur.count <= limit;
  return {
    ok,
    remaining: Math.max(0, limit - cur.count),
    resetAt: cur.resetAt,
    retryAfterSec: ok ? 0 : Math.ceil((cur.resetAt - now) / 1000),
  };
}

/** Best-effort client IP from proxy headers (Cloudflare / nginx in front). */
export function clientIp(req: NextRequest | Request): string {
  const h = (req as NextRequest).headers ?? (req as Request).headers;
  return (
    h.get('cf-connecting-ip') ||
    h.get('x-real-ip') ||
    (h.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown'
  );
}

/**
 * Guard for API routes. Returns a 429 NextResponse when over the limit, else null.
 *   const limited = enforceRateLimit(req, { scope: 'ai:image', limit: 30, windowMs: 60_000 });
 *   if (limited) return limited;
 */
export function enforceRateLimit(
  req: NextRequest,
  opts: { scope: string; limit: number; windowMs: number; key?: string }
): NextResponse | null {
  const id = opts.key || clientIp(req);
  const res = rateLimit(`${opts.scope}:${id}`, opts.limit, opts.windowMs);
  if (res.ok) return null;
  return NextResponse.json(
    { error: 'Quá nhiều yêu cầu — vui lòng thử lại sau.' },
    { status: 429, headers: { 'Retry-After': String(res.retryAfterSec) } }
  );
}
