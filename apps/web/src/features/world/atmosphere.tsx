'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ShaderMaterial,
  SpriteMaterial,
  type Points,
} from 'three';

import { hashSeed, mulberry32 } from '../path/rng';
import { CORE_RADIUS, ISLAND_RADIUS, ISLAND_TOP, type IslandPlacement } from './layout';
import { toy } from './materials';
import { useWorldTheme } from './theme';

/**
 * Soft round points that drift and pulse: stars on the sky dome, golden dust by day, fireflies at
 * night. One draw call each; the motion runs in the vertex shader.
 */
function pointsMaterial(color: string, opacity: number, attenuate: boolean): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new Color(color) }, uOpacity: { value: opacity } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aPhase;
      attribute float aDrift;
      uniform float uTime;
      varying float vPulse;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.35 + aPhase) * aDrift;
        p.y += sin(uTime * 0.5 + aPhase * 1.7) * aDrift * 0.6;
        p.z += cos(uTime * 0.3 + aPhase * 0.8) * aDrift;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vPulse = 0.55 + 0.45 * sin(uTime * (1.2 + fract(aPhase) * 1.6) + aPhase * 4.0);
        gl_PointSize = ${attenuate ? 'aSize * 520.0 / -mv.z' : 'aSize'} * (0.75 + 0.25 * vPulse);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vPulse;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(uColor, a * a * uOpacity * vPulse);
      }`,
  });
}

interface PointData {
  pos: number[];
  size: number[];
  phase: number[];
  drift: number[];
}

function pointsGeometry({ pos, size, phase, drift }: PointData): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('aSize', new BufferAttribute(new Float32Array(size), 1));
  g.setAttribute('aPhase', new BufferAttribute(new Float32Array(phase), 1));
  g.setAttribute('aDrift', new BufferAttribute(new Float32Array(drift), 1));
  return g;
}

function starData(): PointData {
  const rng = mulberry32(hashSeed('stars'));
  const out: PointData = { pos: [], size: [], phase: [], drift: [] };
  for (let i = 0; i < 420; i++) {
    const a = rng() * Math.PI * 2;
    const el = 0.12 + Math.pow(rng(), 0.7) * 1.35;
    const r = 150;
    out.pos.push(Math.cos(a) * Math.cos(el) * r, Math.sin(el) * r, Math.sin(a) * Math.cos(el) * r);
    out.size.push(rng() < 0.08 ? 4.5 : 1.6 + rng() * 2);
    out.phase.push(rng() * 20);
    out.drift.push(0);
  }
  return out;
}

function moteData(placements: IslandPlacement[], count: number, size: number): PointData {
  const rng = mulberry32(hashSeed('motes'));
  const out: PointData = { pos: [], size: [], phase: [], drift: [] };
  const centres = [{ x: 0, z: 0, r: CORE_RADIUS }, ...placements.map((p) => ({ x: p.pos[0], z: p.pos[1], r: ISLAND_RADIUS }))];
  for (let i = 0; i < count; i++) {
    const c = centres[i % centres.length]!;
    const a = rng() * Math.PI * 2;
    const d = c.r * (0.3 + rng() * 0.95);
    out.pos.push(c.x + Math.cos(a) * d, ISLAND_TOP + 0.25 + rng() * 1.6, c.z + Math.sin(a) * d);
    out.size.push(size * (0.6 + rng() * 0.8));
    out.phase.push(rng() * 30);
    out.drift.push(0.15 + rng() * 0.35);
  }
  return out;
}

function useTicking(animate: boolean) {
  const ref = useRef<Points>(null);
  useFrame(({ clock }) => {
    const m = ref.current?.material as ShaderMaterial | undefined;
    if (m && animate) m.uniforms.uTime!.value = clock.elapsedTime;
  });
  return ref;
}

/** Twinkling stars on the upper sky (night only). */
export function Stars({ animate }: { animate: boolean }) {
  const geo = useMemo(() => pointsGeometry(starData()), []);
  useEffect(() => () => geo.dispose(), [geo]);
  const mat = useMemo(() => {
    const m = pointsMaterial('#FFF6E0', 1, false);
    m.fog = false;
    return m;
  }, []);
  useEffect(() => () => mat.dispose(), [mat]);
  const ref = useTicking(animate);
  return <points ref={ref} geometry={geo} material={mat} renderOrder={-1} frustumCulled={false} />;
}

/** Floating light motes around the islands: sunlit dust by day, fireflies at night. */
export function Motes({ placements, animate }: { placements: IslandPlacement[]; animate: boolean }) {
  const { motes } = useWorldTheme();
  const geo = useMemo(() => pointsGeometry(moteData(placements, motes.count, motes.size)), [placements, motes]);
  useEffect(() => () => geo.dispose(), [geo]);
  const mat = useMemo(() => pointsMaterial(motes.color, motes.opacity, true), [motes]);
  useEffect(() => () => mat.dispose(), [mat]);
  const ref = useTicking(animate);
  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} />;
}

let haloTexture: CanvasTexture | null = null;
/** A soft radial glow, drawn once. */
function halo(): CanvasTexture {
  if (haloTexture) return haloTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  haloTexture = new CanvasTexture(c);
  return haloTexture;
}

/** A pair of lamp posts where each bridge lands on its island; their glow shows at night. */
export function Lanterns({ placements, shadows }: { placements: IslandPlacement[]; shadows: boolean }) {
  const { lights } = useWorldTheme();
  const spots = useMemo(
    () =>
      placements.flatMap((p) => {
        const toCore: [number, number] = [-p.dir[0], -p.dir[1]];
        const side: [number, number] = [-toCore[1], toCore[0]];
        const d = ISLAND_RADIUS - 0.42;
        return [-1, 1].map((k) => [p.pos[0] + toCore[0] * d + side[0] * 0.42 * k, p.pos[1] + toCore[1] * d + side[1] * 0.42 * k] as const);
      }),
    [placements],
  );
  const haloMat = useMemo(
    () => new SpriteMaterial({ map: halo(), color: lights.color, transparent: true, opacity: Math.min(1, lights.glow * 0.55), blending: AdditiveBlending, depthWrite: false }),
    [lights],
  );
  useEffect(() => () => haloMat.dispose(), [haloMat]);
  const post = toy('#5B3A8C', false, { rough: 0.5 });
  const bulb = toy(lights.color, false, { glow: lights.glow });
  return (
    <>
      {spots.map(([x, z], i) => (
        <group key={i} position={[x, ISLAND_TOP, z]}>
          <mesh position={[0, 0.22, 0]} material={post} castShadow={shadows}>
            <cylinderGeometry args={[0.022, 0.03, 0.44, 8]} />
          </mesh>
          <mesh position={[0, 0.48, 0]} material={post}>
            <cylinderGeometry args={[0.07, 0.05, 0.04, 8]} />
          </mesh>
          <mesh position={[0, 0.53, 0]} material={bulb}>
            <sphereGeometry args={[0.055, 12, 10]} />
          </mesh>
          {lights.glow > 0.5 && <sprite position={[0, 0.53, 0]} scale={0.7} material={haloMat} />}
        </group>
      ))}
    </>
  );
}
