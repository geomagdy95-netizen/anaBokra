import type { GameNorms } from '@/features/games/score';
import type { StatsUpload } from '@/lib/stats-summary';

/**
 * Where anonymous records are kept. A record holds the upload and the ISO week it arrived in:
 * no IP address, no exact time, no identifier.
 */
export type StatsRecord = StatsUpload & { receivedWeek: string };

/** What the admin Insights page shows: totals only, plus the latest feedback. */
export interface Insights {
  /** Finished results (summaries). */
  results: number;
  /** Phones that reached each milestone, keyed "step" or "discover_task:n". */
  steps: Record<string, number>;
  /** Career pages opened, most viewed first. */
  views: { career: string; n: number }[];
  /** Checked paths per field and band. */
  paths: Record<string, Partial<Record<'fitsWell' | 'fitsPartly' | 'rethink', number>>>;
  /** Results ratings: count of 1s … 5s. */
  ratings: [number, number, number, number, number];
  /** Map and page actions, summed. */
  usage: Record<string, number>;
  feedback: { count: number; liked: Record<string, number>; confusing: Record<string, number>; ratings: [number, number, number, number, number]; latest: FeedbackRow[] };
}

export interface FeedbackRow {
  week: string;
  screen: string;
  career: string | null;
  rating: number | null;
  liked: string[];
  confusing: string[];
  text: string | null;
  locale: string;
  ageBand: string;
}

/** Totals from plain rows (shared by both stores). Pure. */
export function insightsFrom(rows: {
  results: number;
  steps: { step: string; n: number | null }[];
  views: { career: string }[];
  paths: { group: string; band: string }[];
  ratings: { rating: number }[];
  usage: { counts: Record<string, number> }[];
  feedback: FeedbackRow[];
}): Insights {
  const steps: Record<string, number> = {};
  for (const r of rows.steps) {
    const key = r.step === 'discover_task' && r.n ? `discover_task:${r.n}` : r.step;
    steps[key] = (steps[key] ?? 0) + 1;
  }
  const viewCounts = new Map<string, number>();
  for (const v of rows.views) viewCounts.set(v.career, (viewCounts.get(v.career) ?? 0) + 1);
  const paths: Insights['paths'] = {};
  for (const p of rows.paths) {
    const g = (paths[p.group] ??= {});
    const band = p.band as 'fitsWell' | 'fitsPartly' | 'rethink';
    g[band] = (g[band] ?? 0) + 1;
  }
  const five = (): [number, number, number, number, number] => [0, 0, 0, 0, 0];
  const ratings = five();
  for (const r of rows.ratings) if (r.rating >= 1 && r.rating <= 5) ratings[r.rating - 1]! += 1;
  const usage: Record<string, number> = {};
  for (const u of rows.usage) for (const [k, n] of Object.entries(u.counts)) usage[k] = (usage[k] ?? 0) + n;
  const liked: Record<string, number> = {};
  const confusing: Record<string, number> = {};
  const fbRatings = five();
  for (const f of rows.feedback) {
    for (const k of f.liked) liked[k] = (liked[k] ?? 0) + 1;
    for (const k of f.confusing) confusing[k] = (confusing[k] ?? 0) + 1;
    if (f.rating) fbRatings[f.rating - 1]! += 1;
  }
  return {
    results: rows.results,
    steps,
    views: [...viewCounts].map(([career, n]) => ({ career, n })).sort((a, b) => b.n - a.n),
    paths,
    ratings,
    usage,
    feedback: { count: rows.feedback.length, liked, confusing, ratings: fbRatings, latest: [...rows.feedback].sort((a, b) => b.week.localeCompare(a.week)).slice(0, 50) },
  };
}

export interface StatsStore {
  readonly name: string;
  add(record: StatsRecord): Promise<void>;
  /** Totals for the admin Insights page, optionally for one session code. */
  insights(eventCode?: string | null): Promise<Insights>;
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
  async insights(eventCode?: string | null) {
    const rs = this.records.filter((r) => !eventCode || r.eventCode === eventCode);
    const of = <K extends string>(kind: K) => rs.filter((r): r is Extract<StatsRecord, { kind: K }> => 'kind' in r && r.kind === kind);
    return insightsFrom({
      results: rs.filter((r) => !('kind' in r)).length,
      steps: of('step').map((r) => ({ step: r.step, n: r.n })),
      views: of('view').map((r) => ({ career: r.career })),
      paths: of('path').map((r) => ({ group: r.group, band: r.band })),
      ratings: of('rating').map((r) => ({ rating: r.rating })),
      usage: of('usage').map((r) => ({ counts: r.counts as Record<string, number> })),
      feedback: of('feedback').map((r) => ({ week: r.receivedWeek, screen: r.screen, career: r.career, rating: r.rating, liked: r.liked, confusing: r.confusing, text: r.text, locale: r.locale, ageBand: r.ageBand })),
    });
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

type Rows = PromiseLike<{ data: unknown[] | null; error: unknown }> & { eq: (col: string, v: string) => PromiseLike<{ data: unknown[] | null; error: unknown }> };
type Table = {
  insert: (row: Record<string, unknown>) => PromiseLike<{ error: unknown }>;
  select: (cols: string) => Rows;
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
  async insights(eventCode?: string | null) {
    const read = async <T,>(table: string, cols: string): Promise<T[]> => {
      const q = this.client.from(table).select(cols);
      const { data, error } = await (eventCode ? q.eq('event_code', eventCode) : q);
      if (error || !data) throw new Error('stats_insights_failed');
      return data as T[];
    };
    const [results, steps, views, paths, ratings, usage, feedback] = await Promise.all([
      read<{ id: number }>('anon_stats', 'id'),
      read<{ step: string; n: number | null }>('anon_steps', 'step, n'),
      read<{ career: string }>('anon_career_views', 'career'),
      read<{ path_group: string; band: string }>('anon_path_checks', 'path_group, band'),
      read<{ rating: number }>('anon_ratings', 'rating'),
      read<{ counts: Record<string, number> }>('anon_usage', 'counts'),
      read<{ received_week: string; screen: string; career: string | null; rating: number | null; liked: string[]; confusing: string[]; text: string | null; locale: string; age_band: string }>(
        'anon_feedback',
        'received_week, screen, career, rating, liked, confusing, text, locale, age_band',
      ),
    ]);
    return insightsFrom({
      results: results.length,
      steps,
      views,
      paths: paths.map((p) => ({ group: p.path_group, band: p.band })),
      ratings,
      usage,
      feedback: feedback.map((f) => ({ week: f.received_week, screen: f.screen, career: f.career, rating: f.rating, liked: f.liked, confusing: f.confusing, text: f.text, locale: f.locale, ageBand: f.age_band })),
    });
  }

  async add(r: StatsRecord) {
    const sender = { received_week: r.receivedWeek, age_band: r.ageBand, stage: r.stage, locale: r.locale, event_code: r.eventCode };
    const [table, row]: [string, Record<string, unknown>] =
      'kind' in r
        ? r.kind === 'path'
          ? ['anon_path_checks', { ...sender, path_group: r.group, band: r.band }]
          : r.kind === 'game'
            ? ['anon_game_scores', { ...sender, game: r.game, game_version: r.gameVersion, score: r.score }]
            : r.kind === 'step'
              ? ['anon_steps', { ...sender, step: r.step, n: r.n, path_group: r.group, career: r.career }]
              : r.kind === 'view'
                ? ['anon_career_views', { ...sender, career: r.career }]
                : r.kind === 'usage'
                  ? ['anon_usage', { ...sender, counts: r.counts }]
                  : r.kind === 'feedback'
                    ? ['anon_feedback', { ...sender, screen: r.screen, career: r.career, rating: r.rating, liked: r.liked, confusing: r.confusing, text: r.text }]
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
