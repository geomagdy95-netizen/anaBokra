import { GROUP_ORDER, type GroupId } from './types';

/** World units. The ground (sea) is the XZ plane, Y is up, the camera looks toward -Z. */
/** My island: bigger than the field islands, so its Discover stations fit round its rim. */
export const CORE_RADIUS = 3.8;
export const ISLAND_RADIUS = 2.05;
/** Height of an island's top surface above the sea. */
export const ISLAND_TOP = 0.8;
/**
 * Islands alternate between two ring radii, so neighbours 20° apart (18 spots) stay clear of each
 * other and the archipelago doesn't look machine-made.
 */
const RING = [14.4, 16.4] as const;

export type XZ = readonly [number, number];

export interface IslandPlacement {
  id: GroupId;
  pos: XZ;
  /** Unit vector from the core to the island. */
  dir: XZ;
}

/**
 * The eighteen spots round the core (index j sits at -90° + j·20°; -90° is straight back), in the
 * order islands take them: the first three spread evenly (back, front right, front left), then the
 * gaps between them, then the rest. So a map of three looks balanced and adding a field never moves one.
 */
export const SLOT_ORDER = [0, 6, 12, 3, 9, 15, 1, 7, 13, 4, 10, 16, 2, 8, 14, 5, 11, 17] as const;

/**
 * Spot j on the ring. The first six slots sit closer in (short bridges, a compact first map, 60°
 * apart, with room for their career islets); later ones go out to the ring, alternating radius with
 * their neighbours.
 */
const spot = (j: number, rank?: number): XZ => {
  const angle = -Math.PI / 2 + (j * 2 * Math.PI) / GROUP_ORDER.length;
  const r = rank === undefined || rank >= 6 ? RING[j % 2]! : 8.8;
  return [Math.cos(angle) * r, Math.sin(angle) * r];
};

/**
 * Where each island stands: where the user dragged it, else its slot (order of appearance on the
 * map), else its fixed place in GROUP_ORDER (the dev world, which shows every island).
 */
export function islandPlacements(positions: Partial<Record<GroupId, XZ>> = {}, slots: Partial<Record<GroupId, number>> = {}): IslandPlacement[] {
  return GROUP_ORDER.map((id, i) => {
    const slot = slots[id];
    const pos = positions[id] ?? (slot !== undefined ? spot(SLOT_ORDER[slot % SLOT_ORDER.length]!, slot) : spot(i));
    const length = Math.hypot(pos[0], pos[1]) || 1;
    return { id, dir: [pos[0] / length, pos[1] / length], pos };
  });
}

/** How far in from the core's edge the Discover stations stand. */
export const STATION_RADIUS = CORE_RADIUS - 0.8;

/**
 * Discover stations round my island, in order. They start half a step past the front (where the "me"
 * label sits, facing the camera) and go round, so the path starts and ends at the user's name.
 */
export function stationSpots(count: number): XZ[] {
  return Array.from({ length: count }, (_, k) => {
    const a = Math.PI / 2 + ((k + 0.5) * 2 * Math.PI) / count;
    return [Math.cos(a) * STATION_RADIUS, Math.sin(a) * STATION_RADIUS] as const;
  });
}

/** L2 career islets: small islands fanned out behind a group island, away from the core. */
export const ISLET_RADIUS = 0.62;
const ISLET_DISTANCE = ISLAND_RADIUS + 1.8;

/**
 * Where a group's career islets stand, behind the group island (the side away from the core, so they
 * never sit on its bridge): the first two to either side, the third further out straight behind (clear
 * of the landmark), then two more beyond the first pair. Wide enough apart to see, and kept inside the
 * gap to the neighbouring islands.
 */
const ISLET_SPOTS = [
  { a: 0.95, d: 0 },
  { a: -0.95, d: 0 },
  { a: 0, d: 1.5 },
  { a: 0.5, d: 2.6 },
  { a: -0.5, d: 2.6 },
] as const;

export function isletPlacements(group: IslandPlacement, count: number): { pos: XZ; dir: XZ }[] {
  const base = Math.atan2(group.dir[1], group.dir[0]);
  return Array.from({ length: count }, (_, i) => {
    const spot = ISLET_SPOTS[i % ISLET_SPOTS.length]!;
    const far = ISLET_DISTANCE + spot.d + Math.floor(i / ISLET_SPOTS.length) * 1.6;
    const dir: XZ = [Math.cos(base + spot.a), Math.sin(base + spot.a)];
    return { dir, pos: [group.pos[0] + dir[0] * far, group.pos[1] + dir[1] * far] };
  });
}

/** Framing extent for default and user-arranged island positions (sea, clouds, the full map). */
export const WORLD_EXTENT = 20.5;

/** How far the camera must take in: the islands on the map, or just the core when it is alone. */
export function mapExtent(placements: readonly IslandPlacement[]): number {
  const far = Math.max(0, ...placements.map((p) => Math.hypot(p.pos[0], p.pos[1]) + ISLAND_RADIUS));
  return Math.max(CORE_RADIUS + 3, far + 0.8);
}

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
/** Plants keep this far from the landmark's centre. */
export const LANDMARK_CLEARANCE = 0.7;

/** How close (centre to centre) a moved island may come to the others and to the core. */
const ISLAND_GAP = ISLAND_RADIUS * 2 + 0.9;
const CORE_GAP = CORE_RADIUS + ISLAND_RADIUS + 1.6;
/** Moved islands stay in this ring round the core. */
export const ARRANGE_RING = [6.2, 17.5] as const;

const fits = (x: number, z: number, others: readonly IslandPlacement[]) => {
  const r = Math.hypot(x, z);
  return r >= Math.max(ARRANGE_RING[0], CORE_GAP) - 1e-9 && r <= ARRANGE_RING[1] + 1e-9 && others.every((o) => Math.hypot(x - o.pos[0], z - o.pos[1]) >= ISLAND_GAP - 1e-9);
};

/**
 * Where a dropped island actually lands: nudged out of any island it overlaps, kept clear of the core
 * and inside the archipelago ring. If nudging can't find room (a crowded corner), it takes the free
 * spot nearest the drop; with none at all, the island stays where it was.
 */
export function clearSpot(id: GroupId, x: number, z: number, placements: readonly IslandPlacement[]): XZ {
  const others = placements.filter((p) => p.id !== id);
  let px = x;
  let pz = z;
  for (let pass = 0; pass < 12 && !fits(px, pz, others); pass++) {
    for (const o of others) {
      const dx = px - o.pos[0];
      const dz = pz - o.pos[1];
      const d = Math.hypot(dx, dz);
      if (d >= ISLAND_GAP) continue;
      // Exactly on top: push straight outward from the core instead.
      const out = Math.hypot(...o.pos) || 1;
      const [ux, uz] = d > 1e-3 ? [dx / d, dz / d] : [o.pos[0] / out, o.pos[1] / out];
      px = o.pos[0] + ux * ISLAND_GAP;
      pz = o.pos[1] + uz * ISLAND_GAP;
    }
    const r = Math.hypot(px, pz) || 1;
    const clamped = Math.max(Math.max(ARRANGE_RING[0], CORE_GAP), Math.min(ARRANGE_RING[1], r));
    px *= clamped / r;
    pz *= clamped / r;
  }
  if (fits(px, pz, others)) return [px, pz];
  let best: XZ | null = null;
  for (let r = Math.max(ARRANGE_RING[0], CORE_GAP); r <= ARRANGE_RING[1]; r += 0.5)
    for (let a = 0; a < 360; a += 6) {
      const cx = Math.cos((a * Math.PI) / 180) * r;
      const cz = Math.sin((a * Math.PI) / 180) * r;
      if (fits(cx, cz, others) && (!best || Math.hypot(cx - x, cz - z) < Math.hypot(best[0] - x, best[1] - z))) best = [cx, cz];
    }
  return best ?? placements.find((p) => p.id === id)?.pos ?? [x, z];
}
