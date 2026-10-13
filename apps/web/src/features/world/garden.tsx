'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BufferAttribute,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  IcosahedronGeometry,
  MeshStandardMaterial,
  Object3D,
  Shape,
  ShapeGeometry,
  type BufferGeometry,
  type Group,
  type InstancedMesh,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { hashSeed, mulberry32 } from '../path/rng';
import { CORE_RADIUS, ISLAND_RADIUS, ISLAND_TOP, LANDMARK_CLEARANCE, landmarkOffset, ON_WATER, type IslandPlacement, type XZ } from './layout';
import { BRAND, muteColor, SCENE, toy } from './materials';

/**
 * Islands grow with progress (docs/product/world-spec.md: the core "keeps growing"; each path island
 * fills in as its Verify tasks are done). Every island has a fixed, seeded set of spots for trees,
 * bushes and flowers; growth (0–1) decides how many are shown, so things are only ever added, never
 * moved. New ones spring up. A checked path gets a small flag: "explored", never a grade.
 */

const dummy = new Object3D();

// --- Shared geometry ----------------------------------------------------------

function colored(g: BufferGeometry, hex: string): BufferGeometry {
  const c = new Color(hex);
  const n = g.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new BufferAttribute(arr, 3));
  return g;
}

function merged(parts: [BufferGeometry, string][]): BufferGeometry {
  const list = parts.map(([g, hex]) => colored(g.toNonIndexed(), hex));
  const out = mergeGeometries(list)!;
  list.forEach((g) => g.dispose());
  parts.forEach(([g]) => g.dispose());
  return out;
}

export function pineGeometry(): BufferGeometry {
  return merged([
    [new CylinderGeometry(0.045, 0.06, 0.26, 6).translate(0, 0.13, 0), SCENE.trunk],
    [new ConeGeometry(0.27, 0.5, 7).translate(0, 0.45, 0), SCENE.treeDark],
    [new ConeGeometry(0.2, 0.4, 7).translate(0, 0.74, 0), SCENE.tree],
  ]);
}

/** A round, slightly lumpy bush made of three blobs. */
function bushGeometry(): BufferGeometry {
  return merged([
    [new IcosahedronGeometry(0.17, 1).scale(1, 0.8, 1).translate(0, 0.12, 0), '#8DBF72'],
    [new IcosahedronGeometry(0.13, 1).scale(1, 0.8, 1).translate(0.14, 0.09, 0.03), '#7FB566'],
    [new IcosahedronGeometry(0.12, 1).scale(1, 0.8, 1).translate(-0.12, 0.08, -0.04), '#9BC97F'],
  ]);
}

/** A small patch of three flowers on a leafy tuft; the heads take the instance colour. */
function flowerGeometry(): BufferGeometry {
  const parts: [BufferGeometry, string][] = [[new IcosahedronGeometry(0.1, 1).scale(1.3, 0.45, 1.1).translate(0, 0.03, 0), '#8DBF72']];
  for (const [x, z, h] of [
    [0, 0, 0.2],
    [0.09, 0.05, 0.15],
    [-0.08, 0.06, 0.13],
  ] as const) {
    parts.push([new CylinderGeometry(0.012, 0.012, h, 4).translate(x, h / 2, z), '#7FB566']);
    parts.push([new IcosahedronGeometry(0.06, 1).translate(x, h + 0.03, z), '#FFFFFF']);
  }
  return merged(parts);
}

const FLOWER_COLORS = ['#F7B6D2', '#FFC08A', '#FFFFFF', '#C9A8F5', '#FFE08A'] as const;

// --- Spots --------------------------------------------------------------------

export type GrowthKind = 'tree' | 'bush' | 'flower';

export interface GrowthSpot {
  /** Stable id: island, kind and index. New spots spring up; known ones stay put. */
  key: string;
  kind: GrowthKind;
  x: number;
  y: number;
  z: number;
  s: number;
  rot: number;
  color: string;
  muted: boolean;
}

interface Ring {
  min: number;
  max: number;
}

/**
 * Seeded spots on one island's plateau: in a ring around the landmark, away from the front edge
 * (where the label sits) and from each other. Returned in growth order.
 */
function spotsOn(
  seed: string,
  center: XZ,
  ring: Ring,
  kind: GrowthKind,
  count: number,
  taken: { x: number; z: number }[],
  { avoid = [], front = 0.55, blocked = [] }: { avoid?: number[]; front?: number; blocked?: { x: number; z: number; r: number }[] } = {},
): Omit<GrowthSpot, 'muted' | 'y'>[] {
  const rng = mulberry32(hashSeed(`${seed}:${kind}`));
  const gap = kind === 'tree' ? 0.42 : kind === 'bush' ? 0.34 : 0.26;
  const out: Omit<GrowthSpot, 'muted' | 'y'>[] = [];
  let guard = 0;
  while (out.length < count && guard++ < 400) {
    const a = rng() * Math.PI * 2;
    const r = ring.min + rng() * (ring.max - ring.min);
    const s = kind === 'tree' ? 0.75 + rng() * 0.5 : kind === 'bush' ? 0.8 + rng() * 0.5 : 0.8 + rng() * 0.6;
    const rot = rng() * Math.PI * 2;
    const color = FLOWER_COLORS[Math.floor(rng() * FLOWER_COLORS.length)]!;
    if (Math.sin(a) > front) continue; // the front sector, facing the camera, keeps the label clear
    // Bridge landings: the deck is about 0.6 wide where it meets the plateau.
    if (avoid.some((b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) * r < 0.42)) continue;
    const x = center[0] + Math.cos(a) * r;
    const z = center[1] + Math.sin(a) * r;
    if (taken.some((t) => Math.hypot(t.x - x, t.z - z) < gap)) continue;
    if (blocked.some((b) => Math.hypot(b.x - x, b.z - z) < b.r)) continue;
    taken.push({ x, z });
    out.push({ key: `${seed}:${kind}:${out.length}`, kind, x, z, s, rot, color });
  }
  return out;
}

const MAX = { tree: 7, bush: 4, flower: 12 } as const;

/** How many of each kind show at a growth level: a couple of trees from the start, flowers last. */
export function growthCounts(growth: number): Record<GrowthKind, number> {
  const g = Math.min(1, Math.max(0, growth));
  return {
    tree: 2 + Math.round(g * (MAX.tree - 2)),
    bush: Math.round(Math.max(0, g - 0.15) / 0.85 * MAX.bush),
    flower: Math.round(Math.max(0, g - 0.3) / 0.7 * MAX.flower),
  };
}

const CORE_ANGLES = (placements: IslandPlacement[]) => placements.map((p) => Math.atan2(p.dir[1], p.dir[0]));

/** Every spot to show across the world, for the islands' growth levels. */
export function growthSpots(
  placements: IslandPlacement[],
  islands: Record<string, { growth: number; muted: boolean }>,
  coreGrowth: number,
): GrowthSpot[] {
  const out: GrowthSpot[] = [];
  for (const p of placements) {
    const isl = islands[p.id];
    if (!isl) continue;
    const n = growthCounts(isl.growth);
    const taken: { x: number; z: number }[] = [];
    const landing = Math.atan2(-p.dir[1], -p.dir[0]);
    const lm = landmarkOffset(p);
    const blocked = ON_WATER.has(p.id) ? [] : [{ x: p.pos[0] + lm[0], z: p.pos[1] + lm[1], r: LANDMARK_CLEARANCE }];
    // Trees on the rim, bushes and flowers between the rim and the landmark.
    const plateau = { min: ISLAND_RADIUS * 0.52, max: ISLAND_RADIUS * 0.74 };
    const inner = { min: ISLAND_RADIUS * 0.42, max: ISLAND_RADIUS * 0.72 };
    const all = [
      ...spotsOn(p.id, p.pos, plateau, 'tree', MAX.tree, taken, { avoid: [landing], blocked }),
      ...spotsOn(p.id, p.pos, inner, 'bush', MAX.bush, taken, { avoid: [landing], blocked }),
      ...spotsOn(p.id, p.pos, inner, 'flower', MAX.flower, taken, { avoid: [landing], blocked }),
    ];
    for (const kind of ['tree', 'bush', 'flower'] as const)
      all.filter((s) => s.kind === kind).slice(0, n[kind]).forEach((s) => out.push({ ...s, y: ISLAND_TOP, muted: isl.muted }));
  }
  // The core: a ring around its raised tier, clear of the twelve bridge landings.
  const n = growthCounts(coreGrowth);
  const taken: { x: number; z: number }[] = [];
  const ring = { min: 2.3, max: CORE_RADIUS - 0.45 };
  // The "Me" label sits on the very front of the core only, so its clear sector is narrower.
  const opts = { avoid: CORE_ANGLES(placements), front: 0.85 };
  const core = [
    ...spotsOn('core', [0, 0], ring, 'tree', MAX.tree + 3, taken, opts),
    ...spotsOn('core', [0, 0], ring, 'bush', MAX.bush, taken, opts),
    ...spotsOn('core', [0, 0], ring, 'flower', MAX.flower, taken, opts),
  ];
  const coreN = { ...n, tree: n.tree + Math.round(Math.min(1, coreGrowth) * 3) };
  for (const kind of ['tree', 'bush', 'flower'] as const)
    core.filter((s) => s.kind === kind).slice(0, coreN[kind]).forEach((s) => out.push({ ...s, y: ISLAND_TOP, muted: false }));
  return out;
}

// --- Rendering ----------------------------------------------------------------

const GROW_SECONDS = 0.7;

/** Ease out with a small overshoot, so new plants pop up. */
function springUp(t: number): number {
  const c = 1.9;
  const x = Math.min(1, Math.max(0, t)) - 1;
  return 1 + (c + 1) * x * x * x + c * x * x;
}

/**
 * One instanced mesh for a kind of plant. Spots seen on the first render appear at once; spots added
 * later (more progress) spring up over GROW_SECONDS.
 */
function Plants({ spots, geometry, shadows, animate, tinted }: { spots: GrowthSpot[]; geometry: BufferGeometry; shadows: boolean; animate: boolean; tinted: boolean }) {
  const ref = useRef<InstancedMesh>(null);
  const mat = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  const born = useRef<Map<string, number> | null>(null);
  const growing = useRef(false);

  const place = (now: number) => {
    const mesh = ref.current;
    if (!mesh) return false;
    let still = false;
    const white = new Color('#FFFFFF');
    spots.forEach((s, i) => {
      const t0 = born.current?.get(s.key) ?? -Infinity;
      const k = animate ? springUp((now - t0) / GROW_SECONDS) : 1;
      if (k < 1 || now - t0 < GROW_SECONDS) still = true;
      dummy.position.set(s.x, s.y, s.z);
      dummy.rotation.set(0, s.rot, 0);
      dummy.scale.setScalar(Math.max(0.0001, s.s * k));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const base = tinted ? new Color(s.color) : white.clone();
      mesh.setColorAt(i, s.muted ? muteColor(`#${base.getHexString()}`) : base);
    });
    mesh.count = spots.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return still;
  };

  // New spots get a birth time; the first set is "always there".
  useLayoutEffect(() => {
    const now = performance.now() / 1000;
    if (!born.current) born.current = new Map(spots.map((s) => [s.key, -Infinity]));
    else for (const s of spots) if (!born.current.has(s.key)) born.current.set(s.key, now);
    growing.current = place(now);
  });

  useFrame(() => {
    if (growing.current) growing.current = place(performance.now() / 1000);
  });

  return <instancedMesh ref={ref} args={[geometry, mat, 240]} castShadow={shadows} receiveShadow={shadows} frustumCulled={false} />;
}

export function Garden({ spots, shadows, animate }: { spots: GrowthSpot[]; shadows: boolean; animate: boolean }) {
  const geos = useMemo(() => ({ tree: pineGeometry(), bush: bushGeometry(), flower: flowerGeometry() }), []);
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);
  const by = (kind: GrowthKind) => spots.filter((s) => s.kind === kind);
  return (
    <>
      <Plants spots={by('tree')} geometry={geos.tree} shadows={shadows} animate={animate} tinted={false} />
      <Plants spots={by('bush')} geometry={geos.bush} shadows={shadows} animate={animate} tinted={false} />
      <Plants spots={by('flower')} geometry={geos.flower} shadows={false} animate={animate} tinted />
    </>
  );
}

// --- Flag ---------------------------------------------------------------------

function pennant(): Shape {
  const s = new Shape();
  s.moveTo(0, 0);
  s.lineTo(0.42, -0.13);
  s.lineTo(0, -0.26);
  s.lineTo(0, 0);
  return s;
}

/** "You checked this path": a small violet flag at the back of the island, waving gently. */
export function Flag({ at, animate }: { at: XZ; animate: boolean }) {
  const cloth = useRef<Group>(null);
  const geo = useMemo(() => new ShapeGeometry(pennant()), []);
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame(({ clock }) => {
    if (animate && cloth.current) cloth.current.rotation.y = Math.sin(clock.elapsedTime * 2.2 + at[0]) * 0.25;
  });
  return (
    <group position={[at[0], ISLAND_TOP, at[1]]}>
      <mesh position={[0, 0.55, 0]} material={toy('#F4EDE2')}>
        <cylinderGeometry args={[0.025, 0.03, 1.1, 8]} />
      </mesh>
      <mesh position={[0, 1.12, 0]} material={toy(BRAND.apricot, false, { glow: 0.1 })}>
        <sphereGeometry args={[0.05, 12, 8]} />
      </mesh>
      <group ref={cloth} position={[0, 1.06, 0]}>
        <mesh geometry={geo}>
          <meshStandardMaterial color={BRAND.violet} emissive={BRAND.violet} emissiveIntensity={0.15} side={DoubleSide} roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

/** Where a checked island's flag stands: on the left of its plateau, beside the landmark, in view. */
export function flagSpot(p: IslandPlacement): XZ {
  return [p.pos[0] - ISLAND_RADIUS * 0.6, p.pos[1] - ISLAND_RADIUS * 0.12];
}
