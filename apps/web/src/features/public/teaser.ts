import { instruments } from '@anabokra/content';
import { RIASEC, type LikertItem, type Riasec } from '@anabokra/engine';

/** Items per RIASEC type in the teaser (A3): 2 × 6 = 12 swipes, about 3 minutes. */
export const TEASER_PER_TYPE = 2;
export const TEASER_STORAGE_KEY = 'anabokra.teaser.v1';

/** The first two interest items of each type, interleaved R, I, A, S, E, C, R, I, … */
export const TEASER_ITEMS: LikertItem[] = (() => {
  const byType = RIASEC.map((k) => instruments.interests.items.filter((i) => i.scale === k && !i.attentionCheck).slice(0, TEASER_PER_TYPE));
  const out: LikertItem[] = [];
  for (let n = 0; n < TEASER_PER_TYPE; n++) for (const list of byType) out.push(list[n]!);
  return out;
})();

export type TeaserAnswers = Record<string, number>;

export interface TeaserResult {
  /** 0..1 per type (mean of its answered items on the 1..5 scale); unanswered types are 0.5. */
  scores: Record<Riasec, number>;
  /** The two strongest types, highest first (ties broken by RIASEC order). */
  top: [Riasec, Riasec];
}

export function scoreTeaser(answers: TeaserAnswers): TeaserResult {
  const { min, max } = instruments.interests.responseScale;
  const scores = Object.fromEntries(
    RIASEC.map((k) => {
      const vals = TEASER_ITEMS.filter((i) => i.scale === k)
        .map((i) => answers[i.id])
        .filter((v): v is number => typeof v === 'number');
      return [k, vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length - min) / (max - min) : 0.5];
    }),
  ) as Record<Riasec, number>;
  const ranked = [...RIASEC].sort((a, b) => scores[b] - scores[a] || RIASEC.indexOf(a) - RIASEC.indexOf(b));
  return { scores, top: [ranked[0]!, ranked[1]!] };
}

/** Saved teaser answers survive the signup round-trip in localStorage (never sent before login). */
export function loadTeaserAnswers(storage: Pick<Storage, 'getItem'> | undefined): TeaserAnswers | null {
  try {
    const raw = storage?.getItem(TEASER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const valid = new Set(TEASER_ITEMS.map((i) => i.id));
    const out: TeaserAnswers = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (valid.has(k) && typeof v === 'number' && v >= 1 && v <= 5 && Number.isInteger(v)) out[k] = v;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}
