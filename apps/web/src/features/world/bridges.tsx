'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, CatmullRomCurve3, Color, MeshBasicMaterial, Object3D, Vector3, type Group, type InstancedMesh } from 'three';

import { bridgePoint, roundedBox, stripGeometry, type BridgeEnds } from './geometry';
import { ISLAND_TOP, type XZ } from './layout';
import { BRAND, SCENE, toy } from './materials';
import type { BridgeMode, Relation } from './types';

/** Rail = how the group relates to the user. Planks = how much of the bridge (phases) is built. */
const STYLE: Record<Relation, { rail: string; railGlow: number; plank: string; plankDone: string; glow: string | null }> = {
  neutral: { rail: '#E2CDA9', railGlow: 0, plank: SCENE.plank, plankDone: '#F1CF95', glow: null },
  suggested: { rail: '#8B45DA', railGlow: 0.45, plank: '#EFE4FC', plankDone: '#B184EE', glow: BRAND.violet },
  added: { rail: '#FF9A55', railGlow: 0.4, plank: '#FFE8D6', plankDone: '#FFBE8E', glow: BRAND.apricot },
  other: { rail: '#E5DACB', railGlow: 0, plank: '#F1EBE1', plankDone: '#E9DCC8', glow: null },
};

/** Visible plank ranges along the bridge (0..1). A broken bridge keeps only the two stubs. */
function ranges(mode: BridgeMode): [number, number][] {
  return mode === 'connected' ? [[0, 1]] : [
      [0, 0.16],
      [0.8, 1],
    ];
}

const dummy = new Object3D();
const tmp = new Vector3();
const tmp2 = new Vector3();

export interface BridgeProps {
  from: XZ;
  fromRadius: number;
  to: XZ;
  toRadius: number;
  relation: Relation;
  mode: BridgeMode;
  done: number;
  total: number;
  animate: boolean;
  shadows: boolean;
}

export function bridgeEnds(from: XZ, fromRadius: number, to: XZ, toRadius: number): BridgeEnds {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const ux = dx / len;
  const uz = dz / len;
  const y = ISLAND_TOP - 0.03;
  return {
    start: new Vector3(from[0] + ux * (fromRadius - 0.35), y, from[1] + uz * (fromRadius - 0.35)),
    end: new Vector3(to[0] - ux * (toRadius - 0.35), y, to[1] - uz * (toRadius - 0.35)),
    arch: 0.32,
  };
}

export function Bridge({ from, fromRadius, to, toRadius, relation, mode, done, total, animate, shadows }: BridgeProps) {
  const ends = useMemo(() => bridgeEnds(from, fromRadius, to, toRadius), [from, fromRadius, to, toRadius]);
  const style = STYLE[relation];
  const length = ends.start.distanceTo(ends.end);
  const n = Math.max(12, Math.round(length / 0.26));
  const visible = ranges(mode);
  const doneFrac = total > 0 ? done / total : 0;

  const planks = useMemo(() => {
    const out: { t: number; done: boolean }[] = [];
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      if (visible.some(([a, b]) => t >= a && t <= b)) out.push({ t, done: t <= doneFrac });
    }
    return out;
  }, [n, visible, doneFrac]);

  const plankRef = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = plankRef.current;
    if (!mesh) return;
    const base = new Color(style.plank);
    const fin = new Color(style.plankDone);
    planks.forEach((p, i) => {
      bridgePoint(ends, p.t, tmp);
      bridgePoint(ends, Math.min(1, p.t + 0.01), tmp2);
      dummy.position.copy(tmp);
      dummy.lookAt(tmp2);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, p.done ? fin : base);
    });
    mesh.count = planks.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [planks, ends, style]);

  // Rails and posts, one pair per visible range.
  const rails = useMemo(() => {
    const dir = new Vector3().subVectors(ends.end, ends.start).setY(0).normalize();
    const side = new Vector3(-dir.z, 0, dir.x);
    return visible.flatMap(([a, b]) =>
      [-0.47, 0.47].map((off) => {
        const pts: Vector3[] = [];
        for (let i = 0; i <= 12; i++) {
          const p = bridgePoint(ends, a + ((b - a) * i) / 12, new Vector3());
          pts.push(p.addScaledVector(side, off).setY(p.y + 0.2));
        }
        return new CatmullRomCurve3(pts);
      }),
    );
  }, [ends, visible]);

  const posts = useMemo(() => {
    const dir = new Vector3().subVectors(ends.end, ends.start).setY(0).normalize();
    const side = new Vector3(-dir.z, 0, dir.x);
    const ts = [0, 1, ...Array.from({ length: Math.max(0, total - 1) }, (_, k) => (k + 1) / total)];
    if (mode !== 'connected') ts.push(0.16, 0.8);
    return ts
      .filter((t) => visible.some(([a, b]) => t >= a - 1e-6 && t <= b + 1e-6))
      .flatMap((t) => [-0.47, 0.47].map((off) => bridgePoint(ends, t, new Vector3()).addScaledVector(side, off)));
  }, [ends, total, mode, visible]);

  // Dotted gap of a broken or updating bridge.
  const dots = useMemo(() => {
    if (mode === 'connected') return [];
    const out: Vector3[] = [];
    for (let t = 0.27; t <= 0.73 + 1e-6; t += 0.065) out.push(bridgePoint(ends, t, new Vector3()));
    return out;
  }, [ends, mode]);

  const dotGroup = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!animate || mode !== 'updating' || !dotGroup.current) return;
    dotGroup.current.children.forEach((c, i) => {
      const k = 0.65 + 0.35 * Math.max(0, Math.sin(clock.elapsedTime * 3 - i * 0.6));
      c.scale.setScalar(k);
    });
  });

  const glow = useMemo(() => (style.glow && mode === 'connected' ? stripGeometry(ends, 1.9, 0, 1) : null), [style.glow, mode, ends]);
  const glowMat = useMemo(
    () => (style.glow ? new MeshBasicMaterial({ color: style.glow, transparent: true, opacity: 0.28, blending: AdditiveBlending, depthWrite: false }) : null),
    [style.glow],
  );
  useEffect(() => () => (glow?.dispose(), glowMat?.dispose()), [glow, glowMat]);

  const railMat = toy(style.rail, false, { glow: style.railGlow, rough: 0.35 });
  const plankMat = useMemo(() => toy('#FFFFFF', false, { rough: 0.7 }), []);
  const dotMat = toy(mode === 'updating' ? SCENE.lilac : '#B99BE8', false, { glow: mode === 'updating' ? 0.35 : 0.15 });

  return (
    <group>
      <instancedMesh ref={plankRef} args={[roundedBox(0.98, 0.07, 0.19, 0.03), plankMat, n]} castShadow={shadows} receiveShadow={shadows} frustumCulled={false} />
      {rails.map((curve, i) => (
        <mesh key={i} material={railMat} castShadow={shadows}>
          <tubeGeometry args={[curve, 24, 0.045, 8, false]} />
        </mesh>
      ))}
      {posts.map((p, i) => (
        <mesh key={i} position={[p.x, p.y + 0.1, p.z]} material={railMat} castShadow={shadows}>
          <cylinderGeometry args={[0.05, 0.06, 0.24, 10]} />
        </mesh>
      ))}
      {dots.length > 0 && (
        <group ref={dotGroup}>
          {dots.map((p, i) => (
            <mesh key={i} position={p} material={dotMat}>
              <sphereGeometry args={[0.09, 14, 10]} />
            </mesh>
          ))}
        </group>
      )}
      {glow && glowMat && <mesh geometry={glow} material={glowMat} renderOrder={2} />}
    </group>
  );
}
