'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BackSide,
  BufferAttribute,
  Color,
  ExtrudeGeometry,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
  type InstancedMesh,
  type Mesh,
} from 'three';

import { hashSeed, mulberry32 } from '../path/rng';
import { archShape, halfDiscShape } from './geometry';
import { ISLAND_RADIUS, WORLD_EXTENT, type XZ } from './layout';
import { BRAND, SCENE, toy } from './materials';

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

/** Sea colours: deeper lavender offshore, lighter shallows near the islands, white foam at the shore. */
const SEA = { deep: '#AE97E6', mid: '#C2B1EF', shallow: '#E2D8FA', foam: '#FFFFFF', glint: '#F4EEFF' } as const;

/**
 * The sea: a lit, shadow-receiving plane whose colour is worked out per pixel from the distance to the
 * nearest island (shallows, a foam line that laps at the shore) plus slow drifting wave highlights.
 * `islands` are circles (x, z, radius at the waterline).
 */
export function Sea({ shadows, islands, animate }: { shadows: boolean; islands: { pos: XZ; radius: number }[]; animate: boolean }) {
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIslands: { value: islands.map((i) => new Vector3(i.pos[0], i.pos[1], i.radius)) },
      uDeep: { value: new Color(SEA.deep) },
      uMid: { value: new Color(SEA.mid) },
      uShallow: { value: new Color(SEA.shallow) },
      uFoam: { value: new Color(SEA.foam) },
      uGlint: { value: new Color(SEA.glint) },
    }),
    [islands],
  );
  const mat = useMemo(() => {
    const m = new MeshStandardMaterial({ roughness: 0.6, metalness: 0 });
    m.userData.uTime = uniforms.uTime;
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vSeaXZ;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSeaXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec2 vSeaXZ;
uniform float uTime;
uniform vec3 uIslands[${islands.length}];
uniform vec3 uDeep, uMid, uShallow, uFoam, uGlint;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
float d = 1e5;
float ang = 0.0;
for (int i = 0; i < ${islands.length}; i++) {
  vec2 v = vSeaXZ - uIslands[i].xy;
  float di = length(v) - uIslands[i].z;
  if (di < d) { d = di; ang = atan(v.y, v.x) + float(i) * 1.7; }
}
// Offshore: mid to deep with distance from the archipelago centre.
vec3 col = mix(uMid, uDeep, smoothstep(14.0, 26.0, length(vSeaXZ)));
// Shallows around each island.
col = mix(col, uShallow, 1.0 - smoothstep(0.0, 1.6, d));
// Slow drifting wave highlights.
float w = sin(vSeaXZ.x * 0.85 + uTime * 0.45 + sin(vSeaXZ.y * 0.6 + uTime * 0.3) * 1.6)
        * sin(vSeaXZ.y * 0.75 - uTime * 0.38 + sin(vSeaXZ.x * 0.5) * 1.4);
col = mix(col, uGlint, smoothstep(0.72, 0.98, w) * 0.35 * smoothstep(0.4, 2.0, d));
// Foam line lapping at the shore, a little uneven along the beach, and a fainter second line.
float lap = 0.18 + 0.1 * sin(uTime * 1.1 + ang * 3.0) + 0.05 * sin(ang * 7.0);
float foam = 1.0 - smoothstep(0.0, 0.1, abs(d - lap));
foam += (1.0 - smoothstep(0.0, 0.12, abs(d - lap - 0.38))) * 0.35 * (0.5 + 0.5 * sin(uTime * 1.1 + ang * 3.0 + 1.5));
col = mix(col, uFoam, clamp(foam, 0.0, 1.0) * 0.75);
diffuseColor.rgb = col;`,
        );
    };
    return m;
  }, [uniforms, islands.length]);
  useEffect(() => () => mat.dispose(), [mat]);
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const m = ref.current?.material as MeshStandardMaterial | undefined;
    if (animate && m) m.userData.uTime.value = clock.elapsedTime;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow={shadows} material={mat}>
      <circleGeometry args={[150, 64]} />
    </mesh>
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
  const mat = useMemo(() => new MeshStandardMaterial({ color: SCENE.cloud, roughness: 1, emissive: '#F1EDFF', emissiveIntensity: 0.3 }), []);
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

