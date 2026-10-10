/**
 * Scores are shown as bands, never raw numbers. Until Egyptian norms exist the bands are cut from the
 * normalized 0..1 score; the labels are all strengths-based (there is no "low" band).
 */
export const BANDS = ['growing', 'balanced', 'strong', 'standout'] as const;
export type Band = (typeof BANDS)[number];

const CUTS = [0.35, 0.6, 0.8] as const;

export function bandOf(score: number): Band {
  const s = Number.isFinite(score) ? score : 0;
  if (s < CUTS[0]) return 'growing';
  if (s < CUTS[1]) return 'balanced';
  if (s < CUTS[2]) return 'strong';
  return 'standout';
}

/** 1..4, for drawing a bar of four segments. */
export const bandLevel = (b: Band): number => BANDS.indexOf(b) + 1;
