import { GROUP_ORDER, type GroupId } from './types';

/** World units. The ground (sea) is the XZ plane, Y is up, the camera looks toward -Z. */
export const CORE_RADIUS = 3.2;
export const ISLAND_RADIUS = 2.05;
/** Height of an island's top surface above the sea. */
export const ISLAND_TOP = 0.5;
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
