import { describe, expect, it } from 'vitest';

import { BANDS, bandLevel, bandOf } from './bands';

describe('bandOf', () => {
  it('maps normalized scores to four bands at the cut points', () => {
    expect(bandOf(0)).toBe('growing');
    expect(bandOf(0.349)).toBe('growing');
    expect(bandOf(0.35)).toBe('balanced');
    expect(bandOf(0.599)).toBe('balanced');
    expect(bandOf(0.6)).toBe('strong');
    expect(bandOf(0.799)).toBe('strong');
    expect(bandOf(0.8)).toBe('standout');
    expect(bandOf(1)).toBe('standout');
  });
  it('is safe on junk input and ordered', () => {
    expect(bandOf(Number.NaN)).toBe('growing');
    expect(BANDS.map(bandLevel)).toEqual([1, 2, 3, 4]);
  });
});
