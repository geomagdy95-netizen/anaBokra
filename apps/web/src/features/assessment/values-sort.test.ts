import { describe, expect, it } from 'vitest';

import { assignCard, countIn, moveTop, toggleTop } from './values-sort';

const buckets = [
  { id: 'must', name: { en: 'Must', ar: 'لازم' }, weight: 3, limit: 7 },
  { id: 'nice', name: { en: 'Nice', ar: 'كويس' }, weight: 2 },
  { id: 'no', name: { en: 'No', ar: 'لا' }, weight: 1 },
];

describe('value cards "must have" limit', () => {
  it('accepts up to 7 and rejects the 8th', () => {
    let p: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const r = assignCard(p, `c${i}`, 3, buckets);
      expect(r.ok).toBe(true);
      if (r.ok) p = r.placements;
    }
    expect(countIn(p, 3)).toBe(7);
    const r8 = assignCard(p, 'c7', 3, buckets);
    expect(r8).toEqual({ ok: false, reason: 'limit', limit: 7 });
  });

  it('allows re-placing a card already in the full bucket and moving one out', () => {
    let p: Record<string, number> = {};
    for (let i = 0; i < 7; i++) p = (assignCard(p, `c${i}`, 3, buckets) as { placements: Record<string, number> }).placements;
    expect(assignCard(p, 'c0', 3, buckets).ok).toBe(true);
    const moved = assignCard(p, 'c0', 2, buckets);
    expect(moved.ok).toBe(true);
    if (moved.ok) expect(assignCard(moved.placements, 'c9', 3, buckets).ok).toBe(true);
  });

  it('does not limit unlimited buckets and rejects unknown ones', () => {
    let p: Record<string, number> = {};
    for (let i = 0; i < 15; i++) p = (assignCard(p, `c${i}`, 1, buckets) as { placements: Record<string, number> }).placements;
    expect(countIn(p, 1)).toBe(15);
    expect(assignCard(p, 'x', 9, buckets)).toEqual({ ok: false, reason: 'unknown_bucket' });
  });
});

describe('top values', () => {
  it('toggles up to 3 and reorders', () => {
    let top: string[] = [];
    for (const v of ['a', 'b', 'c', 'd']) top = toggleTop(top, v);
    expect(top).toEqual(['a', 'b', 'c']);
    expect(toggleTop(top, 'b')).toEqual(['a', 'c']);
    expect(moveTop(top, 'c', -1)).toEqual(['a', 'c', 'b']);
    expect(moveTop(top, 'a', -1)).toEqual(top);
  });
});
