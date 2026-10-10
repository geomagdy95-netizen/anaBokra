import { clamp01, mean, normalCdf } from './stats';
import {
  ABILITY_DOMAINS,
  BIG_FIVE,
  RIASEC,
  WORK_VALUES,
  type AbilitiesInstrument,
  type AbilityDomain,
  type BigFive,
  type ItemResponse,
  type LikertInstrument,
  type Norms,
  type Riasec,
  type Scores,
  type ValueBucket,
  type ValuesInstrument,
  type WorkValue,
} from './types';

export interface ScaleScore {
  /** Mean of answered items on the instrument's raw metric (e.g. 1..5), reverse keys applied. */
  raw: number;
  /** Raw mean rescaled to 0..1. */
  normalized: number;
  /** Percentile 0..1 against norms, when norms are supplied. */
  percentile?: number;
  answered: number;
  expected: number;
}

export interface LikertResult {
  instrumentId: string;
  version: string;
  normsVersion?: string;
  scales: Record<string, ScaleScore>;
  complete: boolean;
}

/** Minimum share of a scale's items that must be answered for the scale to be scored. */
const MIN_SCALE_COVERAGE = 0.8;

export function scoreLikert(
  instrument: LikertInstrument,
  responses: ItemResponse[],
  norms?: Norms,
): LikertResult {
  const { min, max } = instrument.responseScale;
  const byItem = new Map(responses.map((r) => [r.itemId, r.value]));
  const scales: Record<string, ScaleScore> = {};
  let complete = true;

  for (const scale of instrument.scales) {
    const items = instrument.items.filter((i) => i.scale === scale.id && !i.attentionCheck);
    const values: number[] = [];
    for (const item of items) {
      const v = byItem.get(item.id);
      if (v === undefined) continue;
      if (v < min || v > max) throw new RangeError(`Response ${v} for ${item.id} outside ${min}..${max}`);
      values.push(item.keyed === -1 ? min + max - v : v);
    }
    if (values.length < items.length) complete = false;
    if (values.length < Math.ceil(items.length * MIN_SCALE_COVERAGE)) continue;

    const raw = mean(values);
    const score: ScaleScore = {
      raw,
      normalized: (raw - min) / (max - min),
      answered: values.length,
      expected: items.length,
    };
    const n = norms?.scales[scale.id];
    if (n && n.sd > 0) score.percentile = normalCdf((raw - n.mean) / n.sd);
    scales[scale.id] = score;
  }

  return {
    instrumentId: instrument.id,
    version: instrument.version,
    normsVersion: norms?.version,
    scales,
    complete,
  };
}

/** Prefer the norm-based percentile; fall back to the normalized raw score until norms exist. */
const best = (s: ScaleScore | undefined) => (s ? (s.percentile ?? s.normalized) : undefined);

function pick<K extends string>(result: LikertResult, keys: readonly K[]): Scores<K> | undefined {
  const out = {} as Scores<K>;
  for (const k of keys) {
    const v = best(result.scales[k]);
    if (v === undefined) return undefined;
    out[k] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Interests
// ---------------------------------------------------------------------------

export interface InterestResult {
  scores: Scores<Riasec>;
  /** Top three letters, highest first (ties broken by RIASEC order). */
  code: string;
  /** Spread between highest and lowest type (0..1); low = undifferentiated profile. */
  differentiation: number;
  /** Holland consistency of the top two types: 3 = adjacent, 2 = alternate, 1 = opposite. */
  consistency: 1 | 2 | 3;
}

export function interestProfile(result: LikertResult): InterestResult | undefined {
  const scores = pick(result, RIASEC);
  if (!scores) return undefined;
  const ranked = [...RIASEC].sort((a, b) => scores[b] - scores[a] || RIASEC.indexOf(a) - RIASEC.indexOf(b));
  const vals = RIASEC.map((k) => scores[k]);
  const dist = Math.abs(RIASEC.indexOf(ranked[0]!) - RIASEC.indexOf(ranked[1]!));
  const hex = Math.min(dist, 6 - dist); // distance on the RIASEC hexagon
  return {
    scores,
    code: ranked.slice(0, 3).join(''),
    differentiation: Math.max(...vals) - Math.min(...vals),
    consistency: hex === 1 ? 3 : hex === 2 ? 2 : 1,
  };
}

// ---------------------------------------------------------------------------
// Personality
// ---------------------------------------------------------------------------

export function personalityProfile(result: LikertResult): Scores<BigFive> | undefined {
  return pick(result, BIG_FIVE);
}

// ---------------------------------------------------------------------------
// Values (card sort)
// ---------------------------------------------------------------------------

export interface ValuesResult {
  scores: Scores<WorkValue>;
  ranking: WorkValue[];
}

/**
 * Each card's bucket weight is averaged per value, then rescaled 0..1.
 * An optional explicit ranking (the final "order your top values" step) overrides ties.
 */
export function scoreValues(
  instrument: ValuesInstrument,
  placements: Record<string, ValueBucket>,
  finalRanking?: WorkValue[],
): ValuesResult | undefined {
  const weights = new Map(instrument.buckets.map((b) => [b.id, b.weight]));
  const lo = Math.min(...weights.values());
  const hi = Math.max(...weights.values());
  const scores = {} as Scores<WorkValue>;

  for (const value of WORK_VALUES) {
    const cards = instrument.cards.filter((c) => c.value === value);
    const ws = cards.map((c) => placements[c.id]).filter((b): b is ValueBucket => !!b).map((b) => weights.get(b)!);
    if (ws.length < cards.length) return undefined;
    scores[value] = hi > lo ? (mean(ws) - lo) / (hi - lo) : 0.5;
  }

  const rankIndex = (v: WorkValue) => {
    const i = finalRanking?.indexOf(v) ?? -1;
    return i === -1 ? Infinity : i;
  };
  const ranking = [...WORK_VALUES].sort(
    (a, b) => rankIndex(a) - rankIndex(b) || scores[b] - scores[a] || WORK_VALUES.indexOf(a) - WORK_VALUES.indexOf(b),
  );
  return { scores, ranking };
}

// ---------------------------------------------------------------------------
// Abilities
// ---------------------------------------------------------------------------

export interface AbilitiesResult {
  scores: Scores<AbilityDomain>;
  /** Which source each domain score came from. */
  basis: Record<AbilityDomain, 'performance+self' | 'self' | 'performance'>;
}

export function scoreAbilities(
  instrument: AbilitiesInstrument,
  selfRatings: ItemResponse[],
  answers: { itemId: string; choice: number | null }[],
  norms?: Norms,
): AbilitiesResult | undefined {
  const { min, max } = instrument.selfRatingScale;
  const self = new Map(selfRatings.map((r) => [r.itemId, r.value]));
  const chosen = new Map(answers.map((a) => [a.itemId, a.choice]));
  const scores = {} as Scores<AbilityDomain>;
  const basis = {} as AbilitiesResult['basis'];

  for (const domain of ABILITY_DOMAINS) {
    const ratings = instrument.selfRatings
      .filter((s) => s.domain === domain)
      .map((s) => self.get(s.id))
      .filter((v): v is number => v !== undefined);
    const selfScore = ratings.length ? (mean(ratings) - min) / (max - min) : undefined;

    const items = instrument.performance.filter((p) => p.domain === domain);
    const attempted = items.filter((p) => chosen.has(p.id));
    let perfScore: number | undefined;
    if (attempted.length) {
      const correct = attempted.filter((p) => chosen.get(p.id) === p.answerIndex).length;
      // Unanswered/skipped items count as incorrect so skipping can't inflate the score.
      const pct = correct / items.length;
      const n = norms?.scales[domain];
      perfScore = n && n.sd > 0 ? normalCdf((pct - n.mean) / n.sd) : pct;
    }

    if (perfScore !== undefined && selfScore !== undefined) {
      const w = instrument.performanceWeight;
      scores[domain] = clamp01(w * perfScore + (1 - w) * selfScore);
      basis[domain] = 'performance+self';
    } else if (perfScore !== undefined) {
      scores[domain] = perfScore;
      basis[domain] = 'performance';
    } else if (selfScore !== undefined) {
      scores[domain] = selfScore;
      basis[domain] = 'self';
    } else {
      return undefined;
    }
  }
  return { scores, basis };
}
