import type { WorldProfile } from './types';

/** Sample interest profiles (RIASEC, 0..1) for the dev page and tests. */
export const PRESETS = {
  scientist: { interests: { R: 0.3, I: 0.95, A: 0.45, S: 0.25, E: 0.2, C: 0.4 } },
  creative: { interests: { R: 0.2, I: 0.4, A: 0.95, S: 0.5, E: 0.45, C: 0.15 } },
  helper: { interests: { R: 0.2, I: 0.4, A: 0.35, S: 0.95, E: 0.4, C: 0.3 } },
  builder: { interests: { R: 0.95, I: 0.5, A: 0.2, S: 0.2, E: 0.35, C: 0.55 } },
  leader: { interests: { R: 0.25, I: 0.3, A: 0.3, S: 0.5, E: 0.95, C: 0.6 } },
} as const satisfies Record<string, WorldProfile>;

export type PresetId = keyof typeof PRESETS;
export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];
