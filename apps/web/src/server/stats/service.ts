import { statsSummarySchema } from '@/lib/stats-summary';

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

/** Accepts one anonymous summary: validates it strictly, rate-limits by IP (in memory only), stores it. */
export class StatsService {
  private limiter: RateLimiter;
  constructor(
    readonly store: StatsStore,
    private readonly now: () => number = Date.now,
    perIpPerHour = 30,
  ) {
    this.limiter = createRateLimiter({ limit: perIpPerHour, windowMs: 60 * 60 * 1000, now: this.now });
  }

  async submit(body: unknown, ip: string): Promise<void> {
    const parsed = statsSummarySchema.safeParse(body);
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
