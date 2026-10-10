import type { StationId } from '@/server/assessment/config';

/**
 * Station preview data (C3): everything the hub / intro shows about a station that is not a
 * translated string. Item counts come from the server's progress (instrument-derived); time is
 * estimated from `secondsPerItem`. Text lives in messages (Assessment.stations.<id>).
 */
export interface StationUi {
  id: StationId;
  /** Position on the journey. */
  order: number;
  /** How the station is played. */
  mode: 'swipe' | 'scale' | 'sort' | 'form';
  secondsPerItem: number;
  /** Index on the 3D / 2D path (0..3); the optional context stop is not on the map. */
  mapIndex: number | null;
  optional: boolean;
}

export const STATION_UI: readonly StationUi[] = [
  { id: 'interests', order: 0, mode: 'swipe', secondsPerItem: 5, mapIndex: 0, optional: false },
  { id: 'personality', order: 1, mode: 'scale', secondsPerItem: 6, mapIndex: 1, optional: false },
  { id: 'values', order: 2, mode: 'sort', secondsPerItem: 10, mapIndex: 2, optional: false },
  { id: 'abilities', order: 3, mode: 'scale', secondsPerItem: 9, mapIndex: 3, optional: false },
  { id: 'context', order: 4, mode: 'form', secondsPerItem: 20, mapIndex: null, optional: true },
];

export const stationUi = (id: string): StationUi | undefined => STATION_UI.find((s) => s.id === id);

export const estimateMinutes = (ui: StationUi, items: number): number => Math.max(1, Math.round((ui.secondsPerItem * items) / 60));

/** Number of completed required stations on the 4-stop map (0..4). */
export function mapProgress(doneIds: readonly string[]): number {
  return STATION_UI.filter((s) => s.mapIndex !== null && doneIds.includes(s.id)).length;
}

export function nextStationAfter(id: string): StationUi | null {
  const cur = stationUi(id);
  return cur ? (STATION_UI.find((s) => s.order === cur.order + 1) ?? null) : null;
}
