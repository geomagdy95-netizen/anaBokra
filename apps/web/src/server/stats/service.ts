import type { GameNorms } from '@/features/games/score';
import { statsUploadSchema } from '@/lib/stats-summary';

import { createRateLimiter, type RateLimiter } from '../rate-limit';
import { isoWeek, MemoryStatsStore, type StatsStore } from './store';

export type StatsError = 'invalid' | 'rate_limited' | 'store_failed';

export class StatsFailure extends Error {
  constructor(
    readonly code: StatsError,
    readonly retryAfterSec?: number,
  ) {
    super(code);
  }
}

/**
 * Accepts one anonymous record (summary, checked path or results rating): validates it strictly,
 * rate-limits by IP (in memory only), stores it.
 */
export class StatsService {
  private limiter: RateLimiter;
  constructor(
    readonly store: StatsStore,
    private readonly now: () => number = Date.now,
    // A whole session can share one university IP, and each person sends a few records.
    perIpPerHour = 300,
  ) {
    this.limiter = createRateLimiter({ limit: perIpPerHour, windowMs: 60 * 60 * 1000, now: this.now });
  }

  /** The score spread per game, for comparisons; cached for an hour (it changes slowly). */
  private normsCache: { at: number; norms: GameNorms } | null = null;
  async norms(): Promise<GameNorms> {
    if (this.normsCache && this.now() - this.normsCache.at < 60 * 60 * 1000) return this.normsCache.norms;
    const norms = await this.store.gameNorms();
    this.normsCache = { at: this.now(), norms };
    return norms;
  }

  async submit(body: unknown, ip: string): Promise<void> {
    const parsed = statsUploadSchema.safeParse(body);
    if (!parsed.success) throw new StatsFailure('invalid');
    const limit = await this.limiter.consume(`ip:${ip}`);
    if (!limit.allowed) throw new StatsFailure('rate_limited', limit.retryAfterSec);
    try {
      await this.store.add({ ...parsed.data, receivedWeek: isoWeek(new Date(this.now())) });
    } catch {
      throw new StatsFailure('store_failed');
    }
  }
}

const g = globalThis as typeof globalThis & { __statsService?: StatsService };

/** Supabase when the service-role key is configured, otherwise memory (development). */
export async function getStatsService(): Promise<StatsService> {
  if (!g.__statsService) {
    let store: StatsStore = new MemoryStatsStore();
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const [{ createAdminClient }, { SupabaseStatsStore }] = await Promise.all([import('../supabase-admin'), import('./store')]);
      store = new SupabaseStatsStore(createAdminClient());
    }
    g.__statsService = new StatsService(store);
  }
  return g.__statsService;
}
