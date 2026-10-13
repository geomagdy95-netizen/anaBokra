import { BufferAttribute, BufferGeometry, Color, Path, Shape, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

import { ISLAND_TOP } from './layout';

/** Island colours: pastel grass on top, a warm earth cliff, a sandy beach that fades into the sea. */
export const ISLAND_COLORS = {
  grass: '#BFE0A3',
  grassEdge: '#A6D08C',
  cliffTop: '#D9B98F',
  cliff: '#C9A27A',
  sand: '#F7E8C8',
  wetSand: '#EAD6B0',
  sea: '#CBBDF0',
} as const;

type ColorKey = keyof typeof ISLAND_COLORS;

/** One ring of the island profile: distance from the centre (`r`, or `off` from the island radius), height, colour. */
interface Ring {
  r?: number;
  off?: number;
  y: number;
  color: ColorKey;
  /** 0..1 blend toward the sea colour (the shallows). */
  sea?: number;
}

export interface IslandShape {
  /** Seeds the outline, so every island has its own shape. */
  seed: string;
  radius: number;
  top?: number;
  /** false: a raised tier (grass and cliff only) that sits on another island. */
  beach?: boolean;
  /** Where the cliff of a tier stops. */
  base?: number;
  /** How far the outline wanders, as a share of the radius. */
  wobble?: number;
  /** Directions (radians, atan2(z, x)) where bridges land: the outline stays full there. */
  landAt?: number[];
  segments?: number;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Outline radius multiplier at angle a: a few seeded waves, never smaller than 1 where a bridge lands. */
function outline(seed: string, wobble: number, landAt: number[]): (a: number) => number {
  let h = hash(seed);
  const next = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0), (h % 10000) / 10000);
  const waves = [2, 3, 5, 7].map((k, i) => ({ k, phase: next() * Math.PI * 2, amp: wobble * [0.55, 0.45, 0.25, 0.12][i]! }));
  return (a) => {
    let m = 1 + waves.reduce((sum, w) => sum + Math.sin(w.k * a + w.phase) * w.amp, 0);
    for (const b of landAt) {
      // Within about ±30° of a bridge the outline is at least full, with a small headland for the bridge.
      const near = Math.pow(Math.max(0, Math.cos(a - b)), 6);
      m = Math.max(m, 1 - (1 - near) * 2) + Math.pow(near, 2) * wobble * 0.4;
    }
    return m;
  };
}

/**
 * An island in the toy style: a seeded, organic outline; a grassy plateau with a rounded lip; a short
 * earth cliff; a sandy beach running into shallow water. A tier (`beach: false`) is plateau and cliff
 * only. Vertex colours, smooth normals; the plateau is flat at `top` so props and bridges sit on it.
 */
export function islandGeometry({ seed, radius: R, top = ISLAND_TOP, beach = true, base = ISLAND_TOP, wobble = 0.06, landAt = [], segments = 96 }: IslandShape): BufferGeometry {
  const rings: Ring[] = beach
    ? [
        { r: 0, y: top + 0.05, color: 'grass' },
        { r: R * 0.45, y: top + 0.04, color: 'grass' },
        { off: -0.45, y: top + 0.015, color: 'grass' },
        { off: -0.32, y: top, color: 'grassEdge' },
        { off: -0.27, y: top - 0.035, color: 'grassEdge' },
        { off: -0.24, y: top - 0.09, color: 'cliffTop' },
        { off: -0.19, y: 0.25, color: 'cliff' },
        { off: -0.15, y: 0.16, color: 'cliff' },
        { off: -0.11, y: 0.125, color: 'sand' },
        { off: 0.1, y: 0.05, color: 'sand' },
        { off: 0.22, y: 0.0, color: 'wetSand' },
        { off: 0.38, y: -0.1, color: 'wetSand', sea: 0.6 },
        { off: 0.52, y: -0.28, color: 'wetSand', sea: 1 },
      ]
    : [
        { r: 0, y: top + 0.04, color: 'grass' },
        { r: R * 0.5, y: top + 0.03, color: 'grass' },
        { off: -0.3, y: top, color: 'grassEdge' },
        { off: -0.24, y: top - 0.035, color: 'grassEdge' },
        { off: -0.2, y: top - 0.09, color: 'cliffTop' },
        { off: -0.12, y: base + 0.02, color: 'cliff' },
        { off: -0.08, y: base - 0.08, color: 'cliff' },
      ];

  const shape = outline(seed, wobble, landAt);
  const n = segments;
  const positions = new Float32Array(rings.length * n * 3);
  const colors = new Float32Array(rings.length * n * 3);
  const palette = Object.fromEntries(Object.entries(ISLAND_COLORS).map(([k, v]) => [k, new Color(v)])) as Record<ColorKey, Color>;
  const c = new Color();
  // Gentle brightness speckle so large surfaces don't look flat.
  const speckle = (i: number, k: number) => ((hash(`${seed}:${i}:${k}`) % 1000) / 1000 - 0.5) * 0.035;

  rings.forEach((ring, k) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const dist = ring.r !== undefined ? ring.r * (ring.r > 0 ? shape(a) * 0.98 : 1) : (R + ring.off!) * shape(a);
      const idx = (k * n + i) * 3;
      positions[idx] = Math.cos(a) * dist;
      positions[idx + 1] = ring.y;
      positions[idx + 2] = Math.sin(a) * dist;
      c.copy(palette[ring.color]);
      if (ring.sea) c.lerp(palette.sea, ring.sea);
      else c.offsetHSL(0, 0, speckle(i, k));
      colors.set([c.r, c.g, c.b], idx);
    }
  });

  const index: number[] = [];
  for (let k = 0; k < rings.length - 1; k++) {
    for (let i = 0; i < n; i++) {
      const a = k * n + i;
      const b = k * n + ((i + 1) % n);
      const d = (k + 1) * n + i;
      const e = (k + 1) * n + ((i + 1) % n);
      index.push(a, b, d, b, e, d);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(positions, 3));
  g.setAttribute('color', new BufferAttribute(colors, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

const boxCache = new Map<string, BufferGeometry>();

/** Shared rounded box geometry. */
export function roundedBox(w: number, h: number, d: number, r = 0.06): BufferGeometry {
  const key = `${w}|${h}|${d}|${r}`;
  let g = boxCache.get(key);
  if (!g) {
    g = new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2));
    boxCache.set(key, g);
  }
  return g;
}

export function roundedRectShape(w: number, h: number, r: number): Shape {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Speech bubble outline (rounded rectangle with a tail at the bottom left). */
export function bubbleShape(w: number, h: number, r: number): Shape {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w * 0.38, y);
  s.lineTo(x + w * 0.2, y - h * 0.32);
  s.lineTo(x + w * 0.5, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** U-shaped arch ("window of possibility"), open at the bottom. */
export function archShape(w: number, h: number, wall: number): Shape {
  const r = w / 2;
  const ir = r - wall;
  const s = new Shape();
  s.moveTo(-r, 0);
  s.lineTo(-r, h - r);
  s.absarc(0, h - r, r, Math.PI, 0, true);
  s.lineTo(r, 0);
  s.lineTo(ir, 0);
  s.lineTo(ir, h - r);
  s.absarc(0, h - r, ir, 0, Math.PI, false);
  s.lineTo(-ir, 0);
  s.lineTo(-r, 0);
  return s;
}

/** Half disc whose flat side faces left: the apricot sun inside the logo window. */
export function halfDiscShape(r: number): Shape {
  const s = new Shape();
  s.moveTo(0, -r);
  s.absarc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(0, -r);
  return s;
}

/** Right-angle set square with a triangular cut-out. */
export function setSquareShape(w: number, h: number, inset: number): Shape {
  const s = new Shape();
  s.moveTo(0, 0);
  s.lineTo(w, 0);
  s.lineTo(0, h);
  s.lineTo(0, 0);
  const k = inset * 2.3;
  const hole = new Path();
  hole.moveTo(inset, inset);
  hole.lineTo(inset, h - k * (h / w));
  hole.lineTo(w - k, inset);
  hole.lineTo(inset, inset);
  s.holes.push(hole);
  return s;
}

export function gearShape(teeth: number, outer: number, root: number, hole: number): Shape {
  const s = new Shape();
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts: [number, number][] = [
      [root, a],
      [outer, a + step * 0.12],
      [outer, a + step * 0.45],
      [root, a + step * 0.57],
    ];
    pts.forEach(([r, ang], j) => {
      const x = Math.cos(ang) * r;
      const y = Math.sin(ang) * r;
      if (i === 0 && j === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    });
  }
  s.closePath();
  const h = new Path();
  h.absarc(0, 0, hole, 0, Math.PI * 2, true);
  s.holes.push(h);
  return s;
}

/** Open-end wrench standing on its handle: handle width 2·hw, head radius r, notch width 2·nw. */
export function wrenchShape(length: number, hw: number, r: number, nw: number): Shape {
  const s = new Shape();
  const d = Math.asin(hw / r);
  const e = Math.asin(nw / r);
  s.moveTo(-hw, 0);
  s.lineTo(-hw, length - Math.cos(d) * r);
  s.absarc(0, length, r, -Math.PI / 2 - d, Math.PI / 2 + e, true);
  s.lineTo(-nw, length + r * 0.15);
  s.lineTo(nw, length + r * 0.15);
  s.lineTo(nw, length + Math.cos(e) * r);
  s.absarc(0, length, r, Math.PI / 2 - e, -Math.PI / 2 + d, true);
  s.lineTo(hw, 0);
  s.lineTo(-hw, 0);
  return s;
}

/** Pen nib outline, tip up. */
export function nibShape(w: number, h: number): Shape {
  const s = new Shape();
  s.moveTo(0, h);
  s.quadraticCurveTo(w * 0.55, h * 0.55, w * 0.5, h * 0.22);
  s.lineTo(w * 0.42, 0);
  s.lineTo(-w * 0.42, 0);
  s.lineTo(-w * 0.5, h * 0.22);
  s.quadraticCurveTo(-w * 0.55, h * 0.55, 0, h);
  return s;
}

export interface BridgeEnds {
  start: Vector3;
  end: Vector3;
  arch: number;
}

/** Point on a bridge at t in 0..1 (a gentle arch between the two decks). */
export function bridgePoint(b: BridgeEnds, t: number, out = new Vector3()): Vector3 {
  out.copy(b.start).lerp(b.end, t);
  out.y += Math.sin(Math.PI * t) * b.arch;
  return out;
}

/** Flat strip under a bridge, used for the soft glow of suggested and added bridges. */
export function stripGeometry(b: BridgeEnds, width: number, from: number, to: number, segments = 24): BufferGeometry {
  const dir = new Vector3().subVectors(b.end, b.start).setY(0).normalize();
  const side = new Vector3(-dir.z, 0, dir.x).multiplyScalar(width / 2);
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  const p = new Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = from + ((to - from) * i) / segments;
    bridgePoint(b, t, p);
    positions.push(p.x - side.x, p.y - 0.12, p.z - side.z, p.x + side.x, p.y - 0.12, p.z + side.z);
    uvs.push(0, i / segments, 1, i / segments);
    if (i < segments) {
      const k = i * 2;
      index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}
