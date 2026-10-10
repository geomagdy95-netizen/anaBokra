/**
 * Sliding-window rate limiter.
 *
 * The default store is in-memory (per Node process), which is correct for a single
 * self-hosted instance. For multiple replicas, implement `RateLimitStore` on Redis/Postgres.
 */

export interface RateLimitStore {
  /**
   * Atomically record a hit for `key` unless `limit` hits already happened inside the window.
   * Returns the hit timestamps in the window (oldest first), including the new one if accepted.
   */
  tryHit(
    key: string,
    now: number,
    windowMs: number,
    limit: number,
  ): { accepted: boolean; times: number[] } | Promise<{ accepted: boolean; times: number[] }>;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly hits = new Map<string, number[]>();
  private lastSweep = 0;

  tryHit(key: string, now: number, windowMs: number, limit: number) {
    const times = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    const accepted = times.length < limit;
    if (accepted) times.push(now);
    this.hits.set(key, times);
    this.sweep(now, windowMs);
    return { accepted, times };
  }

  /** Drop idle keys now and then so memory stays bounded. */
  private sweep(now: number, windowMs: number): void {
    if (now - this.lastSweep < windowMs) return;
    this.lastSweep = now;
    for (const [k, v] of this.hits) {
      if (v.length === 0 || now - v[v.length - 1]! >= windowMs) this.hits.delete(k);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until another attempt would be allowed (0 when allowed). */
  retryAfterSec: number;
}

export interface RateLimiter {
  /** Counts the attempt. Rejected attempts do not extend the window. */
  consume(key: string): Promise<RateLimitResult>;
}

export function createRateLimiter(opts: {
  limit: number;
  windowMs: number;
  store?: RateLimitStore;
  now?: () => number;
}): RateLimiter {
  const store = opts.store ?? new MemoryRateLimitStore();
  const now = opts.now ?? Date.now;
  return {
    async consume(key) {
      const t = now();
      const { accepted, times } = await store.tryHit(key, t, opts.windowMs, opts.limit);
      if (accepted) return { allowed: true, remaining: opts.limit - times.length, retryAfterSec: 0 };
      // The slot frees when the oldest hit in the window expires.
      const oldest = times[0] ?? t;
      return { allowed: false, remaining: 0, retryAfterSec: Math.max(1, Math.ceil((oldest + opts.windowMs - t) / 1000)) };
    },
  };
}
