import { createContext, useContext } from 'react';

/**
 * The world's two moods. Day is golden hour: a violet-to-apricot sky, a richer sea with sun glitter and
 * long warm light. Night: a deep violet sky with stars, a moonlit sea, lit windows, lanterns and
 * fireflies. Everything that changes between them lives here.
 */
export type WorldMood = 'day' | 'night';

/** Night from 7 p.m. to 6 a.m. on the user's own clock. */
export function moodAt(date: Date): WorldMood {
  const h = date.getHours();
  return h >= 19 || h < 6 ? 'night' : 'day';
}

export interface WorldTheme {
  /** Sky dome from the zenith down to the horizon. */
  sky: { top: string; mid: string; horizon: string };
  fog: { color: string; near: number; far: number };
  sea: { deep: string; mid: string; shallow: string; shore: string; foam: string; glint: string; foamStrength: number; glintStrength: number };
  hemi: { sky: string; ground: string; intensity: number };
  sun: { color: string; intensity: number; position: [number, number, number] };
  /** Back light that outlines islands and props. */
  rim: { color: string; intensity: number; position: [number, number, number] };
  env: number;
  /** `amount` scales how many cloud banks ring the horizon (0–1). */
  cloud: { color: string; emissive: string; glow: number; amount: number };
  /** Lit windows, beacons and lanterns. */
  lights: { color: string; glow: number };
  /** How strongly bridges glow. */
  bridgeGlow: number;
  stars: boolean;
  motes: { color: string; size: number; opacity: number; count: number };
}

export const WORLD_THEMES: Record<WorldMood, WorldTheme> = {
  day: {
    sky: { top: '#8C78E3', mid: '#D8B4E8', horizon: '#FFD9B8' },
    fog: { color: '#F7DCCB', near: 46, far: 118 },
    sea: { deep: '#0E5C73', mid: '#13808F', shallow: '#2FB8B2', shore: '#86E0CF', foam: '#FFFFFF', glint: '#FFF0CF', foamStrength: 0.85, glintStrength: 0.25 },
    hemi: { sky: '#FFF2E2', ground: '#5E8C8C', intensity: 0.85 },
    sun: { color: '#FFD3A0', intensity: 3.1, position: [-17, 14, 9] },
    rim: { color: '#FFE0C2', intensity: 0.6, position: [12, 9, -14] },
    env: 0.35,
    cloud: { color: '#FFFFFF', emissive: '#FFF1E6', glow: 0.4, amount: 0.3 },
    lights: { color: '#FFD27A', glow: 0.2 },
    bridgeGlow: 1,
    stars: false,
    motes: { color: '#FFE7B0', size: 0.09, opacity: 0.55, count: 70 },
  },
  night: {
    sky: { top: '#0C0824', mid: '#24155A', horizon: '#4A2E7E' },
    fog: { color: '#2B1B5C', near: 40, far: 112 },
    sea: { deep: '#141038', mid: '#231F57', shallow: '#244C6E', shore: '#3D6F8E', foam: '#B9C8FF', glint: '#8FA6F0', foamStrength: 0.45, glintStrength: 0.22 },
    hemi: { sky: '#4A4A9A', ground: '#120B2E', intensity: 0.75 },
    sun: { color: '#A9BCFF', intensity: 1.15, position: [14, 18, 8] },
    rim: { color: '#7C5CFF', intensity: 0.9, position: [-12, 8, -14] },
    env: 0.16,
    cloud: { color: '#3A2D78', emissive: '#2B2066', glow: 0.55, amount: 0.45 },
    lights: { color: '#FFC66B', glow: 1.6 },
    bridgeGlow: 1.9,
    stars: true,
    motes: { color: '#FFE97A', size: 0.12, opacity: 0.95, count: 110 },
  },
};

export const MoodContext = createContext<WorldMood>('day');

export const useWorldTheme = (): WorldTheme => WORLD_THEMES[useContext(MoodContext)];
