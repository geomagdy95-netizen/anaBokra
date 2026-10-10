import type { ValuesPayload } from './types';

/** card id -> weight of the bucket it sits in (the value that is stored). */
export type Placements = Record<string, number>;

export const TOP_VALUES = 3;

type Bucket = ValuesPayload['buckets'][number];

export const bucketOfWeight = (buckets: Bucket[], weight: number) => buckets.find((b) => b.weight === weight);

export function countIn(placements: Placements, weight: number): number {
  let n = 0;
  for (const w of Object.values(placements)) if (w === weight) n++;
  return n;
}

export type AssignResult = { ok: true; placements: Placements } | { ok: false; reason: 'limit'; limit: number } | { ok: false; reason: 'unknown_bucket' };

/**
 * Put a card in a bucket. A bucket with a `limit` ("must have": 7) rejects the card when it is
 * already full; moving a card within its own bucket is always fine. The server enforces the same
 * limit (values_limit_exceeded); this keeps the UI from ever sending a rejected batch.
 */
export function assignCard(placements: Placements, cardId: string, weight: number, buckets: Bucket[]): AssignResult {
  const bucket = bucketOfWeight(buckets, weight);
  if (!bucket) return { ok: false, reason: 'unknown_bucket' };
  if (bucket.limit !== undefined && placements[cardId] !== weight && countIn(placements, weight) >= bucket.limit)
    return { ok: false, reason: 'limit', limit: bucket.limit };
  return { ok: true, placements: { ...placements, [cardId]: weight } };
}

/** Work values ordered by how many of their cards were "must have" (ties keep the given order). */
export function orderWorkValues(payload: ValuesPayload, placements: Placements): string[] {
  const must = payload.buckets.find((b) => b.limit !== undefined) ?? payload.buckets[0]!;
  const score = (v: string) => payload.cards.filter((c) => c.value === v && placements[c.id] === must.weight).length;
  return [...payload.workValues].sort((a, b) => score(b) - score(a) || payload.workValues.indexOf(a) - payload.workValues.indexOf(b));
}

/** Toggle a value in the top list: add at the end (up to `max`), or remove it. */
export function toggleTop(top: string[], value: string, max: number = TOP_VALUES): string[] {
  if (top.includes(value)) return top.filter((v) => v !== value);
  return top.length >= max ? top : [...top, value];
}

export function moveTop(top: string[], value: string, delta: -1 | 1): string[] {
  const i = top.indexOf(value);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= top.length) return top;
  const out = [...top];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}
