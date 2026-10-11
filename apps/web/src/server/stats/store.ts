import type { StatsSummary } from '@/lib/stats-summary';

/**
 * Where anonymous summaries are kept. A record holds the summary and the ISO week it arrived in:
 * no IP address, no exact time, no identifier.
 */
export interface StatsRecord extends StatsSummary {
  receivedWeek: string;
}

export interface StatsStore {
  readonly name: string;
  add(record: StatsRecord): Promise<void>;
}

export class MemoryStatsStore implements StatsStore {
  readonly name = 'memory';
  readonly records: StatsRecord[] = [];
  async add(record: StatsRecord) {
    this.records.push(structuredClone(record));
  }
}

/** ISO 8601 week, e.g. "2026-W41". */
export function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Postgres table public.anon_stats (migration 20261011000001), written with the service role. */
export class SupabaseStatsStore implements StatsStore {
  readonly name = 'supabase';
  constructor(private readonly client: { from: (t: string) => { insert: (row: Record<string, unknown>) => PromiseLike<{ error: unknown }> } }) {}
  async add(r: StatsRecord) {
    const { error } = await this.client.from('anon_stats').insert({
      received_week: r.receivedWeek,
      age_band: r.ageBand,
      stage: r.stage,
      locale: r.locale,
      completion: r.completion,
      top_interests: r.topInterests,
      top_groups: r.topGroups,
      top_values: r.topValues,
      bands: r.bands,
      event_code: r.eventCode,
    });
    if (error) throw new Error('stats_store_failed');
  }
}
