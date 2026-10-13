'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Color, IcosahedronGeometry, MeshStandardMaterial, Object3D, type InstancedMesh } from 'three';

import { hashSeed, mulberry32 } from '../path/rng';
import { outline } from './geometry';
import { CORE_RADIUS, ISLAND_RADIUS, type IslandPlacement } from './layout';

const dummy = new Object3D();

interface Rock {
  x: number;
  y: number;
  z: number;
  s: [number, number, number];
  rot: number;
  shade: number;
}

/** Angle distance in radians, 0..π. */
const apart = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/**
 * A few weathered boulders on each beach and in the shallows, kept clear of bridge landings. Placed
 * with the same outline as the island mesh, so they sit on the sand.
 */
export function rockSpots(placements: IslandPlacement[]): Rock[] {
  const rocks: Rock[] = [];
  const scatter = (seed: string, cx: number, cz: number, R: number, wobble: number, landAt: number[], count: number) => {
    const shape = outline(seed, wobble, landAt);
    const rng = mulberry32(hashSeed(`rocks:${seed}`));
    let tries = 0;
    while (count > 0 && tries++ < 200) {
      const a = rng() * Math.PI * 2;
      if (landAt.some((b) => apart(a, b) < 0.55)) continue;
      // Keep the front of the island (labels, +z) mostly free.
      if (apart(a, Math.PI / 2) < 0.45) continue;
      const wet = rng() < 0.3;
      const off = wet ? 0.28 + rng() * 0.18 : -0.06 + rng() * 0.14;
      const d = (R + off) * shape(a);
      const big = 0.07 + rng() * 0.09;
      rocks.push({
        x: cx + Math.cos(a) * d,
        y: wet ? -0.06 : 0.07,
        z: cz + Math.sin(a) * d,
        s: [big * (1 + rng() * 0.5), big * (0.6 + rng() * 0.3), big * (0.9 + rng() * 0.4)],
        rot: rng() * Math.PI * 2,
        shade: rng(),
      });
      count--;
      // Sometimes a smaller stone beside it.
      if (rng() < 0.5) {
        const last = rocks[rocks.length - 1]!;
        rocks.push({ ...last, x: last.x + (rng() - 0.5) * 0.25, z: last.z + (rng() - 0.5) * 0.25, s: [big * 0.5, big * 0.35, big * 0.45], rot: rng() * 6, shade: rng() });
      }
    }
  };
  scatter('core', 0, 0, CORE_RADIUS, 0.025, placements.map((p) => Math.atan2(p.dir[1], p.dir[0])), 7);
  for (const p of placements) scatter(p.id, p.pos[0], p.pos[1], ISLAND_RADIUS, 0.06, [Math.atan2(-p.dir[1], -p.dir[0])], 4);
  return rocks;
}

const LIGHT = new Color('#B9AFA4');
const DARK = new Color('#8F857C');

export function Rocks({ placements, shadows }: { placements: IslandPlacement[]; shadows: boolean }) {
  const rocks = useMemo(() => rockSpots(placements), [placements]);
  const geo = useMemo(() => new IcosahedronGeometry(1, 1), []);
  const mat = useMemo(() => new MeshStandardMaterial({ roughness: 0.95, flatShading: true }), []);
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const c = new Color();
    rocks.forEach((r, i) => {
      dummy.position.set(r.x, r.y, r.z);
      dummy.rotation.set(0, r.rot, 0);
      dummy.scale.set(...r.s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, c.copy(DARK).lerp(LIGHT, r.shade));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [rocks]);
  return <instancedMesh ref={ref} args={[geo, mat, rocks.length]} castShadow={shadows} receiveShadow={shadows} />;
}
