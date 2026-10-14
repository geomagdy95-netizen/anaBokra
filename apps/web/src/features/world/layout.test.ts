import { describe, expect, it } from 'vitest';

import { ARRANGE_RING, CORE_RADIUS, ISLAND_RADIUS, clearSpot, islandPlacements } from './layout';

const placements = islandPlacements();
const gap = (a: readonly [number, number], b: readonly [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe('island slots', () => {
  it('spreads the first three islands evenly round the core, closer in', () => {
    const p = islandPlacements({}, { tech: 0, law: 1, media: 2 });
    const angle = (id: string) => (Math.atan2(p.find((x) => x.id === id)!.dir[1], p.find((x) => x.id === id)!.dir[0]) * 180) / Math.PI;
    expect(angle('tech')).toBeCloseTo(-90);
    expect(angle('law')).toBeCloseTo(30);
    expect(angle('media')).toBeCloseTo(150);
    expect(Math.hypot(...p.find((x) => x.id === 'tech')!.pos)).toBeCloseTo(8.8);
  });

  it('never puts two slotted islands too close together', () => {
    const ids = ['tech', 'law', 'media', 'health', 'business', 'science', 'trades', 'education', 'tourism', 'creative', 'engineering', 'agriculture'] as const;
    const p = islandPlacements({}, Object.fromEntries(ids.map((id, i) => [id, i])));
    for (const a of p) for (const b of p) if (a !== b) expect(gap(a.pos, b.pos)).toBeGreaterThan(ISLAND_RADIUS * 2 + 0.9);
  });
});

describe('arranging islands', () => {
  it('uses stored positions and points each island away from the core', () => {
    const p = islandPlacements({ law: [0, 9] }).find((x) => x.id === 'law')!;
    expect(p.pos).toEqual([0, 9]);
    expect(p.dir[0]).toBeCloseTo(0);
    expect(p.dir[1]).toBeCloseTo(1);
  });

  it('nudges a dropped island off the others and out of the core', () => {
    const tech = placements.find((p) => p.id === 'tech')!;
    for (const [x, z] of [tech.pos, [0.5, 0.5], [tech.pos[0] + 0.4, tech.pos[1]]] as const) {
      const spot = clearSpot('law', x, z, placements);
      for (const o of placements.filter((p) => p.id !== 'law')) expect(gap(spot, o.pos)).toBeGreaterThan(ISLAND_RADIUS * 2);
      expect(Math.hypot(...spot)).toBeGreaterThan(CORE_RADIUS + ISLAND_RADIUS);
      expect(Math.hypot(...spot)).toBeLessThanOrEqual(ARRANGE_RING[1] + 1e-9);
    }
  });

  it('leaves a free spot where it is', () => {
    const law = placements.find((p) => p.id === 'law')!;
    expect(clearSpot('law', law.pos[0], law.pos[1], placements)).toEqual(law.pos);
  });
});
