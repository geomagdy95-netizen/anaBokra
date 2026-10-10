import type { Riasec } from '@anabokra/engine';

/** [x, y, z]. Ground plane is XZ, Y is up. The journey runs from +z (start) to -z (end). */
export type Vec3 = readonly [number, number, number];

export type PropKind = 'rock' | 'shed' | 'crystal' | 'orb' | 'house' | 'lamp' | 'tower' | 'slab' | 'tree';

export type StationKind = 'interests' | 'personality' | 'values' | 'abilities';
export const STATION_KINDS: readonly StationKind[] = ['interests', 'personality', 'values', 'abilities'];

export type StationState = 'locked' | 'current' | 'done';

export interface WorldRegion {
  id: Riasec;
  /** The user's interest score, clamped to 0..1. */
  weight: number;
  /** [x, z] */
  center: readonly [number, number];
  radius: number;
  /** Number of grid cells this region dominates (its on-map size). */
  cells: number;
  /** Highest terrain point inside the region. */
  peak: number;
}

export interface PathPoint {
  x: number;
  y: number;
  z: number;
  /** 0 at the start, 1 at the end landmark; evenly spaced by arc length. */
  t: number;
}

export interface WorldStation {
  index: number;
  kind: StationKind;
  t: number;
  pos: Vec3;
}

export interface CareerSlot {
  /** 0 = best career. Slots sit in the user's strongest regions. */
  rank: number;
  region: Riasec;
  pos: Vec3;
  radius: number;
}

export interface WorldProp {
  kind: PropKind;
  region: Riasec | null;
  pos: Vec3;
  scale: number;
  /** Extra vertical stretch (towers, crystals). */
  stretch: number;
  rotY: number;
  /** 0..1 colour variation. */
  tint: number;
}

/** Plain, JSON-serialisable description of one user's world. */
export interface World {
  version: 1;
  seed: string;
  /** Grid nodes per side. */
  grid: number;
  /** World extent in units; x and z run from -size/2 to +size/2. */
  size: number;
  /** Distance between neighbouring grid nodes. */
  cell: number;
  /** grid*grid terrain heights, row-major (index = j*grid + i, x from i, z from j). */
  heights: number[];
  maxHeight: number;
  /** Per node: dominant region index into `regions` (RIASEC order), or -1 for neutral ground. */
  regionIndex: number[];
  /** Per node: 0..1 how strongly the dominant region tints the ground. */
  blend: number[];
  /** Per node: 0..1 colour variation. */
  tone: number[];
  regions: WorldRegion[];
  path: { points: PathPoint[]; length: number };
  stations: WorldStation[];
  landmark: { pos: Vec3; radius: number };
  slots: CareerSlot[];
  props: WorldProp[];
}

export interface WorldProfile {
  interests: Record<Riasec, number>;
}
