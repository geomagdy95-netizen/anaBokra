import type { MinScore } from '@anabokra/content';

/**
 * Feasibility of a program against the student's expected Thanaweya score (percent, 0-100).
 *
 * Only `tansik-phase1-cutoff` entries are cutoffs. `regulatory-minimum` entries (the Ministry floor
 * for private universities) are NEVER used here and never presented as a cutoff.
 *
 * Scales differ by year (410 before 2025, 320 from 2025), so everything is compared as a percentage
 * (`scorePct`, or raw/max when it is missing).
 *
 * delta = expected - latestCutoff, in percentage points:
 *   likely   delta >= LIKELY_MARGIN_PTS
 *   reach    -REACH_BELOW_PTS <= delta < LIKELY_MARGIN_PTS   (borderline: within 2 points below, or less than 2 above)
 *   unlikely delta < -REACH_BELOW_PTS
 */
export const FEASIBILITY = { LIKELY_MARGIN_PTS: 2, REACH_BELOW_PTS: 2 } as const;

export const CUTOFF_KIND = 'tansik-phase1-cutoff';

export type FeasibilityStatus = 'likely' | 'reach' | 'unlikely';
export type FeasibilityUnknown = 'no_score' | 'no_cutoff' | 'track_mismatch';

export interface Cutoff {
  track: string;
  year: number;
  pct: number;
  /** Scale the raw score was out of (410 or 320), when known. */
  max: number | null;
  raw: number | null;
  sourceUrl: string;
}

export type Feasibility =
  | { status: FeasibilityStatus; delta: number; cutoff: Cutoff }
  | { status: 'unknown'; reason: FeasibilityUnknown; cutoff: Cutoff | null };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Percentage of a tansik cutoff row, or null when it cannot be derived. Regulatory minimums return null. */
export function cutoffPct(m: Pick<MinScore, 'kind' | 'scorePct' | 'scoreRaw' | 'scoreMax'>): number | null {
  if (m.kind !== CUTOFF_KIND) return null;
  if (Number.isFinite(m.scorePct)) return m.scorePct;
  if (m.scoreRaw != null && m.scoreMax) return round2((m.scoreRaw / m.scoreMax) * 100);
  return null;
}

/** Latest cutoff per track (tansik cutoffs only). */
export function latestCutoffs(minScores: MinScore[]): Cutoff[] {
  const best = new Map<string, Cutoff>();
  for (const m of minScores) {
    const pct = cutoffPct(m);
    if (pct == null) continue;
    const prev = best.get(m.track);
    if (!prev || m.year > prev.year) {
      best.set(m.track, { track: m.track, year: m.year, pct, max: m.scoreMax ?? null, raw: m.scoreRaw ?? null, sourceUrl: m.sourceUrl });
    }
  }
  return [...best.values()];
}

/** Latest regulatory minimum (display only, always labelled as a minimum, never fed to `assess`). */
export function latestRegulatoryMinimum(minScores: MinScore[]): { year: number; pct: number; sourceUrl: string } | null {
  let best: { year: number; pct: number; sourceUrl: string } | null = null;
  for (const m of minScores) {
    if (m.kind !== 'regulatory-minimum') continue;
    if (!best || m.year > best.year) best = { year: m.year, pct: m.scorePct, sourceUrl: m.sourceUrl };
  }
  return best;
}

export interface FeasibilityUser {
  expectedScorePct?: number | null;
  track?: string | null;
}

/**
 * Pure rule. With a known track the cutoff for that track is used (and a program that does not accept
 * it is `track_mismatch`). Without a track the strictest latest cutoff among the program's tracks is used.
 */
export function assessFeasibility(cutoffs: Cutoff[], acceptedTracks: string[], user: FeasibilityUser): Feasibility {
  const expected = user.expectedScorePct;
  if (expected == null || !Number.isFinite(expected)) return { status: 'unknown', reason: 'no_score', cutoff: null };
  if (user.track && acceptedTracks.length > 0 && !acceptedTracks.includes(user.track)) return { status: 'unknown', reason: 'track_mismatch', cutoff: null };
  const pool = user.track ? cutoffs.filter((c) => c.track === user.track) : cutoffs;
  if (pool.length === 0) return { status: 'unknown', reason: 'no_cutoff', cutoff: null };
  const cutoff = pool.reduce((a, b) => (b.pct > a.pct ? b : a));
  const delta = round2(expected - cutoff.pct);
  const status: FeasibilityStatus = delta >= FEASIBILITY.LIKELY_MARGIN_PTS ? 'likely' : delta >= -FEASIBILITY.REACH_BELOW_PTS ? 'reach' : 'unlikely';
  return { status, delta, cutoff };
}
