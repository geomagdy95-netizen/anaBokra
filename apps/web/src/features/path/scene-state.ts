import type { ScenePalette } from './palette';
import type { StationState, Vec3, World } from './types';

/** Props shared by the 3D scene and the 2D fallback. */
export interface PathSceneProps {
  world: World;
  /** Completed stations, 0..4. Station i is done if i < progress, current if i === progress. */
  progress: number;
  /** Focused target: 0..3 = station, 4 = end landmark, null = follow the current station. */
  focus: number | null;
  onFocus: (target: number | null) => void;
  palette: ScenePalette;
}

export const LANDMARK_INDEX = 4;

export function stationState(index: number, progress: number): StationState {
  return index < progress ? 'done' : index === progress ? 'current' : 'locked';
}

/** Which target the camera / highlight rests on. */
export function activeTarget(progress: number, focus: number | null): number {
  return focus ?? Math.min(progress, LANDMARK_INDEX);
}

export function targetPos(world: World, target: number): Vec3 {
  return target >= LANDMARK_INDEX ? world.landmark.pos : (world.stations[target]?.pos ?? world.landmark.pos);
}

/** Path parameter (0..1) up to which the road is drawn as "done". */
export function doneT(world: World, progress: number): number {
  if (progress <= 0) return 0;
  if (progress >= LANDMARK_INDEX) return 1;
  return world.stations[progress - 1]!.t;
}
