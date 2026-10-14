'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { BufferAttribute, Color, IcosahedronGeometry, MeshStandardMaterial, Object3D, type BufferGeometry, type InstancedMesh } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

import { hashSeed, mulberry32 } from '../path/rng';
import { outline } from './geometry';
import { CORE_RADIUS, ISLAND_RADIUS, ISLAND_TOP, type IslandPlacement } from './layout';
import { muteColor } from './materials';

/**
 * Rocky island sides in the diorama style: every island stands on rings of weathered boulders that
 * run from under the water up to the grass, with mossy tops, plus a few outcrops in the sea. Boulders
 * are three shared, noise-shaped rock shapes drawn as instances, so the whole world is three draw calls.
 */

const dummy = new Object3D();
const VARIANTS = 3;

/** A lumpy rock: a sphere pushed in and out by seeded noise, flattened a little, with moss on top. */
function rockGeometry(seed: number): BufferGeometry {
  const rng = mulberry32(seed);
  const g = mergeVertices(new IcosahedronGeometry(1, 2).deleteAttribute('normal').deleteAttribute('uv'));
  const pos = g.getAttribute('position');
  const waves = Array.from({ length: 4 }, () => ({ x: rng() * 2 - 1, y: rng() * 2 - 1, z: rng() * 2 - 1, f: 1.2 + rng() * 2.2, p: rng() * 6.28 }));
  const flat = 0.9 + rng() * 0.15;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    let k = 1;
    for (const w of waves) k += Math.sin((x * w.x + y * w.y + z * w.z) * w.f + w.p) * 0.13;
    // Facets: snap toward flat planes so it reads as cut stone, not a blob; flatter on top.
    k = Math.round(k * 6) / 6;
    if (y > 0.55) k *= 0.92;
    pos.setXYZ(i, x * k, y * k * flat, z * k);
  }
  g.computeVertexNormals();
  const n = g.getAttribute('normal');
  const colors = new Float32Array(pos.count * 3);
  const stone = new Color('#C9B99F');
  const dark = new Color('#89765E');
  const moss = new Color('#8D9254');
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const up = n.getY(i);
    c.copy(dark).lerp(stone, Math.min(1, Math.max(0, 0.55 + pos.getY(i) * 0.6 + (rng() - 0.5) * 0.2)));
    if (up > 0.72) c.lerp(moss, Math.min(1, (up - 0.72) * 3.2) * 0.85);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  return g;
}

interface Boulder {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  rx: number;
  ry: number;
  variant: number;
  tint: number;
  muted: boolean;
}

interface IslandRing {
  seed: string;
  x: number;
  z: number;
  R: number;
  wobble: number;
  landAt: number[];
  muted: boolean;
}

/** Rings of boulders round one island, bottom (half under water) to top (just under the grass lip). */
function ringBoulders(isl: IslandRing, layers: number): Boulder[] {
  const shape = outline(isl.seed, isl.wobble, isl.landAt);
  const rng = mulberry32(hashSeed(`cliff:${isl.seed}`));
  const out: Boulder[] = [];
  // Big upright stones at the waterline, smaller ones toward the grass; sizes vary a lot.
  const rows = [
    { inset: 0.02, y: 0.12, min: 0.42, max: 0.8, tall: 1.25 },
    { inset: 0.16, y: ISLAND_TOP * 0.55, min: 0.32, max: 0.55, tall: 1.1 },
    { inset: 0.3, y: ISLAND_TOP - 0.32, min: 0.24, max: 0.4, tall: 0.75 },
  ].slice(3 - layers);
  for (const row of rows) {
    const step = (row.min + row.max) * 0.55;
    const n = Math.round((2 * Math.PI * isl.R) / step);
    const turn = rng() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = turn + ((i + (rng() - 0.5) * 0.5) / n) * Math.PI * 2;
      const r = isl.R * shape(a) - row.inset;
      const s = row.min + rng() * (row.max - row.min);
      out.push({
        x: isl.x + Math.cos(a) * r,
        y: row.y + (rng() - 0.5) * 0.16,
        z: isl.z + Math.sin(a) * r,
        sx: s * (0.85 + rng() * 0.4),
        sy: s * row.tall * (0.8 + rng() * 0.45),
        sz: s * (0.75 + rng() * 0.3),
        rx: (rng() - 0.5) * 0.5,
        ry: rng() * Math.PI * 2,
        variant: Math.floor(rng() * VARIANTS),
        tint: rng(),
        muted: isl.muted,
      });
    }
  }
  return out;
}

/** A few rocky outcrops in the sea near an island, kept off the bridge line and the label side. */
function outcrops(isl: IslandRing, count: number): Boulder[] {
  const rng = mulberry32(hashSeed(`outcrop:${isl.seed}`));
  const out: Boulder[] = [];
  let tries = 0;
  while (out.length < count && tries++ < 60) {
    const a = rng() * Math.PI * 2;
    const apart = (b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    if (isl.landAt.some((b) => apart(b) < 0.7) || apart(Math.PI / 2) < 0.5) continue;
    const r = isl.R + 0.75 + rng() * 0.9;
    const s = 0.22 + rng() * 0.22;
    const base = { x: isl.x + Math.cos(a) * r, z: isl.z + Math.sin(a) * r, variant: Math.floor(rng() * VARIANTS), muted: isl.muted };
    out.push({ ...base, y: 0.02, sx: s * 1.3, sy: s * 1.1, sz: s, rx: 0, ry: rng() * 6.28, tint: rng() });
    out.push({ ...base, x: base.x + (rng() - 0.5) * s * 1.6, z: base.z + (rng() - 0.5) * s * 1.6, y: -0.02, sx: s * 0.6, sy: s * 0.5, sz: s * 0.6, rx: 0.2, ry: rng() * 6.28, tint: rng() });
  }
  return out;
}

export function cliffBoulders(placements: IslandPlacement[], muted: Record<string, boolean>, quality: 'high' | 'low'): Boulder[] {
  const layers = quality === 'high' ? 3 : 2;
  const islands: IslandRing[] = [
    { seed: 'core', x: 0, z: 0, R: CORE_RADIUS, wobble: 0.025, landAt: placements.map((p) => Math.atan2(p.dir[1], p.dir[0])), muted: false },
    ...placements.map((p) => ({ seed: p.id, x: p.pos[0], z: p.pos[1], R: ISLAND_RADIUS, wobble: 0.06, landAt: [Math.atan2(-p.dir[1], -p.dir[0])], muted: Boolean(muted[p.id]) })),
  ];
  return islands.flatMap((isl) => [...ringBoulders(isl, layers), ...(isl.seed === 'core' ? [] : outcrops(isl, quality === 'high' ? 2 : 1))]);
}

const LIGHT = new Color('#E8D3B0');
const SHADE = new Color('#B68E65');

export function Cliffs({ placements, muted, quality, shadows }: { placements: IslandPlacement[]; muted: Record<string, boolean>; quality: 'high' | 'low'; shadows: boolean }) {
  const boulders = useMemo(() => cliffBoulders(placements, muted, quality), [placements, muted, quality]);
  const geos = useMemo(() => Array.from({ length: VARIANTS }, (_, i) => rockGeometry(hashSeed(`rock-shape-${i}`))), []);
  const mat = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, flatShading: true }), []);
  useEffect(() => () => (geos.forEach((g) => g.dispose()), mat.dispose()), [geos, mat]);
  const byVariant = useMemo(() => geos.map((_, v) => boulders.filter((b) => b.variant === v)), [geos, boulders]);
  return (
    <>
      {geos.map((g, v) => (
        <BoulderSet key={v} geometry={g} material={mat} boulders={byVariant[v]!} shadows={shadows} />
      ))}
    </>
  );
}

function BoulderSet({ geometry, material, boulders, shadows }: { geometry: BufferGeometry; material: MeshStandardMaterial; boulders: Boulder[]; shadows: boolean }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const c = new Color();
    boulders.forEach((b, i) => {
      dummy.position.set(b.x, b.y, b.z);
      dummy.rotation.set(b.rx, b.ry, 0);
      dummy.scale.set(b.sx, b.sy, b.sz);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      c.copy(SHADE).lerp(LIGHT, b.tint);
      m.setColorAt(i, b.muted ? muteColor(`#${c.getHexString()}`) : c);
    });
    m.count = boulders.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [boulders]);
  return <instancedMesh ref={ref} args={[geometry, material, boulders.length]} castShadow={shadows} receiveShadow={shadows} />;
}
