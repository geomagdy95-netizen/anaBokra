'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BackSide,
  BufferAttribute,
  Color,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  type BufferGeometry,
  type InstancedMesh,
  type Mesh,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { hashSeed, mulberry32 } from '../path/rng';
import { archShape, halfDiscShape } from './geometry';
import { ISLAND_RADIUS, ISLAND_TOP, WORLD_EXTENT, type XZ } from './layout';
import { BRAND, muteColor, SCENE, toy } from './materials';

const dummy = new Object3D();

// --- Sky and sea --------------------------------------------------------------

export function SkyDome() {
  const geo = useMemo(() => {
    const g = new SphereGeometry(160, 32, 16);
    const pos = g.getAttribute('position');
    const top = new Color(SCENE.skyTop);
    const horizon = new Color(SCENE.horizon);
    const c = new Color();
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const t = Math.min(1, Math.max(0, pos.getY(i) / 90));
      c.copy(horizon).lerp(top, Math.pow(t, 0.7));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new BufferAttribute(colors, 3));
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} renderOrder={-1}>
      <meshBasicMaterial vertexColors side={BackSide} fog={false} depthWrite={false} />
    </mesh>
  );
}

export function Sea({ shadows }: { shadows: boolean }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow={shadows}>
      <circleGeometry args={[150, 64]} />
      <meshStandardMaterial color={SCENE.sea} roughness={0.75} metalness={0} />
    </mesh>
  );
}

/** Soft expanding rings around every island, like water lapping at the shore. */
export function Ripples({ centers, animate }: { centers: { pos: XZ; radius: number }[]; animate: boolean }) {
  const refs = useRef<(Mesh | null)[]>([]);
  const mats = useMemo(
    () => centers.map(() => new MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.35, depthWrite: false })),
    [centers],
  );
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  useFrame(({ clock }) => {
    if (!animate) return;
    refs.current.forEach((m, i) => {
      if (!m) return;
      const p = (clock.elapsedTime * 0.22 + i * 0.37) % 1;
      m.scale.setScalar(1 + p * 0.22);
      mats[i]!.opacity = 0.42 * (1 - p);
    });
  });
  return (
    <>
      {centers.map((c, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          position={[c.pos[0], 0.01, c.pos[1]]}
          rotation={[-Math.PI / 2, 0, 0]}
          material={mats[i]}
        >
          <ringGeometry args={[c.radius * 1.02, c.radius * 1.08, 64]} />
        </mesh>
      ))}
    </>
  );
}

// --- Clouds -------------------------------------------------------------------

interface Puff {
  x: number;
  y: number;
  z: number;
  s: number;
  phase: number;
}

function cloudPuffs(islands: { pos: XZ; dir: XZ }[], density: number): Puff[] {
  const rng = mulberry32(hashSeed('clouds'));
  const puffs: Puff[] = [];
  const clump = (cx: number, cz: number, size: number, count: number, y: number) => {
    const phase = rng() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2;
      const r = rng() * size * 1.1;
      puffs.push({ x: cx + Math.cos(a) * r * 1.4, y: y + rng() * size * 0.35, z: cz + Math.sin(a) * r * 0.8, s: size * (0.55 + rng() * 0.6), phase });
    }
  };
  // Horizon banks, beyond the islands.
  const banks = Math.round(30 * density);
  for (let i = 0; i < banks; i++) {
    const a = (i / banks) * Math.PI * 2 + rng() * 0.2;
    const r = WORLD_EXTENT + 4 + rng() * 14;
    clump(Math.cos(a) * r, Math.sin(a) * r, 1.4 + rng() * 1.6, 6, -0.2);
  }
  // Small banks hugging the outer side of some islands.
  islands.forEach((isl, i) => {
    if (rng() > 0.55 * density + 0.2) return;
    const off = ISLAND_RADIUS + 0.7;
    const side = (rng() - 0.5) * 2.2;
    const x = isl.pos[0] + isl.dir[0] * off - isl.dir[1] * side;
    const z = isl.pos[1] + isl.dir[1] * off + isl.dir[0] * side;
    clump(x, z, 0.55 + rng() * 0.35, 4, -0.15);
    if (i % 3 === 0) clump(x * 1.12, z * 1.12, 0.7, 4, -0.2);
  });
  return puffs;
}

export function Clouds({ islands, density, animate }: { islands: { pos: XZ; dir: XZ }[]; density: number; animate: boolean }) {
  const puffs = useMemo(() => cloudPuffs(islands, density), [islands, density]);
  const ref = useRef<InstancedMesh>(null);
  const geo = useMemo(() => new SphereGeometry(1, 20, 14), []);
  const mat = useMemo(() => new MeshStandardMaterial({ color: SCENE.cloud, roughness: 1, emissive: '#F3EEFF', emissiveIntensity: 0.18 }), []);
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);

  const place = (t: number) => {
    const mesh = ref.current;
    if (!mesh) return;
    puffs.forEach((p, i) => {
      dummy.position.set(p.x + Math.sin(t * 0.12 + p.phase) * 0.25, p.y + Math.sin(t * 0.35 + p.phase) * 0.08, p.z);
      dummy.scale.set(p.s, p.s * 0.62, p.s * 0.85);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  useLayoutEffect(() => place(0));
  useFrame(({ clock }) => {
    if (animate) place(clock.elapsedTime);
  });
  return <instancedMesh ref={ref} args={[geo, mat, puffs.length]} frustumCulled={false} />;
}

// --- Trees --------------------------------------------------------------------

function pineGeometry(): BufferGeometry {
  const parts: [BufferGeometry, string][] = [
    [new CylinderGeometry(0.045, 0.06, 0.26, 6).translate(0, 0.13, 0), SCENE.trunk],
    [new ConeGeometry(0.27, 0.5, 7).translate(0, 0.45, 0), SCENE.treeDark],
    [new ConeGeometry(0.2, 0.4, 7).translate(0, 0.74, 0), SCENE.tree],
  ];
  const colored = parts.map(([g, hex]) => {
    const c = new Color(hex);
    const n = g.getAttribute('position').count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new BufferAttribute(arr, 3));
    return g;
  });
  const merged = mergeGeometries(colored)!;
  colored.forEach((g) => g.dispose());
  return merged;
}

export interface TreeSpot {
  x: number;
  z: number;
  s: number;
  rot: number;
  muted: boolean;
}

/** Pines around the rim of an island, keeping the front (label side) and the centre (icon) clear. */
export function treesFor(seedKey: string, center: XZ, radius: number, count: number, muted: boolean): TreeSpot[] {
  const rng = mulberry32(hashSeed(seedKey));
  const out: TreeSpot[] = [];
  let guard = 0;
  while (out.length < count && guard++ < 200) {
    const a = rng() * Math.PI * 2;
    // Skip the front sector, facing the camera (+z), where the label sits.
    const frontness = Math.sin(a);
    if (frontness > 0.55) continue;
    const r = radius * (0.66 + rng() * 0.2);
    const x = center[0] + Math.cos(a) * r;
    const z = center[1] + Math.sin(a) * r;
    if (out.some((t) => Math.hypot(t.x - x, t.z - z) < 0.42)) continue;
    out.push({ x, z, s: 0.75 + rng() * 0.5, rot: rng() * Math.PI, muted });
  }
  return out;
}

export function Trees({ spots, shadows }: { spots: TreeSpot[]; shadows: boolean }) {
  const ref = useRef<InstancedMesh>(null);
  const geo = useMemo(() => pineGeometry(), []);
  const mat = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), []);
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const normal = new Color('#ffffff');
    const muted = muteColor('#ffffff').multiplyScalar(0.95);
    spots.forEach((t, i) => {
      dummy.position.set(t.x, ISLAND_TOP, t.z);
      dummy.rotation.set(0, t.rot, 0);
      dummy.scale.setScalar(t.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, t.muted ? muted : normal);
    });
    mesh.count = spots.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [spots]);
  return <instancedMesh ref={ref} args={[geo, mat, 200]} castShadow={shadows} receiveShadow={shadows} frustumCulled={false} />;
}

// --- Background: brand "windows of possibility" -------------------------------

interface Window {
  x: number;
  z: number;
  rot: number;
  w: number;
  h: number;
  color: string;
  sun: boolean;
}

function backdrop(): Window[] {
  const rng = mulberry32(hashSeed('backdrop'));
  const palette = [SCENE.lavender, SCENE.lilac, BRAND.ivory, '#B892EC', BRAND.violet];
  const out: Window[] = [];
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.25;
    const r = WORLD_EXTENT + 9 + rng() * 12;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    out.push({
      x,
      z,
      rot: Math.atan2(-x, -z),
      w: 2.2 + rng() * 2.2,
      h: 3.2 + rng() * 4.5,
      color: palette[Math.floor(rng() * palette.length)]!,
      sun: rng() < 0.4,
    });
  }
  return out;
}

function Arch({ w: win }: { w: Window }) {
  const geo = useMemo(() => {
    const g = new ExtrudeGeometry(archShape(win.w, win.h, win.w * 0.2), {
      depth: 1.2,
      bevelEnabled: true,
      bevelThickness: 0.12,
      bevelSize: 0.12,
      bevelSegments: 3,
      curveSegments: 24,
    });
    g.translate(0, -0.6, -0.6);
    return g;
  }, [win.w, win.h]);
  const sun = useMemo(() => {
    if (!win.sun) return null;
    const r = win.w * 0.28;
    const g = new ExtrudeGeometry(halfDiscShape(r), { depth: 0.3, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 24 });
    g.translate(-r * 0.3, r + 0.1 - 0.6, -0.15);
    return g;
  }, [win.sun, win.w]);
  useEffect(() => () => (geo.dispose(), sun?.dispose()), [geo, sun]);
  return (
    <group position={[win.x, 0, win.z]} rotation={[0, win.rot, 0]}>
      <mesh geometry={geo} material={toy(win.color, false, { rough: 0.7 })} />
      {sun && <mesh geometry={sun} material={toy(BRAND.apricot, false, { rough: 0.6, glow: 0.15 })} />}
    </group>
  );
}

export function Backdrop() {
  const items = useMemo(() => backdrop(), []);
  return (
    <>
      {items.map((w, i) => (
        <Arch key={i} w={w} />
      ))}
    </>
  );
}

