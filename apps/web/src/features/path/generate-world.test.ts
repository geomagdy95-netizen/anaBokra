import { RIASEC, type Riasec } from '@anabokra/engine';
import { describe, expect, it } from 'vitest';

import { generateWorld, REGION_ORDER } from './generate-world';
import { PRESETS } from './presets';
import type { World } from './types';

const flat = (v: number): Record<Riasec, number> => ({ R: v, I: v, A: v, S: v, E: v, C: v });
const withScore = (id: Riasec, v: number) => ({ interests: { ...flat(0.5), [id]: v } });

function distToPolyline(world: World, p: readonly [number, number, number]): number {
  const pts = world.path.points;
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const u = Math.max(0, Math.min(1, ((p[0] - a.x) * dx + (p[2] - a.z) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(p[0] - (a.x + u * dx), p[2] - (a.z + u * dz)));
  }
  return best;
}

describe('generateWorld', () => {
  it('uses the same region order as the engine', () => {
    expect([...REGION_ORDER]).toEqual([...RIASEC]);
  });

  it('is deterministic for the same profile', () => {
    const a = generateWorld(PRESETS.scientist);
    const b = generateWorld(PRESETS.scientist);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(generateWorld(PRESETS.scientist, 'x'))).toBe(JSON.stringify(generateWorld(PRESETS.scientist, 'x')));
  });

  it('differs between profiles and between seeds', () => {
    expect(generateWorld(PRESETS.scientist).heights).not.toEqual(generateWorld(PRESETS.creative).heights);
    expect(generateWorld(PRESETS.scientist, 'a').heights).not.toEqual(generateWorld(PRESETS.scientist, 'b').heights);
  });

  it('survives out-of-range and missing scores', () => {
    const w = generateWorld({ interests: { R: -1, I: 5, A: NaN, S: 0, E: 1, C: 0.5 } });
    expect(w.regions.every((r) => r.weight >= 0 && r.weight <= 1)).toBe(true);
  });

  it('has the expected grid shape', () => {
    const w = generateWorld(PRESETS.builder);
    expect(w.heights).toHaveLength(w.grid * w.grid);
    expect(w.regionIndex).toHaveLength(w.grid * w.grid);
    expect(w.regions).toHaveLength(6);
    expect(w.slots).toHaveLength(5);
  });

  it.each(RIASEC)('region %s grows (size and height) with its interest score', (id) => {
    const lo = generateWorld(withScore(id, 0.1), 'fixed');
    const hi = generateWorld(withScore(id, 0.95), 'fixed');
    const rLo = lo.regions.find((r) => r.id === id)!;
    const rHi = hi.regions.find((r) => r.id === id)!;
    expect(rHi.radius).toBeGreaterThan(rLo.radius);
    expect(rHi.cells).toBeGreaterThan(rLo.cells);
    if (id === 'I' || id === 'R' || id === 'E' || id === 'C') expect(rHi.peak).toBeGreaterThan(rLo.peak);
  });

  it('places the strongest regions in the career slots', () => {
    const w = generateWorld(PRESETS.scientist);
    expect(w.slots[0]!.region).toBe('I');
  });

  it('routes the path through 4 ordered stations and ends at the landmark', () => {
    for (const preset of Object.values(PRESETS)) {
      const w = generateWorld(preset);
      expect(w.stations).toHaveLength(4);
      const ts = w.stations.map((s) => s.t);
      expect([...ts].sort((a, b) => a - b)).toEqual(ts);
      for (const s of w.stations) expect(distToPolyline(w, s.pos)).toBeLessThan(0.02);
      const last = w.path.points[w.path.points.length - 1]!;
      expect(Math.hypot(last.x - w.landmark.pos[0], last.z - w.landmark.pos[2])).toBeLessThan(0.01);
      expect(w.path.points[0]!.z).toBeGreaterThan(last.z); // journey runs towards -z
    }
  });

  it('keeps slots and props off the path', () => {
    const w = generateWorld(PRESETS.leader);
    for (const s of w.slots) expect(distToPolyline(w, s.pos)).toBeGreaterThan(8);
    for (const p of w.props) expect(distToPolyline(w, p.pos)).toBeGreaterThan(5.5);
  });
});
