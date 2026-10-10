import { cronbachAlpha, type LikertInstrument } from '@anabokra/engine';

import type { ResponseSample } from './types';

export interface ItemStats {
  itemId: string;
  scale: string | null;
  keyed: 1 | -1;
  attentionCheck: boolean;
  /** Answers saved for this item. */
  n: number;
  /** Share of sessions that reached the instrument but have no answer for this item (0..1). */
  missing: number;
  mean: number | null;
  sd: number | null;
  /** Count per response option, index 0 = scale minimum. */
  distribution: number[];
  medianMs: number | null;
  /** Corrected item–total correlation within its scale (complete cases), when computable. */
  itemTotal: number | null;
  /** Attention checks: share answering the expected value. */
  passRate: number | null;
}

export interface ScaleStats {
  scale: string;
  items: number;
  /** Sessions that answered every item of the scale. */
  completeCases: number;
  alpha: number | null;
}

export interface InstrumentStats {
  instrumentId: string;
  sessions: number;
  items: ItemStats[];
  scales: ScaleStats[];
}

/** Below this many complete cases, reliability is too noisy to show. */
export const MIN_CASES_FOR_ALPHA = 30;

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => {
  if (xs.length < 2) return null;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
};
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

function pearson(a: number[], b: number[]): number | null {
  if (a.length < 3) return null;
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]! - ma;
    const y = b[i]! - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : null;
}

/**
 * Item and scale statistics for one Likert instrument: answer distributions, missingness, timing,
 * reverse-key-aware item–total correlations and Cronbach's alpha per scale.
 */
export function instrumentStats(instrument: LikertInstrument, samples: ResponseSample[]): InstrumentStats {
  const { min, max } = instrument.responseScale;
  const options = max - min + 1;
  const bySession = new Map<string, Map<string, ResponseSample>>();
  for (const s of samples) {
    let m = bySession.get(s.sessionId);
    if (!m) bySession.set(s.sessionId, (m = new Map()));
    m.set(s.itemId, s);
  }
  const sessions = [...bySession.values()];
  const keyedValue = (itemKeyed: 1 | -1, v: number) => (itemKeyed === -1 ? min + max - v : v);

  const scales: ScaleStats[] = [];
  const itemTotals = new Map<string, number | null>();
  for (const scale of instrument.scales) {
    const items = instrument.items.filter((i) => i.scale === scale.id && !i.attentionCheck);
    const matrix: number[][] = [];
    for (const answers of sessions) {
      const row = items.map((i) => answers.get(i.id)?.value);
      if (row.every((v): v is number => v !== undefined)) matrix.push(row.map((v, j) => keyedValue(items[j]!.keyed ?? 1, v)));
    }
    const enough = matrix.length >= MIN_CASES_FOR_ALPHA;
    scales.push({ scale: scale.id, items: items.length, completeCases: matrix.length, alpha: enough ? cronbachAlpha(matrix) : null });
    items.forEach((item, j) => {
      if (!enough) return itemTotals.set(item.id, null);
      const own = matrix.map((r) => r[j]!);
      const rest = matrix.map((r) => r.reduce((a, b) => a + b, 0) - r[j]!);
      itemTotals.set(item.id, pearson(own, rest));
    });
  }

  const items: ItemStats[] = instrument.items.map((item) => {
    const answers = sessions.map((s) => s.get(item.id)).filter((a): a is ResponseSample => !!a);
    const values = answers.map((a) => a.value);
    const distribution = Array.from({ length: options }, () => 0);
    for (const v of values) {
      const idx = Math.round(v) - min;
      if (idx >= 0 && idx < options) distribution[idx]! += 1;
    }
    const times = answers.map((a) => a.ms).filter((ms): ms is number => typeof ms === 'number');
    return {
      itemId: item.id,
      scale: item.scale ?? null,
      keyed: item.keyed ?? 1,
      attentionCheck: !!item.attentionCheck,
      n: values.length,
      missing: sessions.length ? 1 - values.length / sessions.length : 0,
      mean: values.length ? mean(values) : null,
      sd: sd(values),
      distribution,
      medianMs: times.length ? median(times) : null,
      itemTotal: itemTotals.get(item.id) ?? null,
      passRate: item.attentionCheck && values.length ? values.filter((v) => v === item.attentionCheck!.expected).length / values.length : null,
    };
  });

  return { instrumentId: instrument.id, sessions: sessions.length, items, scales };
}

/** Items worth a closer look by the psychologist. */
export function flagItem(s: ItemStats): string[] {
  const flags: string[] = [];
  if (s.attentionCheck) {
    if (s.passRate !== null && s.passRate < 0.85) flags.push('lowPassRate');
    return flags;
  }
  if (s.itemTotal !== null && s.itemTotal < 0.2) flags.push('weakItem');
  if (s.missing > 0.1) flags.push('oftenSkipped');
  if (s.sd !== null && s.sd < 0.6) flags.push('lowSpread');
  if (s.n > 0 && Math.max(...s.distribution) / s.n > 0.6) flags.push('ceilingOrFloor');
  return flags;
}
