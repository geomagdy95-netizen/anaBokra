import { describe, expect, it } from 'vitest';

import { ARRANGE_RING, CORE_RADIUS, ISLAND_RADIUS, STATION_RADIUS, clearSpot, islandPlacements, isletPlacements, stationSpots } from './layout';
import { GROUP_ORDER } from './types';

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

  it('never puts two slotted islands too close together, all 18 on the map', () => {
    const p = islandPlacements({}, Object.fromEntries(GROUP_ORDER.map((id, i) => [id, i])));
    for (const a of p) for (const b of p) if (a !== b) expect(gap(a.pos, b.pos)).toBeGreaterThan(ISLAND_RADIUS * 2 + 0.9);
  });

  it('keeps three career islets clear of every other island', () => {
    const p = islandPlacements({}, Object.fromEntries(GROUP_ORDER.map((id, i) => [id, i])));
    for (const g of p)
      for (const islet of isletPlacements(g, 3))
        for (const o of p) if (o !== g) expect(gap(islet.pos, o.pos)).toBeGreaterThan(ISLAND_RADIUS + 0.62);
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

describe('stationSpots', () => {
  it('rings my island inside its edge, evenly, leaving the front free for the "me" label', () => {
    const spots = stationSpots(10);
    expect(spots).toHaveLength(10);
    for (const [x, z] of spots) {
      expect(Math.hypot(x, z)).toBeCloseTo(STATION_RADIUS);
      expect(Math.hypot(x, z)).toBeLessThan(CORE_RADIUS);
    }
    // Neighbours are the same distance apart.
    const gap = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!);
    expect(gap(spots[0]!, spots[1]!)).toBeCloseTo(gap(spots[4]!, spots[5]!));
    // No station sits straight in front (positive Z on the X=0 line).
    expect(spots.every(([x, z]) => !(Math.abs(x) < 0.1 && z > 0))).toBe(true);
  });
});
