/** D8: a neutral micro-insight appears every 8 to 10 answered items. Gaps cycle through this pattern (deterministic, so resume does not reshuffle). */
export const INSIGHT_GAPS = [9, 8, 10] as const;
/** No insight within this many items of the end of a station (finishing is its own moment). */
const QUIET_TAIL = 2;

/** Answered-item counts (1-based) after which an insight is due, for a station with `total` items. */
export function insightPoints(total: number): number[] {
  const out: number[] = [];
  let at = 0;
  for (let i = 0; ; i++) {
    at += INSIGHT_GAPS[i % INSIGHT_GAPS.length]!;
    if (at > total - QUIET_TAIL) break;
    out.push(at);
  }
  return out;
}

/** Index into the message pool for the n-th insight of a station, or null when none is due at this count. */
export function insightFor(answeredCount: number, total: number): number | null {
  const i = insightPoints(total).indexOf(answeredCount);
  return i < 0 ? null : i;
}
