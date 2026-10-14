import type { GameNorms } from '@/features/games/score';
import type { StatsUpload } from '@/lib/stats-summary';

/**
 * Where anonymous records are kept. A record holds the upload and the ISO week it arrived in:
 * no IP address, no exact time, no identifier.
 */
export type StatsRecord = StatsUpload & { receivedWeek: string };

export interface StatsStore {
  readonly name: string;
  add(record: StatsRecord): Promise<void>;
  /** How many players got each score, per game (current version) and age band, plus everyone. */
  gameNorms(): Promise<GameNorms>;
}

/** Builds the norms from rows of (game, age band, score, players). */
export function normsFrom(rows: { game: string; ageBand: string; score: number; players: number }[]): GameNorms {
  const out: Record<string, Record<string, { n: number; counts: number[] }>> = {};
  for (const r of rows) {
    for (const band of [r.ageBand, 'all']) {
      const h = ((out[r.game] ??= {})[band] ??= { n: 0, counts: [] });
      h.n += r.players;
      while (h.counts.length <= r.score) h.counts.push(0);
      h.counts[r.score]! += r.players;
    }
  }
  return out as GameNorms;
}

export class MemoryStatsStore implements StatsStore {
  readonly name = 'memory';
  readonly records: StatsRecord[] = [];
  async add(record: StatsRecord) {
    this.records.push(structuredClone(record));
  }
  async gameNorms() {
    return normsFrom(
      this.records.flatMap((r) => ('kind' in r && r.kind === 'game' && r.gameVersion === 1 ? [{ game: r.game, ageBand: r.ageBand, score: r.score, players: 1 }] : [])),
    );
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

type Table = {
  insert: (row: Record<string, unknown>) => PromiseLike<{ error: unknown }>;
  select: (cols: string) => PromiseLike<{ data: unknown[] | null; error: unknown }>;
};

/**
 * Postgres tables written with the service role: public.anon_stats (summaries, migration
 * 20261011000001), public.anon_path_checks and public.anon_ratings (migration 20261013000001),
 * public.anon_game_scores and the view public.anon_game_norms (migration 20261015000001).
 */
export class SupabaseStatsStore implements StatsStore {
  readonly name = 'supabase';
  constructor(private readonly client: { from: (t: string) => Table }) {}
  async gameNorms() {
    const { data, error } = await this.client.from('anon_game_norms').select('game, age_band, score, players');
    if (error || !data) throw new Error('stats_norms_failed');
    return normsFrom((data as { game: string; age_band: string; score: number; players: number }[]).map((r) => ({ game: r.game, ageBand: r.age_band, score: r.score, players: r.players })));
  }
  async add(r: StatsRecord) {
    const sender = { received_week: r.receivedWeek, age_band: r.ageBand, stage: r.stage, locale: r.locale, event_code: r.eventCode };
    const [table, row] =
      'kind' in r
        ? r.kind === 'path'
          ? ['anon_path_checks', { ...sender, path_group: r.group, band: r.band }]
          : r.kind === 'game'
            ? ['anon_game_scores', { ...sender, game: r.game, game_version: r.gameVersion, score: r.score }]
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
