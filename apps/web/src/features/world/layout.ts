import { GROUP_ORDER, type GroupId } from './types';

/** World units. The ground (sea) is the XZ plane, Y is up, the camera looks toward -Z. */
export const CORE_RADIUS = 3.2;
export const ISLAND_RADIUS = 2.05;
/** Height of an island's top surface above the sea. */
export const ISLAND_TOP = 0.8;
/** Islands alternate between two ring radii so the archipelago doesn't look machine-made. */
const RING = [10.4, 11.6] as const;

export type XZ = readonly [number, number];

export interface IslandPlacement {
  id: GroupId;
  pos: XZ;
  /** Unit vector from the core to the island. */
  dir: XZ;
}

export function islandPlacements(): IslandPlacement[] {
  return GROUP_ORDER.map((id, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / GROUP_ORDER.length;
    const r = RING[i % 2]!;
    const dir: XZ = [Math.cos(angle), Math.sin(angle)];
    return { id, dir, pos: [dir[0] * r, dir[1] * r] };
  });
}

/** Furthest island edge from the centre, for camera framing and pan limits. */
export const WORLD_EXTENT = RING[1] + ISLAND_RADIUS;

/**
 * Where an island's landmark building stands, relative to the island centre: behind its icon, on the
 * back of the plateau, turned away from the bridge landing (islands below the core have their bridge
 * at the back).
 */
export function landmarkOffset(p: IslandPlacement): XZ {
  const landing = Math.atan2(-p.dir[1], -p.dir[0]);
  // Back of the island is -z (away from the camera), angle -π/2.
  const candidates = [-Math.PI / 2, (-Math.PI * 3) / 4, -Math.PI / 4];
  const away = (a: number) => Math.abs(Math.atan2(Math.sin(a - landing), Math.cos(a - landing)));
  const a = candidates.reduce((best, c) => (away(c) > away(best) + 0.3 ? c : best));
  return [Math.cos(a) * LANDMARK_DISTANCE, Math.sin(a) * LANDMARK_DISTANCE];
}

export const LANDMARK_DISTANCE = 0.98;
/** Groups whose landmark floats on the water beside the island (the felucca) instead of standing on it. */
export const ON_WATER: ReadonlySet<GroupId> = new Set(['tourism']);
/** Where a floating landmark sits, relative to the island centre: off the outer beach, in view. */
export const WATER_SPOT: XZ = [1.3, ISLAND_RADIUS + 0.45];
/** Plants keep this far from the landmark's centre. */
export const LANDMARK_CLEARANCE = 0.7;
