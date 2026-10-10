import type { Riasec } from '@anabokra/engine';

import { clamp01, lerp, smoothstep } from './rng';
import type { StationState, World, WorldProp } from './types';

/** Scene palette. Defaults mirror the --path-* tokens in styles/tokens.css. */
export interface ScenePalette {
  sky: string;
  ground: string;
  groundHigh: string;
  tree: string;
  road: string;
  roadDone: string;
  station: Record<StationState, string>;
  regions: Record<Riasec, string>;
}

export const DEFAULT_PALETTE: ScenePalette = {
  sky: '#f2e4d4',
  ground: '#cfc8a6',
  groundHigh: '#a7a58a',
  tree: '#7d9a74',
  road: '#f4ead8',
  roadDone: '#2a9d8f',
  station: { done: '#3f9f7a', current: '#ef8a3a', locked: '#9a948a' },
  regions: { R: '#b5714a', I: '#6fb7c4', A: '#c78bb6', S: '#e3b25c', E: '#d0645a', C: '#7fa384' },
};

/** Reads --path-* tokens from the document (client only), falling back to defaults. */
export function readPalette(): ScenePalette {
  if (typeof document === 'undefined') return DEFAULT_PALETTE;
  const cs = getComputedStyle(document.documentElement);
  const get = (name: string, fb: string): string => {
    const v = cs.getPropertyValue(name).trim();
    return /^#[0-9a-f]{6}$/i.test(v) ? v : fb;
  };
  const d = DEFAULT_PALETTE;
  return {
    sky: get('--path-sky', d.sky),
    ground: get('--path-ground', d.ground),
    groundHigh: get('--path-ground-high', d.groundHigh),
    tree: get('--path-tree', d.tree),
    road: get('--path-road', d.road),
    roadDone: get('--path-road-done', d.roadDone),
    station: {
      done: get('--path-station-done', d.station.done),
      current: get('--path-station-current', d.station.current),
      locked: get('--path-station-locked', d.station.locked),
    },
    regions: {
      R: get('--path-region-r', d.regions.R),
      I: get('--path-region-i', d.regions.I),
      A: get('--path-region-a', d.regions.A),
      S: get('--path-region-s', d.regions.S),
      E: get('--path-region-e', d.regions.E),
      C: get('--path-region-c', d.regions.C),
    },
  };
}

// ---- pure colour math (no three.js) ------------------------------------------

export type Rgb = readonly [number, number, number]; // 0..1

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  const c = (v: number) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export const mix = (a: Rgb, b: Rgb, t: number): Rgb => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const WHITE: Rgb = [1, 1, 1];
const BLACK: Rgb = [0, 0, 0];

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    return u < 1 / 6 ? p + (q - p) * 6 * u : u < 1 / 2 ? q : u < 2 / 3 ? p + (q - p) * (2 / 3 - u) * 6 : p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}

export function rotateHue(c: Rgb, turns: number): Rgb {
  const [h, s, l] = rgbToHsl(c);
  return hslToRgb((h + turns + 1) % 1, s, l);
}

/** A region colour varied by a 0..1 tone. Artistic fields shift hue; the rest shift lightness. */
export function toned(id: Riasec, base: Rgb, tone: number): Rgb {
  if (id === 'A') return rotateHue(base, (tone - 0.5) * 0.28);
  return tone < 0.5 ? mix(base, BLACK, (0.5 - tone) * 0.24) : mix(base, WHITE, (tone - 0.5) * 0.3);
}

/** Terrain colour of one grid node. `shade` (0..1, 0.5 = flat) is optional hill-shading for the 2D view. */
export function nodeColor(world: World, idx: number, pal: ScenePalette, shade = 0.5): Rgb {
  const h01 = world.maxHeight > 0 ? clamp01(world.heights[idx]! / world.maxHeight) : 0;
  const tone = world.tone[idx]!;
  let c = mix(hexToRgb(pal.ground), hexToRgb(pal.groundHigh), Math.pow(h01, 0.8));
  c = mix(c, tone < 0.5 ? BLACK : WHITE, Math.abs(tone - 0.5) * 0.08);
  const k = world.regionIndex[idx]!;
  if (k >= 0) {
    const id = world.regions[k]!.id;
    let rc = toned(id, hexToRgb(pal.regions[id]), tone);
    if (id === 'I') rc = mix(rc, WHITE, smoothstep(0.55, 1, h01) * 0.55); // frosted peaks
    c = mix(c, rc, world.blend[idx]!);
  }
  return shade === 0.5 ? c : mix(c, shade > 0.5 ? WHITE : BLACK, Math.abs(shade - 0.5) * 0.5);
}

/** Cheap hill-shade for a node from its neighbours (light from the upper-left). */
export function nodeShade(world: World, i: number, j: number): number {
  const N = world.grid;
  const h = (a: number, b: number) => world.heights[Math.max(0, Math.min(N - 1, b)) * N + Math.max(0, Math.min(N - 1, a))]!;
  const dx = h(i + 1, j) - h(i - 1, j);
  const dz = h(i, j + 1) - h(i, j - 1);
  return clamp01(0.5 + (dx + dz) * 0.12);
}

export function propColor(prop: WorldProp, pal: ScenePalette): Rgb {
  const base = prop.region ? hexToRgb(pal.regions[prop.region]) : hexToRgb(pal.tree);
  const t = prop.tint;
  switch (prop.kind) {
    case 'crystal':
      return mix(mix(base, WHITE, 0.25 + t * 0.3), BLACK, 0.05);
    case 'orb':
      return rotateHue(base, (t - 0.5) * 0.35);
    case 'lamp':
      return hexToRgb(pal.regions.S);
    case 'tower':
      return mix(base, BLACK, 0.1 + t * 0.2);
    case 'tree':
      return mix(base, BLACK, t * 0.2);
    default:
      return mix(base, t < 0.5 ? BLACK : WHITE, Math.abs(t - 0.5) * 0.3);
  }
}
