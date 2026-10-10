import { describe, expect, it } from 'vitest';

import { interleaveByScale } from './order';
import { insightFor, insightPoints } from './insight';

describe('micro-insight cadence', () => {
  it('fires every 8 to 10 items and not at the very end', () => {
    const pts = insightPoints(61);
    expect(pts.length).toBeGreaterThan(4);
    pts.forEach((p, i) => expect(p - (pts[i - 1] ?? 0)).toBeGreaterThanOrEqual(8));
    pts.forEach((p, i) => expect(p - (pts[i - 1] ?? 0)).toBeLessThanOrEqual(10));
    expect(pts.at(-1)!).toBeLessThanOrEqual(59);
    expect(insightFor(pts[0]!, 61)).toBe(0);
    expect(insightFor(3, 61)).toBeNull();
  });
});

describe('interleaveByScale', () => {
  it('round-robins scales and keeps attention checks in the stream', () => {
    const items = [
      { id: 'a1', scale: 'A' }, { id: 'a2', scale: 'A' },
      { id: 'ac' },
      { id: 'b1', scale: 'B' }, { id: 'b2', scale: 'B' },
    ];
    const out = interleaveByScale(items).map((i) => i.id);
    expect(out).toHaveLength(5);
    expect(out).toContain('ac');
    expect(out.filter((i) => i !== 'ac').slice(0, 2)).toEqual(['a1', 'b1']);
  });
});
