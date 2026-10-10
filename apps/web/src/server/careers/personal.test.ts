import { careers } from '@anabokra/content';
import { describe, expect, it } from 'vitest';

import { fitsFromResult } from './fits';

describe('fitsFromResult', () => {
  const interests = { R: 0.2, I: 0.9, A: 0.3, S: 0.2, E: 0.4, C: 0.5 };

  it('ranks the whole catalog from the stored profile, not just the stored top matches', () => {
    const fits = fitsFromResult({ scores: { interests }, matches: [], context: {} });
    expect(Object.keys(fits)).toHaveLength(careers.length);
    for (const f of Object.values(fits)) {
      expect(Number.isInteger(f.fit)).toBe(true);
      expect(f.fit).toBeGreaterThanOrEqual(0);
      expect(f.fit).toBeLessThanOrEqual(100);
    }
  });

  it('falls back to the stored matches when the result has no profile scores', () => {
    const fits = fitsFromResult({
      scores: {},
      matches: [{ careerId: 'nurse', cluster: 'health', fit: 71.6, reasons: [], watchOuts: [], flags: [], components: {}, coverage: 1 }],
      context: {},
    });
    expect(fits).toEqual({ nurse: { fit: 72, reasons: [], watchOuts: [], flags: [] } });
  });
});
