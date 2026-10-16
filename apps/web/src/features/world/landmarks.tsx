'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Shape, type Group, type Mesh, type MeshStandardMaterial } from 'three';

import { useToy } from './materials';
import { Bob, C, Extruded, RBox } from './props';
import type { GroupId } from './types';

/**
 * A small building or scene behind each group's icon, so every island reads as a place: the icon says
 * what the group is, the landmark where that work happens. Toy style, built from the same rounded
 * pieces as the icons, about 1 unit wide. Each stands at its island's landmark spot (layout.ts).
 */

function gable(w: number, h: number): Shape {
  const s = new Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(0, h);
  s.lineTo(-w / 2, 0);
  return s;
}

function sawtooth(w: number, h: number, teeth: number): Shape {
  const s = new Shape();
  const step = w / teeth;
  s.moveTo(-w / 2, 0);
  for (let i = 0; i < teeth; i++) {
    s.lineTo(-w / 2 + i * step, h);
    s.lineTo(-w / 2 + (i + 1) * step, 0);
  }
  s.lineTo(-w / 2, 0);
  return s;
}

const SHAPES = {
  schoolRoof: gable(1.0, 0.36),
  courtRoof: gable(1.08, 0.3),
  workshopRoof: sawtooth(1.0, 0.24, 3),
  sail: (() => {
    const s = new Shape();
    s.moveTo(0, 0);
    s.lineTo(0.62, 0.06);
    s.lineTo(0.05, 1.0);
    s.lineTo(0, 0);
    return s;
  })(),
};

/** A light that blinks slowly (aircraft warning light on towers). */
function Blink({ position, color = C.apricot, speed = 1.6 }: { position: [number, number, number]; color?: string; speed?: number }) {
  const m = useToy();
  const ref = useRef<Mesh>(null);
  // Its own copy of the shared toy material, since the glow changes every frame.
  const mat = useMemo(() => m(color, { glow: 0.6 }).clone(), [m, color]);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame(({ clock }) => {
    const own = ref.current?.material as MeshStandardMaterial | undefined;
    if (own) own.emissiveIntensity = 0.3 + 0.7 * Math.max(0, Math.sin(clock.elapsedTime * speed));
  });
  return (
    <mesh ref={ref} position={position} material={mat}>
      <sphereGeometry args={[0.055, 12, 8]} />
    </mesh>
  );
}

/** Rows of windows on a facade facing +z. */
function Windows({ cols, rows, w, h, x0, y0, z, dx, dy, color = C.lavender }: { cols: number; rows: number; w: number; h: number; x0: number; y0: number; z: number; dx: number; dy: number; color?: string }) {
  const out: ReactNode[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      out.push(<RBox key={`${r}-${c}`} size={[w, h, 0.03]} r={0.012} color={color} o={{ glow: 0.15 }} position={[x0 + c * dx, y0 + r * dy, z]} />);
  return <>{out}</>;
}

// --- Landmarks ----------------------------------------------------------------

/** Tech: a small open-front digital studio with a desk, server rack and satellite link. */
function TechStudio() {
  const m = useToy();
  return (
    <group>
      <RBox size={[1.32, 0.1, 0.86]} r={0.04} color={C.wood} position={[0, 0.05, 0]} />
      <RBox size={[1.16, 0.77, 0.12]} r={0.03} color={C.ivory} position={[0, 0.48, -0.32]} />
      <RBox size={[0.16, 0.72, 0.13]} r={0.025} color={C.wood} position={[-0.49, 0.43, 0.13]} />
      <RBox size={[0.16, 0.72, 0.13]} r={0.025} color={C.wood} position={[0.49, 0.43, 0.13]} />
      <RBox size={[1.22, 0.1, 0.98]} r={0.035} color={C.apricot} position={[0, 0.91, -0.04]} />
      <RBox size={[0.94, 0.06, 0.64]} r={0.025} color={C.plum} position={[0, 0.38, 0.06]} />
      <RBox size={[0.42, 0.045, 0.28]} r={0.012} color="#6D8E9D" position={[-0.16, 0.52, 0.05]} />
      <RBox size={[0.07, 0.12, 0.06]} r={0.018} color={C.wood} position={[-0.16, 0.44, 0.05]} />
      <RBox size={[0.28, 0.55, 0.22]} r={0.035} color={C.plum} position={[0.72, 0.29, -0.12]} />
      {[0, 1, 2].map((i) => <RBox key={i} size={[0.2, 0.035, 0.025]} r={0.01} color={i === 1 ? C.apricot : C.lavender} position={[0.72, 0.12 + i * 0.14, 0.0]} />)}
      <mesh position={[-0.8, 0.64, -0.08]} rotation={[0, 0, Math.PI / 2]} material={m(C.ivory)}><cylinderGeometry args={[0.19, 0.25, 0.08, 24]} /></mesh>
      <mesh position={[-0.8, 0.64, -0.02]} rotation={[0, 0, Math.PI / 2]} material={m(C.lavender)}><circleGeometry args={[0.15, 24]} /></mesh>
    </group>
  );
}

/** Science: an observatory with a dome and a telescope. */
function Observatory() {
  const m = useToy();
  return (
    <group>
      <mesh position={[0, 0.35, 0]} material={m(C.ivory)}>
        <cylinderGeometry args={[0.42, 0.45, 0.7, 28]} />
      </mesh>
      <mesh position={[0, 0.7, 0]} material={m(C.violet)}>
        <sphereGeometry args={[0.44, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <RBox size={[0.14, 0.4, 0.06]} r={0.02} color={C.plumDark} position={[0, 0.92, 0.36]} rotation={[-0.75, 0, 0]} />
      <mesh position={[0, 1.02, 0.28]} rotation={[-0.75, 0, 0]} material={m(C.apricot)}>
        <cylinderGeometry args={[0.06, 0.075, 0.55, 14]} />
      </mesh>
      <RBox size={[0.18, 0.3, 0.04]} r={0.03} color={C.plum} position={[0, 0.15, 0.44]} />
    </group>
  );
}

/** Health: a clinic with a big plus on its front. */
function Clinic() {
  return (
    <group>
      <RBox size={[1.0, 0.72, 0.56]} r={0.06} color={C.white} position={[0, 0.36, 0]} />
      <RBox size={[1.04, 0.1, 0.6]} r={0.03} color={C.violet} position={[0, 0.76, 0]} />
      <RBox size={[0.42, 0.5, 0.46]} r={0.05} color={C.white} position={[0, 1.0, -0.02]} />
      <RBox size={[0.26, 0.08, 0.04]} r={0.02} color={C.violet} o={{ glow: 0.2 }} position={[0, 1.02, 0.23]} />
      <RBox size={[0.08, 0.26, 0.04]} r={0.02} color={C.violet} o={{ glow: 0.2 }} position={[0, 1.02, 0.23]} />
      <RBox size={[0.22, 0.34, 0.04]} r={0.03} color={C.lavender} position={[0, 0.17, 0.29]} />
      <Windows cols={2} rows={1} w={0.16} h={0.16} x0={-0.34} y0={0.42} z={0.29} dx={0.68} dy={0} />
    </group>
  );
}

/** Agriculture: a timber framed greenhouse with glass roof panels and seedling benches. */
function Greenhouse() {
  const glass = useToy();
  return (
    <group>
      <RBox size={[1.28, 0.12, 0.96]} r={0.035} color="#A8784C" position={[0, 0.06, 0]} />
      <mesh position={[0, 0.48, 0]}><boxGeometry args={[1.12, 0.75, 0.78]} /><meshStandardMaterial color="#C4E5E3" transparent opacity={0.22} roughness={0.25} /></mesh>
      <RBox size={[0.06, 0.82, 0.06]} r={0.02} color={C.wood} position={[-0.58, 0.45, -0.4]} />
      <RBox size={[0.06, 0.82, 0.06]} r={0.02} color={C.wood} position={[0.58, 0.45, -0.4]} />
      <RBox size={[0.06, 0.82, 0.06]} r={0.02} color={C.wood} position={[-0.58, 0.45, 0.4]} />
      <RBox size={[0.06, 0.82, 0.06]} r={0.02} color={C.wood} position={[0.58, 0.45, 0.4]} />
      <RBox size={[1.2, 0.05, 0.05]} r={0.015} color={C.wood} position={[0, 0.83, 0]} />
      {[-0.39, 0, 0.39].map((x) => <RBox key={x} size={[0.045, 0.76, 0.045]} r={0.012} color={C.wood} position={[x, 0.42, -0.4]} />)}
      <RBox size={[0.08, 0.88, 0.08]} r={0.02} color={C.wood} position={[0, 0.46, 0]} />
      {[-0.25, 0.15].map((x) => <group key={x} position={[x, 0.2, 0.1]}>
        <RBox size={[0.3, 0.08, 0.48]} r={0.025} color="#876042" position={[0, 0, 0]} />
        {[-0.13, 0, 0.13].map((z) => <mesh key={z} position={[0, 0.13, z]} material={glass('#709B50')}><sphereGeometry args={[0.1, 10, 8]} /></mesh>)}
      </group>)}
    </group>
  );
}

/** Tourism: a warm coastal guesthouse with a tiled roof and shaded front terrace. */
function Guesthouse() {
  const m = useToy();
  return (
    <group>
      <RBox size={[1.22, 0.12, 0.86]} r={0.04} color={C.wood} position={[0, 0.06, 0]} />
      <RBox size={[0.94, 0.72, 0.66]} r={0.07} color={C.ivory} position={[0, 0.48, -0.11]} />
      <Extruded shape={SHAPES.schoolRoof} depth={0.82} bevel={0.035} color="#C96F3D" position={[0, 0.84, -0.1]} />
      <RBox size={[0.52, 0.45, 0.08]} r={0.04} color="#6F8D93" position={[0, 0.38, 0.24]} />
      <RBox size={[0.22, 0.38, 0.06]} r={0.035} color={C.wood} position={[0, 0.27, 0.29]} />
      <RBox size={[0.9, 0.08, 0.56]} r={0.025} color={C.wood} position={[0, 0.74, 0.38]} />
      {[-0.36, 0.36].map((x) => <RBox key={x} size={[0.07, 0.62, 0.07]} r={0.02} color="#815536" position={[x, 0.43, 0.58]} />)}
      <RBox size={[0.95, 0.06, 0.08]} r={0.02} color="#815536" position={[0, 0.74, 0.58]} />
      <mesh position={[0.31, 1.1, -0.1]} material={m(C.wood)}><cylinderGeometry args={[0.09, 0.12, 0.32, 8]} /></mesh>
    </group>
  );
}

/** Education: a school with a gable roof and a clock. */
function School() {
  const m = useToy();
  return (
    <group>
      <RBox size={[0.96, 0.62, 0.56]} r={0.05} color={C.ivory} position={[0, 0.31, 0]} />
      <Extruded shape={SHAPES.schoolRoof} depth={0.62} bevel={0.02} color={C.apricot} position={[0, 0.62, 0]} />
      <mesh position={[0, 0.78, 0.3]} rotation={[Math.PI / 2, 0, 0]} material={m(C.white)}>
        <cylinderGeometry args={[0.1, 0.1, 0.03, 24]} />
      </mesh>
      <RBox size={[0.015, 0.07, 0.02]} r={0.005} color={C.plumDark} position={[0, 0.81, 0.32]} />
      <RBox size={[0.05, 0.015, 0.02]} r={0.005} color={C.plumDark} position={[0.02, 0.78, 0.32]} />
      <RBox size={[0.2, 0.3, 0.04]} r={0.03} color={C.violet} position={[0, 0.15, 0.29]} />
      <Windows cols={2} rows={1} w={0.18} h={0.16} x0={-0.3} y0={0.36} z={0.29} dx={0.6} dy={0} />
    </group>
  );
}

/** Law: a courthouse with columns, steps and a pediment. */
function Courthouse() {
  const m = useToy();
  return (
    <group>
      <RBox size={[1.1, 0.08, 0.66]} r={0.02} color={C.ivory} position={[0, 0.04, 0.02]} />
      <RBox size={[1.0, 0.07, 0.58]} r={0.02} color="#EFE6F8" position={[0, 0.115, 0.01]} />
      <RBox size={[0.86, 0.55, 0.3]} r={0.03} color="#EFE6F8" position={[0, 0.42, -0.12]} />
      {[-0.39, -0.13, 0.13, 0.39].map((x) => (
        <mesh key={x} position={[x, 0.42, 0.17]} material={m(C.ivory)}>
          <cylinderGeometry args={[0.05, 0.055, 0.55, 14]} />
        </mesh>
      ))}
      <RBox size={[1.04, 0.07, 0.6]} r={0.02} color={C.ivory} position={[0, 0.72, 0.01]} />
      <Extruded shape={SHAPES.courtRoof} depth={0.58} bevel={0.02} color={C.plum} position={[0, 0.76, 0.01]} />
    </group>
  );
}

/** Business: a small professional office with a welcoming counter and a compact upper room. */
function OfficeBlock() {
  return (
    <group>
      <RBox size={[1.22, 0.1, 0.82]} r={0.04} color={C.wood} position={[0, 0.05, 0]} />
      <RBox size={[1.04, 0.74, 0.66]} r={0.06} color={C.ivory} position={[0, 0.47, -0.08]} />
      <RBox size={[1.12, 0.12, 0.78]} r={0.035} color={C.apricot} position={[0, 0.88, -0.08]} />
      <RBox size={[0.44, 0.38, 0.05]} r={0.035} color="#75969A" position={[-0.25, 0.49, 0.26]} />
      <RBox size={[0.18, 0.35, 0.06]} r={0.03} color={C.wood} position={[0.36, 0.28, 0.28]} />
      <RBox size={[0.52, 0.12, 0.3]} r={0.025} color={C.plum} position={[0.02, 0.27, 0.38]} />
      <RBox size={[0.12, 0.2, 0.1]} r={0.02} color={C.apricot} position={[-0.04, 0.43, 0.36]} />
      <RBox size={[0.72, 0.06, 0.14]} r={0.025} color="#855A37" position={[0, 0.78, 0.39]} />
      {[-0.28, 0.28].map((x) => <RBox key={x} size={[0.06, 0.55, 0.06]} r={0.02} color="#855A37" position={[x, 0.48, 0.43]} />)}
      <RBox size={[0.34, 0.16, 0.04]} r={0.03} color={C.violet} o={{ glow: 0.12 }} position={[0.35, 0.72, 0.28]} />
    </group>
  );
}

/** Media: a small soundstage with a desk, control panel, lights and a cyc wall. */
function MediaStudio() {
  const m = useToy();
  return (
    <group>
      <RBox size={[1.24, 0.09, 0.82]} r={0.035} color={C.wood} position={[0, 0.045, 0]} />
      <RBox size={[1.04, 0.82, 0.1]} r={0.035} color="#6B4739" position={[0, 0.48, -0.34]} />
      <RBox size={[0.13, 0.74, 0.12]} r={0.025} color={C.wood} position={[-0.52, 0.42, 0.02]} />
      <RBox size={[0.13, 0.74, 0.12]} r={0.025} color={C.wood} position={[0.52, 0.42, 0.02]} />
      <RBox size={[1.2, 0.1, 0.94]} r={0.03} color={C.plum} position={[0, 0.87, -0.05]} />
      <RBox size={[0.72, 0.44, 0.035]} r={0.025} color="#334C50" position={[0, 0.57, -0.275]} />
      <RBox size={[0.62, 0.05, 0.27]} r={0.02} color={C.wood} position={[0, 0.3, 0.05]} />
      <RBox size={[0.66, 0.16, 0.3]} r={0.035} color={C.plumDark} position={[0, 0.41, 0.04]} />
      {[-0.23, -0.08, 0.08, 0.23].map((x, i) => <RBox key={x} size={[0.1, 0.06, 0.03]} r={0.012} color={i === 2 ? C.apricot : C.lavender} position={[x, 0.45, 0.2]} />)}
      <RBox size={[0.16, 0.1, 0.06]} r={0.02} color={C.apricot} o={{ glow: 0.25 }} position={[0.32, 0.69, 0.24]} />
      <mesh position={[-0.4, 0.8, 0.45]} rotation={[Math.PI / 2, 0, 0]} material={m(C.ivory)}><circleGeometry args={[0.18, 24]} /></mesh>
      <RBox size={[0.035, 0.28, 0.035]} r={0.01} color={C.wood} position={[-0.4, 0.63, 0.44]} />
      <Blink position={[0.36, 0.95, 0.18]} color={C.apricot} speed={1.3} />
    </group>
  );
}

/** Creative: an easel with a painting in progress. */
function Easel() {
  const m = useToy();
  const dabs: [number, number, string][] = [
    [-0.16, 0.08, C.apricot],
    [0.1, 0.14, C.violet],
    [0.14, -0.1, '#7FB566'],
    [-0.08, -0.12, '#F7B6D2'],
  ];
  return (
    <group rotation={[0, 0.25, 0]}>
      {[-0.22, 0.22].map((x) => (
        <RBox key={x} size={[0.04, 1.2, 0.04]} r={0.015} color={C.wood} position={[x, 0.58, 0.08]} rotation={[-0.12, 0, x * -0.25]} />
      ))}
      <RBox size={[0.04, 1.1, 0.04]} r={0.015} color={C.wood} position={[0, 0.52, -0.22]} rotation={[0.3, 0, 0]} />
      <RBox size={[0.62, 0.48, 0.04]} r={0.02} color={C.white} position={[0, 0.82, 0.13]} rotation={[-0.12, 0, 0]} />
      <group position={[0, 0.82, 0.16]} rotation={[-0.12, 0, 0]}>
        {dabs.map(([x, y, c]) => (
          <mesh key={`${x}${y}`} position={[x, y, 0]} scale={[1, 0.7, 0.3]} material={m(c)}>
            <sphereGeometry args={[0.09, 12, 8]} />
          </mesh>
        ))}
      </group>
      <RBox size={[0.6, 0.04, 0.1]} r={0.015} color={C.wood} position={[0, 0.56, 0.16]} />
    </group>
  );
}

/** Engineering: a tower crane whose jib swings slowly. */
function Crane() {
  const jib = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (jib.current) jib.current.rotation.y = Math.sin(clock.elapsedTime * 0.35) * 0.6;
  });
  return (
    <group>
      <RBox size={[0.4, 0.12, 0.4]} r={0.03} color={C.plum} position={[0, 0.06, 0]} />
      <RBox size={[0.12, 1.5, 0.12]} r={0.02} color={C.apricot} position={[0, 0.85, 0]} />
      {[0.4, 0.8, 1.2].map((y) => (
        <RBox key={y} size={[0.16, 0.03, 0.16]} r={0.01} color={C.plum} position={[0, y, 0]} />
      ))}
      <group ref={jib} position={[0, 1.62, 0]}>
        <RBox size={[1.3, 0.08, 0.1]} r={0.02} color={C.apricot} position={[0.3, 0, 0]} />
        <RBox size={[0.2, 0.16, 0.16]} r={0.03} color={C.plum} position={[-0.28, -0.04, 0]} />
        <RBox size={[0.18, 0.14, 0.14]} r={0.03} color={C.ivory} position={[0.05, -0.12, 0]} />
        <RBox size={[0.01, 0.55, 0.01]} r={0.004} color={C.plumDark} position={[0.82, -0.3, 0]} />
        <RBox size={[0.14, 0.12, 0.14]} r={0.03} color={C.violet} position={[0.82, -0.62, 0]} />
      </group>
    </group>
  );
}

/** Skilled trades: a workshop with a sawtooth roof and a chimney. */
function Workshop() {
  const m = useToy();
  return (
    <group>
      <RBox size={[1.0, 0.55, 0.6]} r={0.05} color={C.ivory} position={[0, 0.275, 0]} />
      <Extruded shape={SHAPES.workshopRoof} depth={0.6} bevel={0.015} color={C.violet} position={[0, 0.55, 0]} />
      <RBox size={[0.36, 0.36, 0.04]} r={0.03} color={C.plum} position={[-0.18, 0.18, 0.31]} />
      {[0, 1, 2].map((i) => (
        <RBox key={i} size={[0.34, 0.02, 0.045]} r={0.005} color="#5B4380" position={[-0.18, 0.08 + i * 0.1, 0.32]} />
      ))}
      <RBox size={[0.16, 0.16, 0.04]} r={0.02} color={C.lavender} o={{ glow: 0.15 }} position={[0.26, 0.32, 0.31]} />
      <mesh position={[0.36, 0.95, -0.12]} material={m(C.plum)}>
        <cylinderGeometry args={[0.06, 0.07, 0.5, 12]} />
      </mesh>
      <Bob amp={0.05} speed={0.8}>
        <mesh position={[0.4, 1.3, -0.12]} material={m(C.white, { opacity: 0.85 })}>
          <sphereGeometry args={[0.1, 12, 8]} />
        </mesh>
      </Bob>
    </group>
  );
}

/** Sports: a small stadium, a green pitch between stands, with floodlights. */
function Stadium() {
  const m = useToy();
  return (
    <group>
      <RBox size={[1.12, 0.06, 0.7]} r={0.03} color="#7FB069" position={[0, 0.03, 0]} />
      <RBox size={[0.02, 0.008, 0.66]} r={0.004} color={C.white} position={[0, 0.065, 0]} />
      <mesh position={[0, 0.066, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m(C.white)}>
        <ringGeometry args={[0.1, 0.12, 24]} />
      </mesh>
      <RBox size={[1.2, 0.34, 0.2]} r={0.04} color={C.violet} position={[0, 0.17, -0.45]} />
      {[0, 1, 2].map((i) => <RBox key={i} size={[1.16, 0.04, 0.05]} r={0.01} color={C.lavender} position={[0, 0.08 + i * 0.1, -0.34]} />)}
      {[-1, 1].map((side) => <RBox key={side} size={[0.18, 0.24, 0.7]} r={0.04} color={C.apricot} position={[side * 0.66, 0.12, 0]} />)}
      {[-1, 1].map((side) => (
        <group key={`light-${side}`} position={[side * 0.62, 0, -0.5]}>
          <mesh position={[0, 0.55, 0]} material={m(C.plum)}>
            <cylinderGeometry args={[0.025, 0.03, 1.1, 8]} />
          </mesh>
          <RBox size={[0.22, 0.12, 0.06]} r={0.02} color={C.ivory} o={{ glow: 0.4 }} position={[0, 1.12, 0.04]} />
          <Blink position={[0, 1.22, 0.04]} color={C.white} speed={0.9} />
        </group>
      ))}
    </group>
  );
}

/** Transport: an airport control tower with a glass cab, beside a small terminal and a windsock. */
function ControlTower() {
  const m = useToy();
  return (
    <group>
      <RBox size={[0.86, 0.34, 0.5]} r={0.05} color={C.white} position={[-0.12, 0.17, 0.08]} />
      <RBox size={[0.8, 0.12, 0.04]} r={0.02} color={C.lavender} o={{ glow: 0.15 }} position={[-0.12, 0.2, 0.34]} />
      <mesh position={[0.36, 0.55, -0.1]} material={m(C.ivory)}>
        <cylinderGeometry args={[0.1, 0.14, 1.1, 18]} />
      </mesh>
      <mesh position={[0.36, 1.18, -0.1]} material={m(C.lavender, { glow: 0.25 })}>
        <cylinderGeometry args={[0.24, 0.18, 0.22, 18]} />
      </mesh>
      <mesh position={[0.36, 1.33, -0.1]} material={m(C.violet)}>
        <cylinderGeometry args={[0.04, 0.27, 0.1, 18]} />
      </mesh>
      <Blink position={[0.36, 1.42, -0.1]} />
      <mesh position={[-0.62, 0.35, -0.2]} material={m(C.plum)}>
        <cylinderGeometry args={[0.015, 0.015, 0.7, 6]} />
      </mesh>
      <Bob amp={0.02} speed={2}>
        <mesh position={[-0.53, 0.66, -0.2]} rotation={[0, 0, Math.PI / 2]} material={m(C.apricot)}>
          <coneGeometry args={[0.05, 0.2, 10]} />
        </mesh>
      </Bob>
    </group>
  );
}

/** Beauty: a little salon with a striped awning, a round mirror sign and a striped pole. */
function Salon() {
  const m = useToy();
  return (
    <group>
      <RBox size={[0.96, 0.66, 0.56]} r={0.06} color={C.white} position={[0, 0.33, 0]} />
      <RBox size={[1.0, 0.08, 0.6]} r={0.03} color={C.violet} position={[0, 0.7, 0]} />
      {[-0.4, -0.2, 0, 0.2, 0.4].map((x, i) => (
        <RBox key={x} size={[0.2, 0.05, 0.2]} r={0.015} color={i % 2 ? C.white : C.apricot} position={[x, 0.55, 0.36]} rotation={[0.45, 0, 0]} />
      ))}
      <RBox size={[0.5, 0.3, 0.03]} r={0.02} color={C.lavender} o={{ glow: 0.15 }} position={[-0.12, 0.25, 0.29]} />
      <RBox size={[0.16, 0.32, 0.03]} r={0.02} color={C.plum} position={[0.32, 0.16, 0.29]} />
      <mesh position={[0, 0.98, 0]} material={m(C.apricot)}>
        <torusGeometry args={[0.16, 0.035, 10, 28]} />
      </mesh>
      <mesh position={[0, 0.98, 0]} material={m(C.lavender, { glow: 0.2 })}>
        <circleGeometry args={[0.13, 24]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0.56, 0.12 + i * 0.12, 0.3]} material={m(i % 2 ? C.white : C.violet)}>
          <cylinderGeometry args={[0.04, 0.04, 0.12, 12]} />
        </mesh>
      ))}
    </group>
  );
}

/** Security: a watchtower with battlements and a flag beside a small guard house. */
function Watchtower() {
  const m = useToy();
  return (
    <group>
      <RBox size={[0.6, 0.4, 0.5]} r={0.05} color={C.ivory} position={[-0.32, 0.2, 0.08]} />
      <RBox size={[0.64, 0.08, 0.54]} r={0.03} color={C.plum} position={[-0.32, 0.44, 0.08]} />
      <RBox size={[0.18, 0.22, 0.03]} r={0.02} color={C.plum} position={[-0.32, 0.11, 0.34]} />
      <RBox size={[0.42, 1.0, 0.42]} r={0.05} color={C.wood} position={[0.3, 0.5, -0.1]} />
      <RBox size={[0.5, 0.08, 0.5]} r={0.02} color={C.plum} position={[0.3, 1.02, -0.1]} />
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => (
        <RBox key={`${sx}${sz}`} size={[0.1, 0.12, 0.1]} r={0.02} color={C.plum} position={[0.3 + sx * 0.2, 1.12, -0.1 + sz * 0.2]} />
      )))}
      <RBox size={[0.16, 0.2, 0.03]} r={0.02} color={C.lavender} o={{ glow: 0.2 }} position={[0.3, 0.7, 0.12]} />
      <mesh position={[0.3, 1.38, -0.1]} material={m(C.plum)}>
        <cylinderGeometry args={[0.015, 0.015, 0.5, 6]} />
      </mesh>
      <Bob amp={0.015} speed={2.4}>
        <RBox size={[0.24, 0.14, 0.015]} r={0.005} color={C.violet} position={[0.42, 1.54, -0.1]} />
      </Bob>
    </group>
  );
}

/** Religion: a calm domed house of worship with a slender tower (no symbol of one faith). */
function DomeHall() {
  const m = useToy();
  return (
    <group>
      <RBox size={[0.86, 0.56, 0.7]} r={0.05} color={C.ivory} position={[-0.08, 0.28, 0]} />
      <mesh position={[-0.08, 0.56, 0]} material={m(C.violet)}>
        <sphereGeometry args={[0.32, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[-0.08, 0.92, 0]} material={m(C.apricot)}>
        <sphereGeometry args={[0.05, 12, 8]} />
      </mesh>
      <RBox size={[0.2, 0.3, 0.03]} r={0.08} color={C.plum} position={[-0.08, 0.15, 0.36]} />
      {[-0.3, 0.14].map((x) => <RBox key={x} size={[0.1, 0.18, 0.03]} r={0.05} color={C.lavender} o={{ glow: 0.2 }} position={[x, 0.36, 0.36]} />)}
      <mesh position={[0.5, 0.6, -0.15]} material={m(C.white)}>
        <cylinderGeometry args={[0.07, 0.09, 1.2, 14]} />
      </mesh>
      <RBox size={[0.2, 0.06, 0.2]} r={0.02} color={C.violet} position={[0.5, 1.0, -0.15]} />
      <mesh position={[0.5, 1.26, -0.15]} material={m(C.violet)}>
        <coneGeometry args={[0.08, 0.2, 14]} />
      </mesh>
    </group>
  );
}

/** Performing arts: a small theatre with a pediment, a curtained stage door and marquee lights. */
function Theatre() {
  return (
    <group>
      <RBox size={[1.0, 0.7, 0.6]} r={0.05} color={C.ivory} position={[0, 0.35, 0]} />
      <Extruded shape={SHAPES.schoolRoof} depth={0.62} bevel={0.015} color={C.violet} position={[0, 0.7, 0]} />
      <RBox size={[0.46, 0.44, 0.04]} r={0.08} color={C.plum} position={[0, 0.24, 0.3]} />
      {[-1, 1].map((side) => <RBox key={side} size={[0.17, 0.4, 0.03]} r={0.04} color="#C24B5A" position={[side * 0.13, 0.25, 0.33]} />)}
      {[-0.4, -0.2, 0, 0.2, 0.4].map((x, i) => <Blink key={x} position={[x, 0.56, 0.32]} color={i % 2 ? C.apricot : C.white} speed={1.2 + i * 0.3} />)}
      {[-1, 1].map((side) => <RBox key={`c-${side}`} size={[0.08, 0.62, 0.08]} r={0.03} color={C.white} position={[side * 0.42, 0.31, 0.31]} />)}
    </group>
  );
}

const LANDMARKS: Record<GroupId, () => ReactNode> = {
  tech: TechStudio,
  science: Observatory,
  health: Clinic,
  agriculture: Greenhouse,
  tourism: Guesthouse,
  education: School,
  law: Courthouse,
  business: OfficeBlock,
  media: MediaStudio,
  creative: Easel,
  engineering: Crane,
  trades: Workshop,
  sports: Stadium,
  transport: ControlTower,
  beauty: Salon,
  security: Watchtower,
  religion: DomeHall,
  performing: Theatre,
};

export function Landmark({ id }: { id: GroupId }) {
  const L = LANDMARKS[id];
  return <L />;
}
