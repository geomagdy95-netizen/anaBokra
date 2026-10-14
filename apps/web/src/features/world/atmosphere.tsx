'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  ShaderMaterial,
  type Points,
} from 'three';

import { hashSeed, mulberry32 } from '../path/rng';
import { CORE_RADIUS, ISLAND_RADIUS, ISLAND_TOP, type IslandPlacement } from './layout';
import { WORLD_THEME } from './theme';

/** Soft round points that drift and pulse. One draw call; the motion runs in the vertex shader. */
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

/** Sunlit dust drifting around the islands. */
export function Motes({ placements, animate }: { placements: IslandPlacement[]; animate: boolean }) {
  const { motes } = WORLD_THEME;
  const geo = useMemo(() => pointsGeometry(moteData(placements, motes.count, motes.size)), [placements, motes]);
  useEffect(() => () => geo.dispose(), [geo]);
  const mat = useMemo(() => pointsMaterial(motes.color, motes.opacity, true), [motes]);
  useEffect(() => () => mat.dispose(), [mat]);
  const ref = useTicking(animate);
  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} />;
}
