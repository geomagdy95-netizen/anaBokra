/**
 * Sliding-window rate limiter.
 *
 * The default store is in-memory (per Node process), which is correct for a single
 * self-hosted instance. For multiple replicas, implement `RateLimitStore` on Redis/Postgres.
 */

export interface RateLimitStore {
  /** Record a hit for `key` and return the hit timestamps still inside the window (including this one). */
  hit(key: string, now: number, windowMs: number): number[] | Promise<number[]>;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly hits = new Map<string, number[]>();
  private lastSweep = 0;

  hit(key: string, now: number, windowMs: number): number[] {
    const fresh = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    fresh.push(now);
    this.hits.set(key, fresh);
    this.sweep(now, windowMs);
    return fresh;
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
      const times = await store.hit(key, t, opts.windowMs);
      if (times.length <= opts.limit) {
        return { allowed: true, remaining: opts.limit - times.length, retryAfterSec: 0 };
      }
      // Over the limit: this hit must not count, so remove it again.
      times.pop();
      const oldestBlocking = times[times.length - opts.limit] ?? t;
      return {
        allowed: false,
        remaining: 0,
        retryAfterSec: Math.max(1, Math.ceil((oldestBlocking + opts.windowMs - t) / 1000)),
      };
    },
  };
}
