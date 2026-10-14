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

/**
 * The twelve spots round the core (index j sits at -90° + j·30°; -90° is straight back), in the order
 * islands take them: the first three spread evenly (back, front right, front left), then the gaps
 * between them, then the rest. So a map of three looks balanced and adding a field never moves one.
 */
export const SLOT_ORDER = [0, 4, 8, 2, 6, 10, 1, 5, 9, 3, 7, 11] as const;

/** Spot j on the ring. The first three slots sit closer in (short bridges, a compact first map). */
const spot = (j: number, rank?: number): XZ => {
  const angle = -Math.PI / 2 + (j * 2 * Math.PI) / GROUP_ORDER.length;
  const r = rank === undefined ? RING[j % 2]! : rank < 3 ? 8.8 : rank < 6 ? 10.4 : 11.6;
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

/** Framing extent for default and user-arranged island positions (sea, clouds, the full map). */
export const WORLD_EXTENT = 16.8;

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
export const ARRANGE_RING = [6.2, 14.5] as const;

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
