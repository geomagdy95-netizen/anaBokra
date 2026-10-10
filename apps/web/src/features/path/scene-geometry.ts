import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  OctahedronGeometry,
  SRGBColorSpace,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { hexToRgb, nodeColor, type Rgb, type ScenePalette } from './palette';
import { doneT } from './scene-state';
import type { PropKind, World } from './types';

const tmp = new Color();
/** sRGB 0..1 -> linear working space (what three.js expects in vertex colour attributes). */
export function toLinear(c: Rgb, out: number[], at: number): void {
  tmp.setRGB(c[0], c[1], c[2], SRGBColorSpace);
  out[at] = tmp.r;
  out[at + 1] = tmp.g;
  out[at + 2] = tmp.b;
}
export function linearColor(c: Rgb): Color {
  return new Color().setRGB(c[0], c[1], c[2], SRGBColorSpace);
}

/** Non-indexed, per-face coloured terrain => true flat-shaded low-poly look. */
export function buildTerrainGeometry(world: World, palette: ScenePalette): BufferGeometry {
  const N = world.grid;
  const half = world.size / 2;
  const cells = (N - 1) * (N - 1);
  const pos = new Float32Array(cells * 6 * 3);
  const col: number[] = new Array<number>(cells * 6 * 3);
  const nodeCols: Rgb[] = new Array<Rgb>(N * N);
  for (let n = 0; n < N * N; n++) nodeCols[n] = nodeColor(world, n, palette);

  let v = 0;
  const put = (n: number, rgb: Rgb) => {
    const i = n % N;
    const j = (n - i) / N;
    pos[v * 3] = -half + i * world.cell;
    pos[v * 3 + 1] = world.heights[n]!;
    pos[v * 3 + 2] = -half + j * world.cell;
    toLinear(rgb, col, v * 3);
    v++;
  };
  const tri = (a: number, b: number, c: number) => {
    const ca = nodeCols[a]!;
    const cb = nodeCols[b]!;
    const cc = nodeCols[c]!;
    const avg: Rgb = [(ca[0] + cb[0] + cc[0]) / 3, (ca[1] + cb[1] + cc[1]) / 3, (ca[2] + cb[2] + cc[2]) / 3];
    put(a, avg);
    put(b, avg);
    put(c, avg);
  };
  for (let j = 0; j < N - 1; j++) {
    for (let i = 0; i < N - 1; i++) {
      const a = j * N + i;
      const b = a + N;
      const c = a + 1;
      const d = a + N + 1;
      if ((i + j) % 2 === 0) {
        tri(a, b, c);
        tri(c, b, d);
      } else {
        tri(a, b, d);
        tri(a, d, c);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/** Flat ribbon along the path; the completed part uses the "done" colour. */
export function buildRibbonGeometry(world: World, palette: ScenePalette, progress: number, halfWidth = 1.35): BufferGeometry {
  const pts = world.path.points;
  const n = pts.length;
  const pos = new Float32Array(n * 2 * 3);
  const col: number[] = new Array<number>(n * 2 * 3);
  const dt = doneT(world, progress);
  const done = hexToRgb(palette.roadDone);
  const road = hexToRgb(palette.road);
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(n - 1, i + 1)]!;
    let tx = b.x - a.x;
    let tz = b.z - a.z;
    const len = Math.hypot(tx, tz) || 1;
    tx /= len;
    tz /= len;
    const p = pts[i]!;
    const y = p.y + 0.12;
    pos.set([p.x + tz * halfWidth, y, p.z - tx * halfWidth, p.x - tz * halfWidth, y, p.z + tx * halfWidth], i * 6);
    const c = p.t <= dt ? done : road;
    toLinear(c, col, i * 6);
    toLinear(c, col, i * 6 + 3);
  }
  const idx: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function at(g: BufferGeometry, x: number, y: number, z: number): BufferGeometry {
  return g.translate(x, y, z);
}

/** Merge parts that may mix indexed and non-indexed primitives. */
function merge(parts: BufferGeometry[]): BufferGeometry {
  return mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!;
}

const cache = new Map<PropKind, BufferGeometry>();

/** Shared unit geometries, base at y = 0. Never disposed (tiny, reused across worlds). */
export function propGeometry(kind: PropKind): BufferGeometry {
  const hit = cache.get(kind);
  if (hit) return hit;
  let g: BufferGeometry;
  switch (kind) {
    case 'crystal':
      g = at(new OctahedronGeometry(0.9, 0).scale(0.6, 2.0, 0.6), 0, 1.6, 0);
      break;
    case 'orb':
      g = at(new IcosahedronGeometry(0.95, 0), 0, 0.8, 0);
      break;
    case 'house': {
      const roof = new ConeGeometry(1.35, 0.95, 4).rotateY(Math.PI / 4);
      g = merge([at(new BoxGeometry(1.6, 1.2, 1.6), 0, 0.6, 0), at(roof, 0, 1.68, 0)]);
      break;
    }
    case 'lamp':
      g = merge([at(new CylinderGeometry(0.07, 0.09, 1.6, 5), 0, 0.8, 0), at(new IcosahedronGeometry(0.3, 0), 0, 1.7, 0)]);
      break;
    case 'rock':
      g = at(new DodecahedronGeometry(1, 0).scale(1, 0.7, 0.9), 0, 0.45, 0);
      break;
    case 'shed':
      g = merge([at(new BoxGeometry(2.2, 1.3, 1.6), 0, 0.65, 0), at(new BoxGeometry(0.4, 1, 0.4), 0.6, 1.6, 0.3)]);
      break;
    case 'tower':
      g = at(new BoxGeometry(1.3, 2, 1.3), 0, 1, 0);
      break;
    case 'slab':
      g = at(new CylinderGeometry(1.7, 1.9, 0.5, 6), 0, 0.25, 0);
      break;
    case 'tree':
      g = merge([at(new CylinderGeometry(0.12, 0.16, 0.7, 5), 0, 0.35, 0), at(new ConeGeometry(0.9, 2.2, 5), 0, 1.7, 0)]);
      break;
  }
  cache.set(kind, g);
  return g;
}
