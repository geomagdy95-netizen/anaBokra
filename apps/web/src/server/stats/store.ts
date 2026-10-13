import type { StatsUpload } from '@/lib/stats-summary';

/**
 * Where anonymous records are kept. A record holds the upload and the ISO week it arrived in:
 * no IP address, no exact time, no identifier.
 */
export type StatsRecord = StatsUpload & { receivedWeek: string };

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

/**
 * Postgres tables written with the service role: public.anon_stats (summaries, migration
 * 20261011000001), public.anon_path_checks and public.anon_ratings (migration 20261013000001).
 */
export class SupabaseStatsStore implements StatsStore {
  readonly name = 'supabase';
  constructor(private readonly client: { from: (t: string) => { insert: (row: Record<string, unknown>) => PromiseLike<{ error: unknown }> } }) {}
  async add(r: StatsRecord) {
    const sender = { received_week: r.receivedWeek, age_band: r.ageBand, stage: r.stage, locale: r.locale, event_code: r.eventCode };
    const [table, row] =
      'kind' in r
        ? r.kind === 'path'
          ? ['anon_path_checks', { ...sender, path_group: r.group, band: r.band }]
          : ['anon_ratings', { ...sender, rating: r.rating }]
        : [
            'anon_stats',
            {
              ...sender,
              completion: r.completion,
              top_interests: r.topInterests,
              top_groups: r.topGroups,
              top_values: r.topValues,
              bands: r.bands,
            },
          ];
    const { error } = await this.client.from(table).insert(row);
    if (error) throw new Error('stats_store_failed');
  }
}
