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

/** Tech: a glassy office tower with an antenna. */
function TechTower() {
  const m = useToy();
  return (
    <group>
      <RBox size={[0.62, 1.25, 0.5]} r={0.06} color="#5B3A8C" position={[0, 0.625, 0]} />
      <Windows cols={3} rows={5} w={0.13} h={0.12} x0={-0.17} y0={0.25} z={0.26} dx={0.17} dy={0.2} color="#B9A0F2" />
      <RBox size={[0.68, 0.06, 0.56]} r={0.02} color={C.violet} position={[0, 1.27, 0]} />
      <mesh position={[0.15, 1.55, 0]} material={m(C.ivory)}>
        <cylinderGeometry args={[0.015, 0.02, 0.5, 6]} />
      </mesh>
      <Blink position={[0.15, 1.82, 0]} />
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

/** Agriculture: a windmill whose sails turn. */
function Windmill() {
  const m = useToy();
  const sails = useRef<Group>(null);
  useFrame((_, dt) => {
    if (sails.current) sails.current.rotation.z += dt * 0.6;
  });
  return (
    <group>
      <mesh position={[0, 0.55, 0]} material={m(C.ivory)}>
        <cylinderGeometry args={[0.2, 0.32, 1.1, 8]} />
      </mesh>
      <mesh position={[0, 1.2, 0]} material={m(C.apricot)}>
        <coneGeometry args={[0.26, 0.3, 8]} />
      </mesh>
      <RBox size={[0.14, 0.24, 0.04]} r={0.03} color={C.plum} position={[0, 0.13, 0.3]} />
      <group ref={sails} position={[0, 1.02, 0.24]}>
        <mesh material={m(C.plumDark)}>
          <sphereGeometry args={[0.06, 12, 8]} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <group key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
            <RBox size={[0.03, 0.6, 0.02]} r={0.01} color={C.wood} position={[0, 0.32, 0]} />
            <RBox size={[0.16, 0.46, 0.015]} r={0.01} color={C.ivory} position={[0.09, 0.38, 0.01]} />
          </group>
        ))}
      </group>
    </group>
  );
}

/** Tourism: a felucca (Nile sailing boat), bobbing on the water just off the beach. */
function Felucca() {
  const m = useToy();
  const boat = useRef<Group>(null);
  useFrame(({ clock }) => {
    const g = boat.current;
    if (!g) return;
    g.position.y = Math.sin(clock.elapsedTime * 1.3) * 0.03;
    g.rotation.z = Math.sin(clock.elapsedTime * 1.1) * 0.05;
  });
  return (
    <group ref={boat}>
      <mesh position={[0, 0.06, 0]} rotation={[0, 0, Math.PI]} scale={[1, 0.5, 0.42]} material={m(C.wood)}>
        <sphereGeometry args={[0.5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <RBox size={[0.9, 0.04, 0.36]} r={0.02} color="#C08F5F" position={[0, 0.06, 0]} />
      <mesh position={[0.05, 0.6, 0]} rotation={[0, 0, -0.08]} material={m(C.plumDark)}>
        <cylinderGeometry args={[0.018, 0.022, 1.1, 6]} />
      </mesh>
      <group position={[-0.3, 0.12, 0]} rotation={[0, 0, -0.08]}>
        <Extruded shape={SHAPES.sail} depth={0.01} bevel={0.005} color={C.white} />
      </group>
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

/** Business: an office block with a rooftop sign. */
function OfficeBlock() {
  return (
    <group>
      <RBox size={[0.56, 1.0, 0.48]} r={0.05} color={C.ivory} position={[-0.2, 0.5, 0]} />
      <RBox size={[0.42, 1.45, 0.44]} r={0.05} color={C.plum} position={[0.28, 0.725, -0.04]} />
      <Windows cols={2} rows={4} w={0.15} h={0.12} x0={-0.32} y0={0.2} z={0.25} dx={0.24} dy={0.2} color={C.lavender} />
      <Windows cols={2} rows={6} w={0.11} h={0.1} x0={0.2} y0={0.22} z={0.19} dx={0.16} dy={0.2} color="#B9A0F2" />
      <RBox size={[0.36, 0.14, 0.04]} r={0.03} color={C.apricot} o={{ glow: 0.2 }} position={[0.28, 1.56, 0.0]} />
    </group>
  );
}

/** Media: a broadcast tower with a dish and a blinking light. */
function BroadcastTower() {
  const m = useToy();
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.12, 0.75, 0]} rotation={[0, 0, s * 0.09]} material={m(C.ivory)}>
          <cylinderGeometry args={[0.025, 0.03, 1.5, 6]} />
        </mesh>
      ))}
      {[0.35, 0.75, 1.15].map((y) => (
        <RBox key={y} size={[0.28 - y * 0.12, 0.03, 0.03]} r={0.01} color={C.violet} position={[0, y, 0]} />
      ))}
      <group position={[0.02, 1.0, 0.1]} rotation={[0.5, 0.4, 0]}>
        <mesh material={m(C.white)}>
          <sphereGeometry args={[0.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 3]} />
        </mesh>
      </group>
      <RBox size={[0.36, 0.3, 0.3]} r={0.04} color={C.plum} position={[0.35, 0.15, 0.05]} />
      <Blink position={[0, 1.55, 0]} />
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

const LANDMARKS: Record<GroupId, () => ReactNode> = {
  tech: TechTower,
  science: Observatory,
  health: Clinic,
  agriculture: Windmill,
  tourism: Felucca,
  education: School,
  law: Courthouse,
  business: OfficeBlock,
  media: BroadcastTower,
  creative: Easel,
  engineering: Crane,
  trades: Workshop,
};

export function Landmark({ id }: { id: GroupId }) {
  const L = LANDMARKS[id];
  return <L />;
}
