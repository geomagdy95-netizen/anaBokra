/**
 * The world's look: golden-hour daylight over a turquoise sea. Sky, sea, light, clouds and the
 * drifting sunlit motes all read from here.
 */
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
  motes: { color: string; size: number; opacity: number; count: number };
}

export const WORLD_THEME: WorldTheme = {
  sky: { top: '#84B8D0', mid: '#D4E5E4', horizon: '#F9D5B3' },
  fog: { color: '#E8DDD1', near: 48, far: 124 },
  sea: { deep: '#0E5C73', mid: '#13808F', shallow: '#2FB8B2', shore: '#86E0CF', foam: '#FFFFFF', glint: '#FFF0CF', foamStrength: 0.85, glintStrength: 0.25 },
  hemi: { sky: '#EAF5F5', ground: '#5E8C8C', intensity: 0.85 },
  sun: { color: '#FFD3A0', intensity: 3.1, position: [-17, 14, 9] },
  rim: { color: '#FFE0C2', intensity: 0.6, position: [12, 9, -14] },
  env: 0.35,
  cloud: { color: '#FFFFFF', emissive: '#FFF1E6', glow: 0.4, amount: 0.3 },
  motes: { color: '#FFE7B0', size: 0.09, opacity: 0.55, count: 70 },
};
