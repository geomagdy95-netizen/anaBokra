'use client';

import { createContext, useCallback, useContext } from 'react';
import { Color, MeshStandardMaterial } from 'three';

/** Brand palette (identity guide). */
export const BRAND = {
  violet: '#7025B5',
  apricot: '#FFA366',
  plum: '#291137',
  ivory: '#FBF7F0',
  /** Logo artwork colours (slightly different from the palette swatches). */
  logoPlum: '#360847',
  logoApricot: '#FB9D5D',
} as const;

/** World colours, derived from the brand: lavender sea and sky, cream islands, toy-like props. */
export const SCENE = {
  skyTop: '#CDBDF2',
  horizon: '#EFE9FB',
  sea: '#CBBDF0',
  cloud: '#FFFFFF',
  islandTop: '#FBF4E8',
  islandSide: '#EADBC3',
  plank: '#F6EAD5',
  plankShade: '#E7D6BA',
  rail: '#E9D9BD',
  lavender: '#C9B2F0',
  lilac: '#9D73DB',
  tree: '#6F9A5B',
  treeDark: '#557F47',
  trunk: '#9A7352',
} as const;

const MUTE_TOWARD = new Color('#D9D4E4');

/** Desaturated, slightly lavender version of a colour, for islands outside the current suggestions. */
export function muteColor(hex: string): Color {
  const c = new Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s * 0.3, hsl.l * 0.82 + 0.1);
  return c.lerp(MUTE_TOWARD, 0.22);
}

export interface ToyOptions {
  rough?: number;
  /** 0..1 self-glow in the material's own colour. */
  glow?: number;
  opacity?: number;
}

const cache = new Map<string, MeshStandardMaterial>();

/** Shared, cached "toy" material: matte-glossy plastic in a flat colour. */
export function toy(hex: string, muted = false, o: ToyOptions = {}): MeshStandardMaterial {
  const key = `${hex}|${muted ? 1 : 0}|${o.rough ?? ''}|${o.glow ?? ''}|${o.opacity ?? ''}`;
  let m = cache.get(key);
  if (!m) {
    const color = muted ? muteColor(hex) : new Color(hex);
    const opacity = o.opacity ?? 1;
    m = new MeshStandardMaterial({
      color,
      roughness: o.rough ?? 0.45,
      metalness: 0,
      emissive: o.glow ? color.clone() : new Color(0x000000),
      emissiveIntensity: o.glow ?? 0,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 1,
    });
    cache.set(key, m);
  }
  return m;
}

/** Islands outside the current suggestions render their props muted. */
export const MutedContext = createContext(false);

export function useToy() {
  const muted = useContext(MutedContext);
  return useCallback((hex: string, o?: ToyOptions) => toy(hex, muted, o), [muted]);
}
