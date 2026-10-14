'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BackSide,
  BufferAttribute,
  Color,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
  type InstancedMesh,
  type Mesh,
} from 'three';

import { hashSeed, mulberry32 } from '../path/rng';
import { ISLAND_RADIUS, WORLD_EXTENT, type XZ } from './layout';
import { WORLD_THEME } from './theme';

const dummy = new Object3D();

// --- Sky and sea --------------------------------------------------------------

export function SkyDome() {
  const { sky } = WORLD_THEME;
  const geo = useMemo(() => {
    const g = new SphereGeometry(160, 32, 16);
    const pos = g.getAttribute('position');
    const top = new Color(sky.top);
    const mid = new Color(sky.mid);
    const horizon = new Color(sky.horizon);
    const c = new Color();
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const t = Math.min(1, Math.max(0, pos.getY(i) / 90));
      // Horizon glow low down, the middle band, then the zenith.
      if (t < 0.25) c.copy(horizon).lerp(mid, t / 0.25);
      else c.copy(mid).lerp(top, Math.pow((t - 0.25) / 0.75, 0.8));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new BufferAttribute(colors, 3));
    return g;
  }, [sky]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} renderOrder={-1}>
      <meshBasicMaterial vertexColors side={BackSide} fog={false} depthWrite={false} />
    </mesh>
  );
}


/**
 * The sea: a lit, shadow-receiving plane whose colour is worked out per pixel from the distance to the
 * nearest island (shallows, a foam line that laps at the shore) plus slow drifting wave highlights.
 * `islands` are circles (x, z, radius at the waterline).
 */
export function Sea({ shadows, islands, animate }: { shadows: boolean; islands: { pos: XZ; radius: number }[]; animate: boolean }) {
  const { sea: SEA } = WORLD_THEME;
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIslands: { value: islands.map((i) => new Vector3(i.pos[0], i.pos[1], i.radius)) },
      uDeep: { value: new Color(SEA.deep) },
      uMid: { value: new Color(SEA.mid) },
      uShallow: { value: new Color(SEA.shallow) },
      uShore: { value: new Color(SEA.shore) },
      uFoam: { value: new Color(SEA.foam) },
      uGlint: { value: new Color(SEA.glint) },
      uFoamStrength: { value: SEA.foamStrength },
      uGlintStrength: { value: SEA.glintStrength },
    }),
    [islands, SEA],
  );
  const mat = useMemo(() => {
    const m = new MeshStandardMaterial({ roughness: 0.3, metalness: 0 });
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
uniform vec3 uDeep, uMid, uShallow, uShore, uFoam, uGlint;
uniform float uFoamStrength, uGlintStrength;`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
// Small moving waves: the slope of a few crossing sine swells tilts the normal, so the sun glitters.
vec2 q = vSeaXZ;
float t = uTime;
vec2 g = vec2(0.0);
g += vec2(0.8, 0.6) * cos(dot(q, vec2(0.8, 0.6)) * 3.1 + t * 1.3) * 0.14;
g += vec2(-0.5, 0.86) * cos(dot(q, vec2(-0.5, 0.86)) * 4.7 - t * 1.7) * 0.1;
g += vec2(0.95, -0.3) * cos(dot(q, vec2(0.95, -0.3)) * 7.9 + t * 2.3) * 0.07;
g += vec2(-0.2, -0.98) * cos(dot(q, vec2(-0.2, -0.98)) * 12.3 - t * 2.9) * 0.045;
// Calmer toward the horizon, where steep ripples would only show as streaks.
g *= 1.0 - smoothstep(12.0, 28.0, length(q)) * 0.85;
normal = normalize((viewMatrix * vec4(normalize(vec3(-g.x, 1.0, -g.y)), 0.0)).xyz);`,
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
// Shallows around each island: turquoise, paler over the sand near the beach.
col = mix(col, uShallow, (1.0 - smoothstep(0.15, 1.5, d)) * 0.85);
col = mix(col, uShore, 1.0 - smoothstep(0.0, 0.45, d));
// Rocks and weed on the sea floor show through the shallows as darker, soft patches.
float floorN = sin(vSeaXZ.x * 2.3 + sin(vSeaXZ.y * 1.7) * 2.0) * sin(vSeaXZ.y * 2.9 + sin(vSeaXZ.x * 1.3) * 1.5);
col *= 1.0 - smoothstep(0.1, 0.9, floorN) * 0.22 * (1.0 - smoothstep(0.2, 1.8, d));
// Slow drifting wave highlights.
float w = sin(vSeaXZ.x * 0.85 + uTime * 0.45 + sin(vSeaXZ.y * 0.6 + uTime * 0.3) * 1.6)
        * sin(vSeaXZ.y * 0.75 - uTime * 0.38 + sin(vSeaXZ.x * 0.5) * 1.4);
col = mix(col, uGlint, smoothstep(0.72, 0.98, w) * uGlintStrength * smoothstep(0.4, 2.0, d) * (1.0 - smoothstep(10.0, 22.0, length(vSeaXZ))));
// Foam line lapping at the shore, a little uneven along the beach, and a fainter second line.
// Foam breaks against the rocks: thickest at the waterline, torn into patches along the shore.
float lap = 0.05 + 0.06 * sin(uTime * 1.1 + ang * 3.0);
float torn = smoothstep(-0.2, 0.6, sin(ang * 11.0 + uTime * 0.6) * sin(ang * 5.0 - uTime * 0.4 + vSeaXZ.x));
float foam = (1.0 - smoothstep(0.0, 0.16, d - lap)) * (0.55 + 0.45 * torn);
foam += (1.0 - smoothstep(0.0, 0.07, abs(d - lap - 0.3))) * 0.3 * torn;
col = mix(col, uFoam, clamp(foam, 0.0, 1.0) * uFoamStrength);
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
  // High horizon banks give the world a soft cloudline instead of leaving the sky empty.
  const banks = Math.round(30 * density);
  for (let i = 0; i < banks; i++) {
    const a = (i / banks) * Math.PI * 2 + rng() * 0.2;
    const r = WORLD_EXTENT + 4 + rng() * 14;
    clump(Math.cos(a) * r, Math.sin(a) * r, 1.4 + rng() * 1.6, 6, 5.5 + rng() * 2.2);
  }
  // A few lower, wispy banks add depth behind the islands without obscuring their landmarks.
  islands.forEach((isl, i) => {
    if (density < 0.8) return;
    if (rng() > 0.55 * density + 0.2) return;
    const off = ISLAND_RADIUS + 0.7;
    const side = (rng() - 0.5) * 2.2;
    const x = isl.pos[0] + isl.dir[0] * off - isl.dir[1] * side;
    const z = isl.pos[1] + isl.dir[1] * off + isl.dir[0] * side;
    clump(x, z, 0.55 + rng() * 0.35, 4, 3.8 + rng() * 1.2);
    if (i % 3 === 0) clump(x * 1.12, z * 1.12, 0.7, 4, 4.2 + rng() * 1.4);
  });
  return puffs;
}

export function Clouds({ islands, density, animate }: { islands: { pos: XZ; dir: XZ }[]; density: number; animate: boolean }) {
  const puffs = useMemo(() => cloudPuffs(islands, density), [islands, density]);
  const ref = useRef<InstancedMesh>(null);
  const geo = useMemo(() => new SphereGeometry(1, 20, 14), []);
  const { cloud } = WORLD_THEME;
  const mat = useMemo(() => new MeshStandardMaterial({ color: cloud.color, roughness: 1, emissive: cloud.emissive, emissiveIntensity: cloud.glow }), [cloud]);
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
