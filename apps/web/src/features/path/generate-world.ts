import type { Riasec } from '@anabokra/engine';

import { clamp01, createSimplex2D, fbm, hashSeed, lerp, mulberry32, smoothstep, type Rng } from './rng';
import {
  STATION_KINDS,
  type CareerSlot,
  type PathPoint,
  type PropKind,
  type Vec3,
  type World,
  type WorldProfile,
  type WorldProp,
  type WorldRegion,
  type WorldStation,
} from './types';

/** Region order = Holland hexagon order. Kept local so the generator has no runtime dependency on the engine. */
export const REGION_ORDER = ['R', 'I', 'A', 'S', 'E', 'C'] as const satisfies readonly Riasec[];

export const GRID = 48;
export const WORLD_SIZE = 96;
const PATH_POINTS = 160;
const FLAT_BAND = 4.5; // terrain is fully flat this close to the path centre line
const FADE_BAND = 11; // ...and blends back to natural terrain by this distance
const STATION_T = [0.15, 0.38, 0.6, 0.8] as const;
const SLOT_COUNT = 5;

const r3 = (v: number): number => Math.round(v * 1000) / 1000;

function profileKey(weights: number[]): string {
  return weights.map((w) => w.toFixed(3)).join('-');
}

/** Uniform Catmull-Rom through control points, 2D. */
function catmull(p0: number[], p1: number[], p2: number[], p3: number[], t: number): [number, number] {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return [f(p0[0]!, p1[0]!, p2[0]!, p3[0]!), f(p0[1]!, p1[1]!, p2[1]!, p3[1]!)];
}

function buildPath(rng: Rng): { xz: [number, number][]; length: number } {
  const n = 8;
  const amp = 9 + rng() * 3;
  let sign = rng() < 0.5 ? -1 : 1;
  const ctrl: number[][] = [];
  for (let m = 0; m < n; m++) {
    const f = m / (n - 1);
    const z = 38 - 76 * f + (m === 0 || m === n - 1 ? 0 : (rng() - 0.5) * 4);
    let x: number;
    if (m === 0) x = (rng() - 0.5) * 4;
    else if (m === n - 1) x = (rng() - 0.5) * 6;
    else {
      x = sign * amp * (0.55 + 0.45 * rng());
      sign = -sign;
    }
    ctrl.push([x, z]);
  }
  const dense: [number, number][] = [];
  const per = 24;
  for (let s = 0; s < n - 1; s++) {
    const p0 = ctrl[Math.max(0, s - 1)]!;
    const p1 = ctrl[s]!;
    const p2 = ctrl[s + 1]!;
    const p3 = ctrl[Math.min(n - 1, s + 2)]!;
    for (let k = 0; k < per; k++) dense.push(catmull(p0, p1, p2, p3, k / per));
  }
  dense.push([ctrl[n - 1]![0]!, ctrl[n - 1]![1]!]);

  const cum: number[] = [0];
  for (let i = 1; i < dense.length; i++) {
    const a = dense[i - 1]!;
    const b = dense[i]!;
    cum.push(cum[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const length = cum[cum.length - 1]!;
  const xz: [number, number][] = [];
  let seg = 0;
  for (let i = 0; i < PATH_POINTS; i++) {
    const target = (i / (PATH_POINTS - 1)) * length;
    while (seg < dense.length - 2 && cum[seg + 1]! < target) seg++;
    const span = cum[seg + 1]! - cum[seg]!;
    const u = span > 0 ? (target - cum[seg]!) / span : 0;
    const a = dense[seg]!;
    const b = dense[seg + 1]!;
    xz.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u)]);
  }
  return { xz, length };
}

interface Nearest {
  dist: number;
  y: number;
  index: number;
}

export function generateWorld(profile: WorldProfile, seed?: string): World {
  const weights = REGION_ORDER.map((id) => {
    const v = profile.interests[id];
    return Number.isFinite(v) ? clamp01(v) : 0;
  });
  const seedKey = seed ?? profileKey(weights);
  const rng = mulberry32(hashSeed(seedKey));

  // Everything layout-related is drawn from `rng` BEFORE any score-dependent branch,
  // so a fixed seed gives the same map skeleton for any profile; scores only scale it.
  const noiseTerrain = createSimplex2D(rng);
  const noiseWarp = createSimplex2D(rng);
  const noiseTone = createSimplex2D(rng);
  const noisePathY = createSimplex2D(rng);
  const rot = (rng() - 0.5) * 0.35;
  const ringR = 29 + rng() * 3;
  const pathRaw = buildPath(rng);
  const stationJitter = STATION_T.map(() => (rng() - 0.5) * 0.03);

  const N = GRID;
  const half = WORLD_SIZE / 2;
  const cell = WORLD_SIZE / (N - 1);

  // ---- path ---------------------------------------------------------------
  const points: PathPoint[] = pathRaw.xz.map(([x, z], i) => {
    const t = i / (PATH_POINTS - 1);
    const y = 1 + 3.2 * t + 0.35 * noisePathY(t * 3.5, 0.5);
    return { x, y, z, t };
  });
  const nearest = (x: number, z: number): Nearest => {
    let best = Infinity;
    let bi = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!;
      const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
      if (d < best) {
        best = d;
        bi = i;
      }
    }
    return { dist: Math.sqrt(best), y: points[bi]!.y, index: bi };
  };
  const end = points[points.length - 1]!;
  const landmark = { pos: [r3(end.x), r3(end.y), r3(end.z)] as Vec3, radius: 7 };

  // ---- regions ------------------------------------------------------------
  const wEff = weights.map((w) => 0.18 + 0.82 * w);
  const regionsBase = REGION_ORDER.map((id, k) => {
    const ang = rot + (k * Math.PI) / 3;
    return {
      id,
      weight: weights[k]!,
      center: [Math.cos(ang) * ringR, Math.sin(ang) * ringR] as [number, number],
      radius: 6 + 14 * wEff[k]!,
    };
  });

  const ridged = (x: number, z: number, f: number): number => {
    const v = 1 - Math.abs(noiseTerrain(x * f + 100, z * f + 100));
    return v * v;
  };

  const heights = new Array<number>(N * N);
  const regionIndex = new Array<number>(N * N);
  const blend = new Array<number>(N * N);
  const tone = new Array<number>(N * N);
  const infl = new Array<number>(6);
  const TONE_FREQ = [0.3, 0.2, 0.16, 0.25, 0.15, 0.22] as const;

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const idx = j * N + i;
      const x = -half + i * cell;
      const z = -half + j * cell;

      let bestK = -1;
      let bestV = 0;
      for (let k = 0; k < 6; k++) {
        const r = regionsBase[k]!;
        const warp = noiseWarp(x * 0.045, z * 0.045 + k * 17.1) * 0.3;
        const d = Math.hypot(x - r.center[0], z - r.center[1]) * (1 + warp);
        const v = clamp01(1 - d / r.radius);
        infl[k] = v * v * (3 - 2 * v);
        if (v > bestV) {
          bestV = v;
          bestK = k;
        }
      }
      if (bestV < 0.08) bestK = -1;
      regionIndex[idx] = bestK;
      blend[idx] = r3(bestK < 0 ? 0 : smoothstep(0.08, 0.45, bestV));

      // base terrain
      let h = 0.3 + 1.6 * Math.pow(0.5 + 0.5 * fbm(noiseTerrain, x * 0.03, z * 0.03, 3), 1.3);

      // per-biome relief
      h += infl[0]! * (3 + 5 * wEff[0]!) * (0.35 + 0.65 * ridged(x, z, 0.09)); // R rocky
      h += Math.pow(infl[1]!, 1.4) * (4 + 12 * wEff[1]!) * (0.3 + 0.7 * Math.pow(ridged(x, z, 0.07), 1.5)); // I peaks
      h += infl[2]! * (1 + 2 * wEff[2]!) * (0.5 + 0.5 * noiseTerrain(x * 0.08, z * 0.08)); // A rolling fields
      h += infl[3]! * 1.2 * (0.85 + 0.15 * noiseTerrain(x * 0.1, z * 0.1)); // S gentle
      h += smoothstep(0.1, 0.4, infl[4]!) * (3.5 + 3 * wEff[4]!) * (0.97 + 0.03 * noiseTerrain(x * 0.1, z * 0.1)); // E plateau
      const q = (infl[5]! * (3 + 4 * wEff[5]!)) / 1.1; // C terraces
      h += (Math.floor(q) + smoothstep(0.7, 1, q - Math.floor(q))) * 1.1;

      // diorama edge
      const edge = Math.min(x + half, half - x, z + half, half - z);
      h *= smoothstep(0, 14, edge);

      // path corridor
      const np = nearest(x, z);
      h = lerp(h, np.y, 1 - smoothstep(FLAT_BAND, FADE_BAND, np.dist));
      // end plaza
      const dl = Math.hypot(x - end.x, z - end.z);
      h = lerp(h, end.y, 1 - smoothstep(landmark.radius, landmark.radius + 6, dl));

      heights[idx] = h;

      const tf = bestK < 0 ? 0.12 : TONE_FREQ[bestK]!;
      let tn = 0.5 + 0.5 * noiseTone(x * tf, z * tf);
      if (bestK === 2) tn = Math.floor(tn * 4) / 3; // crisp colour fields
      tone[idx] = r3(clamp01(tn));
    }
  }

  const nodeAt = (x: number, z: number): number => {
    const i = Math.max(0, Math.min(N - 1, Math.round((x + half) / cell)));
    const j = Math.max(0, Math.min(N - 1, Math.round((z + half) / cell)));
    return j * N + i;
  };

  // ---- career slots (strongest regions, pushed clear of the path) ----------
  const ranked = [...REGION_ORDER.keys()].sort((a, b) => weights[b]! - weights[a]! || a - b);
  const slotsXZ = ranked.slice(0, SLOT_COUNT).map((k) => {
    let [x, z] = regionsBase[k]!.center;
    for (let it = 0; it < 24; it++) {
      const np = nearest(x, z);
      if (np.dist >= 11) break;
      const p = points[np.index]!;
      const dx = x - p.x;
      const dz = z - p.z;
      const len = Math.hypot(dx, dz) || 1;
      x += (dx / len) * 1.2;
      z += (dz / len) * 1.2;
    }
    x = Math.max(-40, Math.min(40, x));
    z = Math.max(-40, Math.min(40, z));
    return { k, x, z };
  });
  for (const s of slotsXZ) {
    // flatten a small pedestal area to the local mean height
    let sum = 0;
    let cnt = 0;
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const d = Math.hypot(-half + i * cell - s.x, -half + j * cell - s.z);
        if (d <= 4) {
          sum += heights[j * N + i]!;
          cnt++;
        }
      }
    const target = cnt ? sum / cnt : heights[nodeAt(s.x, s.z)]!;
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const d = Math.hypot(-half + i * cell - s.x, -half + j * cell - s.z);
        const f = 1 - smoothstep(3.5, 7, d);
        if (f > 0) heights[j * N + i] = lerp(heights[j * N + i]!, target, f);
      }
  }

  for (let i = 0; i < heights.length; i++) heights[i] = r3(Math.max(0, heights[i]!));
  let maxHeight = 0;
  for (const h of heights) if (h > maxHeight) maxHeight = h;

  const sample = (x: number, z: number): number => {
    const fx = clamp01((x + half) / WORLD_SIZE) * (N - 1);
    const fz = clamp01((z + half) / WORLD_SIZE) * (N - 1);
    const i0 = Math.min(N - 2, Math.floor(fx));
    const j0 = Math.min(N - 2, Math.floor(fz));
    const u = fx - i0;
    const v = fz - j0;
    const h00 = heights[j0 * N + i0]!;
    const h10 = heights[j0 * N + i0 + 1]!;
    const h01 = heights[(j0 + 1) * N + i0]!;
    const h11 = heights[(j0 + 1) * N + i0 + 1]!;
    return lerp(lerp(h00, h10, u), lerp(h01, h11, u), v);
  };

  const slots: CareerSlot[] = slotsXZ.map((s, rank) => ({
    rank,
    region: REGION_ORDER[s.k]!,
    pos: [r3(s.x), r3(sample(s.x, s.z)), r3(s.z)] as Vec3,
    radius: 3,
  }));

  // ---- stations -----------------------------------------------------------
  const stations: WorldStation[] = STATION_KINDS.map((kind, index) => {
    const t = STATION_T[index]! + stationJitter[index]!;
    const f = t * (PATH_POINTS - 1);
    const a = points[Math.floor(f)]!;
    const b = points[Math.min(PATH_POINTS - 1, Math.floor(f) + 1)]!;
    const u = f - Math.floor(f);
    return {
      index,
      kind,
      t: r3(t),
      pos: [r3(lerp(a.x, b.x, u)), r3(lerp(a.y, b.y, u)), r3(lerp(a.z, b.z, u))] as Vec3,
    };
  });

  // ---- props --------------------------------------------------------------
  const QUOTA: Record<Riasec, [PropKind, number][]> = {
    R: [['rock', 12], ['shed', 4]],
    I: [['crystal', 26]],
    A: [['orb', 22]],
    S: [['house', 10], ['lamp', 8]],
    E: [['tower', 8]],
    C: [['slab', 14]],
  };
  const props: WorldProp[] = [];
  const farFromThings = (x: number, z: number): boolean => {
    if (nearest(x, z).dist < 6.5) return false;
    if (Math.hypot(x - end.x, z - end.z) < 10) return false;
    for (const s of slotsXZ) if (Math.hypot(x - s.x, z - s.z) < 4.5) return false;
    return Math.abs(x) < 43 && Math.abs(z) < 43;
  };
  const mkProp = (kind: PropKind, region: Riasec | null, x: number, z: number, pr: Rng): WorldProp => {
    const big = kind === 'tower' || kind === 'crystal';
    return {
      kind,
      region,
      pos: [r3(x), r3(sample(x, z)), r3(z)],
      scale: r3(big ? 0.8 + pr() * 0.8 : 0.7 + pr() * 0.7),
      stretch: r3(kind === 'tower' ? 1.5 + pr() * 3 : kind === 'crystal' ? 1 + pr() * 1.4 : 1),
      rotY: r3(pr() * Math.PI * 2),
      tint: r3(pr()),
    };
  };
  REGION_ORDER.forEach((id, k) => {
    const pr = mulberry32(hashSeed(`${seedKey}:props:${id}`));
    const reg = regionsBase[k]!;
    const placed: [number, number][] = [];
    for (const [kind, base] of QUOTA[id]) {
      const want = Math.round(base * (0.3 + 0.9 * weights[k]!));
      let got = 0;
      for (let a = 0; a < want * 14 && got < want; a++) {
        const ang = pr() * Math.PI * 2;
        const rr = reg.radius * Math.sqrt(pr());
        const x = reg.center[0] + Math.cos(ang) * rr;
        const z = reg.center[1] + Math.sin(ang) * rr;
        if (Math.abs(x) >= 43 || Math.abs(z) >= 43) continue;
        const ni = nodeAt(x, z);
        if (regionIndex[ni] !== k || blend[ni]! < 0.5) continue;
        if (!farFromThings(x, z)) continue;
        if (placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < 1.8)) continue;
        placed.push([x, z]);
        props.push(mkProp(kind, id, x, z, pr));
        got++;
      }
    }
  });
  {
    const pr = mulberry32(hashSeed(`${seedKey}:props:trees`));
    let got = 0;
    for (let a = 0; a < 600 && got < 34; a++) {
      const x = (pr() - 0.5) * 84;
      const z = (pr() - 0.5) * 84;
      const ni = nodeAt(x, z);
      if (regionIndex[ni]! >= 0 && blend[ni]! > 0.3) continue;
      if (heights[ni]! < 0.2 || !farFromThings(x, z)) continue;
      props.push(mkProp('tree', null, x, z, pr));
      got++;
    }
  }

  // ---- region summary -----------------------------------------------------
  const regions: WorldRegion[] = regionsBase.map((r, k) => {
    let cells = 0;
    let peak = 0;
    for (let i = 0; i < regionIndex.length; i++)
      if (regionIndex[i] === k) {
        cells++;
        if (heights[i]! > peak) peak = heights[i]!;
      }
    return {
      id: r.id,
      weight: r3(r.weight),
      center: [r3(r.center[0]), r3(r.center[1])] as const,
      radius: r3(r.radius),
      cells,
      peak,
    };
  });

  return {
    version: 1,
    seed: seedKey,
    grid: N,
    size: WORLD_SIZE,
    cell: r3(cell),
    heights,
    maxHeight,
    regionIndex,
    blend,
    tone,
    regions,
    path: {
      points: points.map((p) => ({ x: r3(p.x), y: r3(p.y), z: r3(p.z), t: r3(p.t) })),
      length: r3(pathRaw.length),
    },
    stations,
    landmark,
    slots,
    props,
  };
}

/** Bilinear terrain height at a world position. */
export function heightAt(world: Pick<World, 'grid' | 'size' | 'heights'>, x: number, z: number): number {
  const N = world.grid;
  const fx = clamp01((x + world.size / 2) / world.size) * (N - 1);
  const fz = clamp01((z + world.size / 2) / world.size) * (N - 1);
  const i0 = Math.min(N - 2, Math.floor(fx));
  const j0 = Math.min(N - 2, Math.floor(fz));
  const u = fx - i0;
  const v = fz - j0;
  const h = world.heights;
  return lerp(
    lerp(h[j0 * N + i0]!, h[j0 * N + i0 + 1]!, u),
    lerp(h[(j0 + 1) * N + i0]!, h[(j0 + 1) * N + i0 + 1]!, u),
    v,
  );
}
