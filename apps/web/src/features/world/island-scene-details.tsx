'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

import { C, RBox } from './props';
import { useToy } from './materials';
import type { GroupId } from './types';

function TechDetail() {
  return <group>
    <RBox size={[0.58, 0.62, 0.36]} r={0.05} color={C.plum} position={[0, 0.31, 0]} />
    {[0, 1, 2].map((i) => <RBox key={i} size={[0.42, 0.035, 0.025]} r={0.01} color={i === 1 ? C.apricot : C.lavender} position={[0, 0.18 + i * 0.17, 0.19]} />)}
    <RBox size={[0.72, 0.05, 0.48]} r={0.02} color="#6A5146" position={[0, 0.64, 0]} />
    <mesh position={[0.2, 0.9, -0.12]}><cylinderGeometry args={[0.025, 0.035, 0.48, 8]} /><meshStandardMaterial color={C.plumDark} /></mesh>
    <mesh position={[0.2, 1.16, -0.12]}><sphereGeometry args={[0.07, 12, 8]} /><meshStandardMaterial color={C.apricot} emissive={C.apricot} emissiveIntensity={0.35} /></mesh>
    {/* A lit code screen makes this read as a digital workbench, not generic equipment. */}
    <RBox size={[0.3, 0.22, 0.035]} r={0.02} color="#273A4A" position={[-0.28, 0.82, 0.19]} />
    {[0, 1, 2].map((i) => <RBox key={`code-${i}`} size={[0.18 - i * 0.025, 0.018, 0.012]} r={0.006} color={i === 1 ? C.apricot : '#8ED4C4'} position={[-0.3, 0.86 - i * 0.06, 0.214]} />)}
  </group>;
}

function ScienceDetail() {
  const m = useToy();
  return <group>
    {/* Laboratory bench, microscope, and molecule model deliberately contrast with the farm greenhouse. */}
    <RBox size={[0.9, 0.08, 0.58]} r={0.03} color={C.wood} position={[0, 0.04, 0]} />
    <RBox size={[0.76, 0.055, 0.43]} r={0.02} color={C.ivory} position={[0, 0.085, 0]} />
    {[-0.3, 0.3].map((x) => <RBox key={`leg-${x}`} size={[0.055, 0.36, 0.055]} r={0.015} color="#815536" position={[x, -0.12, 0]} />)}
    <RBox size={[0.11, 0.24, 0.12]} r={0.025} color={C.plum} position={[-0.22, 0.24, -0.03]} />
    <RBox size={[0.06, 0.3, 0.06]} r={0.018} color={C.plum} position={[-0.22, 0.48, -0.03]} rotation={[0, 0, -0.35]} />
    <mesh position={[-0.28, 0.65, 0.02]} rotation={[0, 0, -0.35]} material={m(C.apricot)}><cylinderGeometry args={[0.09, 0.06, 0.18, 12]} /></mesh>
    {[-0.02, 0.2].map((x, i) => <group key={`flask-${x}`} position={[x, 0.12, 0.08]}>
      <mesh material={m(i ? '#72B7C1' : '#8FA7DD')}><cylinderGeometry args={[0.09, 0.12, 0.16, 12]} /></mesh>
      <mesh position={[0, 0.13, 0]} material={m(C.ivory)}><cylinderGeometry args={[0.035, 0.07, 0.12, 12]} /></mesh>
    </group>)}
    {[[0.04, 0.66, 0], [0.31, 0.7, 0.04], [0.18, 0.94, -0.01], [0.44, 0.92, 0.03]].map(([x,y,z], i) => <mesh key={`atom-${i}`} position={[x!,y!,z!]} material={m(i % 2 ? C.violet : C.apricot)}><sphereGeometry args={[0.095, 12, 8]} /></mesh>)}
    {[[0.16, 0.68, 0.02, 0.52], [0.25, 0.82, 0.01, -0.7], [0.32, 0.91, 0.02, 0.3]].map(([x,y,z,rz], i) => <RBox key={`bond-${i}`} size={[0.24, 0.035, 0.035]} r={0.015} color={C.ivory} position={[x!,y!,z!]} rotation={[0, 0, rz!]} />)}
  </group>;
}

function HealthDetail() {
  const m = useToy();
  return <group>
    <mesh position={[-0.25, 0.25, 0]} rotation={[0, Math.PI / 2, 0]} material={m(C.plum)}><torusGeometry args={[0.23, 0.035, 10, 24]} /></mesh>
    <mesh position={[0.25, 0.25, 0]} rotation={[0, Math.PI / 2, 0]} material={m(C.plum)}><torusGeometry args={[0.23, 0.035, 10, 24]} /></mesh>
    <RBox size={[0.36, 0.07, 0.3]} r={0.025} color={C.lavender} position={[0, 0.48, -0.04]} />
    <RBox size={[0.08, 0.38, 0.08]} r={0.025} color={C.plum} position={[0, 0.64, -0.16]} />
    <RBox size={[0.36, 0.07, 0.07]} r={0.025} color={C.wood} position={[0, 0.27, 0.01]} />
    <RBox size={[0.07, 0.38, 0.07]} r={0.025} color={C.wood} position={[0, 0.15, -0.2]} />
    <RBox size={[0.12, 0.035, 0.035]} r={0.01} color={C.apricot} position={[0, 0.77, -0.16]} />
    <RBox size={[0.3, 0.36, 0.11]} r={0.04} color={C.ivory} position={[0.43, 0.29, 0.02]} />
    <RBox size={[0.18, 0.05, 0.045]} r={0.015} color={C.violet} position={[0.43, 0.31, 0.083]} />
    <RBox size={[0.055, 0.18, 0.045]} r={0.015} color={C.violet} position={[0.43, 0.31, 0.083]} />
  </group>;
}

function AgricultureDetail() {
  const m = useToy();
  return <group>
    <RBox size={[0.82, 0.08, 0.58]} r={0.06} color="#A8784C" position={[0, 0.05, 0]} />
    {[-0.22, 0, 0.22].map((x) => <group key={x} position={[x, 0.1, 0]}>
      <mesh material={m('#628E48')} position={[0, 0.12, 0]}><cylinderGeometry args={[0.035, 0.035, 0.24, 6]} /></mesh>
      <mesh material={m('#84B65B')} position={[-0.07, 0.16, 0]} rotation={[0, 0, -0.55]}><sphereGeometry args={[0.13, 12, 8]} /></mesh>
      <mesh material={m('#A1C96E')} position={[0.08, 0.19, 0.03]} rotation={[0, 0, 0.55]}><sphereGeometry args={[0.14, 12, 8]} /></mesh>
    </group>)}
    {[-0.33, 0.33].map((x) => <RBox key={x} size={[0.035, 0.2, 0.04]} r={0.01} color={C.wood} position={[x, 0.15, 0.29]} />)}
    {[-0.27, 0, 0.27].map((x, i) => <mesh key={`crop-${i}`} position={[x, 0.24, 0.25]} material={m(i === 1 ? '#E5A742' : '#D85E48')}><sphereGeometry args={[0.075, 12, 8]} /></mesh>)}
  </group>;
}

function TourismDetail() {
  const boat = useRef<Group>(null);
  useFrame(({ clock }) => { if (boat.current) boat.current.position.y = Math.sin(clock.elapsedTime * 1.15) * 0.035; });
  return <group ref={boat}>
    <mesh position={[0, 0.16, 0]} rotation={[Math.PI, 0, 0]} scale={[1.25, 0.4, 0.56]}><sphereGeometry args={[0.42, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#9B603B" /></mesh>
    <RBox size={[0.92, 0.055, 0.4]} r={0.025} color="#C88E57" position={[0, 0.18, 0]} />
    <mesh position={[0, 0.66, -0.02]}><cylinderGeometry args={[0.025, 0.03, 1.0, 8]} /><meshStandardMaterial color="#65472F" /></mesh>
    <RBox size={[0.38, 0.62, 0.035]} r={0.015} color={C.ivory} position={[-0.2, 0.58, 0.02]} rotation={[0, 0, -0.08]} />
    <RBox size={[0.32, 0.47, 0.035]} r={0.015} color={C.apricot} position={[0.2, 0.52, 0.02]} rotation={[0, 0, 0.08]} />
    <RBox size={[0.44, 0.04, 0.04]} r={0.015} color="#65472F" position={[0, 0.18, 0.2]} />
    <RBox size={[0.24, 0.16, 0.2]} r={0.035} color={C.violet} position={[0.3, 0.32, -0.06]} />
    <RBox size={[0.12, 0.035, 0.05]} r={0.015} color={C.apricot} position={[0.3, 0.42, -0.06]} />
  </group>;
}

function EducationDetail() {
  return <group rotation={[0, 0, -0.12]}>
    <RBox size={[0.68, 0.09, 0.46]} r={0.035} color={C.wood} position={[0, 0.42, 0]} />
    <RBox size={[0.58, 0.06, 0.4]} r={0.02} color={C.ivory} position={[0, 0.5, 0]} />
    <RBox size={[0.42, 0.06, 0.3]} r={0.025} color={C.violet} position={[-0.03, 0.59, -0.01]} rotation={[0, 0, 0.12]} />
    <RBox size={[0.38, 0.04, 0.28]} r={0.02} color={C.apricot} position={[0.03, 0.65, -0.015]} rotation={[0, 0, -0.15]} />
    {[-0.25, 0.25].map((x) => <RBox key={x} size={[0.06, 0.4, 0.06]} r={0.02} color={C.wood} position={[x, 0.2, 0]} />)}
    <mesh position={[0.2, 0.77, -0.04]} rotation={[0.15, 0, 0]}><cylinderGeometry args={[0.14, 0.14, 0.07, 16]} /><meshStandardMaterial color={C.violet} /></mesh>
    <RBox size={[0.32, 0.035, 0.055]} r={0.015} color={C.violet} position={[0.2, 0.8, -0.04]} rotation={[0, 0, -0.08]} />
    <RBox size={[0.025, 0.22, 0.025]} r={0.01} color={C.apricot} position={[0.34, 0.61, -0.04]} />
  </group>;
}

function LawDetail() {
  const m = useToy();
  return <group>
    <RBox size={[0.62, 0.08, 0.34]} r={0.03} color={C.plum} position={[0, 0.05, 0]} />
    <mesh position={[0, 0.56, 0]} material={m(C.apricot)}><cylinderGeometry args={[0.035, 0.05, 0.92, 10]} /></mesh>
    <mesh position={[0, 1.02, 0]} material={m(C.apricot)}><sphereGeometry args={[0.08, 12, 8]} /></mesh>
    <RBox size={[0.78, 0.055, 0.06]} r={0.025} color={C.ivory} position={[0, 0.87, 0]} />
    {[-0.29, 0.29].map((x) => <group key={x}>
      <mesh position={[x, 0.68, 0]} material={m(C.wood)}><cylinderGeometry args={[0.012, 0.016, 0.35, 6]} /></mesh>
      <mesh position={[x, 0.48, 0]} material={m(C.lavender)}><sphereGeometry args={[0.16, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
    </group>)}
  </group>;
}

function BusinessDetail() {
  return <group>
    {[-0.22, 0.22].map((x, i) => <RBox key={x} size={[0.36, 0.38 + i * 0.12, 0.34]} r={0.04} color={i ? C.apricot : C.wood} position={[x, 0.2 + i * 0.06, 0]} />)}
    <RBox size={[0.84, 0.08, 0.52]} r={0.04} color={C.plum} position={[0, 0.48, 0]} />
    <RBox size={[0.42, 0.04, 0.18]} r={0.02} color={C.lavender} position={[0, 0.55, 0.05]} />
    <RBox size={[0.14, 0.24, 0.035]} r={0.025} color={C.apricot} position={[0, 0.7, 0]} />
    {/* Rising columns and a briefcase mark commerce and finance clearly at thumbnail scale. */}
    {[0, 1, 2].map((i) => <RBox key={`bar-${i}`} size={[0.09, 0.18 + i * 0.09, 0.09]} r={0.015} color={i === 1 ? C.apricot : C.violet} position={[0.52, 0.1 + i * 0.045, -0.12 + i * 0.14]} />)}
    <RBox size={[0.29, 0.2, 0.08]} r={0.035} color={C.plum} position={[-0.34, 0.72, 0.2]} />
    <RBox size={[0.13, 0.06, 0.04]} r={0.02} color={C.apricot} position={[-0.34, 0.85, 0.2]} />
    <RBox size={[0.05, 0.05, 0.025]} r={0.015} color={C.ivory} position={[-0.34, 0.71, 0.245]} />
  </group>;
}

function MediaDetail() {
  const m = useToy();
  const camera = useRef<Group>(null);
  useFrame(({ clock }) => { if (camera.current) camera.current.rotation.y = Math.sin(clock.elapsedTime * 0.55) * 0.1; });
  return <group>
    {[-0.2, 0.2].map((x) => <RBox key={x} size={[0.035, 0.62, 0.035]} r={0.012} color={C.wood} position={[x, 0.31, 0.05]} rotation={[0, 0, x * 0.35]} />)}
    <RBox size={[0.5, 0.05, 0.05]} r={0.02} color={C.wood} position={[0, 0.08, 0.05]} />
    <group ref={camera} position={[0, 0.72, 0]}>
      <RBox size={[0.52, 0.31, 0.32]} r={0.06} color={C.plum} />
      <mesh position={[0.04, 0, 0.2]}><cylinderGeometry args={[0.12, 0.12, 0.1, 20]} /><meshStandardMaterial color={C.lavender} /></mesh>
      <RBox size={[0.16, 0.1, 0.16]} r={0.03} color={C.apricot} position={[0, 0.19, -0.02]} />
    </group>
    <RBox size={[0.34, 0.22, 0.04]} r={0.025} color={C.apricot} position={[0.38, 0.31, 0.2]} rotation={[0, 0, -0.12]} />
    <RBox size={[0.24, 0.035, 0.02]} r={0.01} color={C.ivory} position={[0.38, 0.31, 0.225]} rotation={[0, 0, -0.12]} />
    <mesh position={[-0.42, 0.25, 0.03]} material={m(C.plum)}><cylinderGeometry args={[0.045, 0.055, 0.25, 12]} /></mesh>
  </group>;
}

function CreativeDetail() {
  const m = useToy();
  return <group>
    <mesh position={[0, 0.12, 0]} material={m(C.plum)}><cylinderGeometry args={[0.44, 0.5, 0.2, 24]} /></mesh>
    <mesh position={[0, 0.63, 0]} rotation={[0.65, 0.3, 0]} material={m(C.apricot)}><torusGeometry args={[0.28, 0.065, 12, 28]} /></mesh>
    <mesh position={[0.12, 0.72, 0.02]} rotation={[-0.7, -0.3, 0.1]} material={m(C.violet)}><torusGeometry args={[0.25, 0.06, 12, 28]} /></mesh>
    <mesh position={[0, 0.48, 0.06]} material={m(C.lavender)}><sphereGeometry args={[0.12, 16, 10]} /></mesh>
    <RBox size={[0.26, 0.045, 0.08]} r={0.015} color={C.wood} position={[-0.35, 0.19, 0.22]} rotation={[0, 0, -0.15]} />
    <mesh position={[-0.35, 0.28, 0.2]} rotation={[0, 0, -0.15]} material={m(C.apricot)}><cylinderGeometry args={[0.018, 0.035, 0.18, 8]} /></mesh>
    <mesh position={[0.32, 0.16, 0.2]} material={m('#E6B84D')}><cylinderGeometry args={[0.11, 0.08, 0.18, 10]} /></mesh>
  </group>;
}

function EngineeringDetail() {
  return <group>
    <RBox size={[1.04, 0.09, 0.28]} r={0.025} color={C.wood} position={[0, 0.54, 0]} />
    {[-0.45, -0.15, 0.15, 0.45].map((x) => <RBox key={`post-${x}`} size={[0.055, 0.34, 0.22]} r={0.015} color={C.apricot} position={[x, 0.72, 0]} />)}
    {[-0.3, 0, 0.3].map((x) => <group key={`truss-${x}`}>
      <RBox size={[0.38, 0.045, 0.045]} r={0.012} color={C.plum} position={[x, 0.86, 0]} rotation={[0, 0, 0.46]} />
      <RBox size={[0.38, 0.045, 0.045]} r={0.012} color={C.plum} position={[x, 0.86, 0]} rotation={[0, 0, -0.46]} />
    </group>)}
    <RBox size={[0.82, 0.05, 0.08]} r={0.02} color={C.ivory} position={[0, 1.0, 0]} />
    <RBox size={[0.42, 0.04, 0.32]} r={0.02} color="#E9D9BC" position={[0.53, 0.57, 0.28]} rotation={[0, 0, -0.08]} />
    {[-0.12, 0, 0.12].map((x) => <RBox key={`plan-${x}`} size={[0.018, 0.004, 0.25]} r={0.002} color="#7793A0" position={[0.53 + x, 0.595, 0.28]} />)}
    <mesh position={[-0.48, 0.2, 0.12]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.16, 0.035, 8, 20]} /><meshStandardMaterial color={C.violet} /></mesh>
    <mesh position={[-0.48, 0.2, 0.14]}><cylinderGeometry args={[0.045, 0.045, 0.1, 12]} /><meshStandardMaterial color={C.apricot} /></mesh>
  </group>;
}

function TradesDetail() {
  return <group>
    <RBox size={[0.72, 0.09, 0.44]} r={0.035} color={C.wood} position={[0, 0.45, 0]} />
    {[-0.25, 0.25].map((x) => <RBox key={x} size={[0.065, 0.44, 0.08]} r={0.02} color="#815536" position={[x, 0.22, 0]} />)}
    <RBox size={[0.38, 0.11, 0.12]} r={0.025} color={C.plum} position={[-0.1, 0.56, 0]} />
    <RBox size={[0.06, 0.38, 0.06]} r={0.025} color={C.apricot} position={[0.23, 0.7, 0]} rotation={[0, 0, -0.35]} />
    <RBox size={[0.22, 0.15, 0.08]} r={0.035} color={C.ivory} position={[0.35, 0.87, 0]} rotation={[0, 0, -0.35]} />
    <mesh position={[-0.35, 0.77, 0.08]}><sphereGeometry args={[0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={C.apricot} /></mesh>
    <RBox size={[0.07, 0.09, 0.055]} r={0.02} color={C.apricot} position={[-0.35, 0.72, 0.08]} />
    <RBox size={[0.12, 0.28, 0.1]} r={0.03} color={C.lavender} position={[0.47, 0.22, 0.12]} />
    <RBox size={[0.18, 0.045, 0.04]} r={0.015} color={C.apricot} position={[0.47, 0.37, 0.12]} />
  </group>;
}

function SportsDetail() {
  return <group>
    {/* A marked mini pitch and goal make this read as an active sports ground. */}
    <RBox size={[0.98, 0.035, 0.68]} r={0.08} color="#83A969" position={[0, 0.025, 0]} />
    <RBox size={[0.88, 0.012, 0.58]} r={0.04} color="#A6C282" position={[0, 0.047, 0]} />
    <RBox size={[0.012, 0.008, 0.56]} r={0.004} color={C.ivory} position={[0, 0.057, 0]} />
    <mesh position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.12, 0.009, 6, 24]} /><meshStandardMaterial color={C.ivory} /></mesh>
    {[-0.41, 0.41].map((x) => <group key={x} position={[x, 0.06, 0]}>
      {[-0.16, 0.16].map((z) => <RBox key={z} size={[0.025, 0.27, 0.025]} r={0.008} color={C.ivory} position={[0, 0.135, z]} />)}
      <RBox size={[0.025, 0.025, 0.34]} r={0.008} color={C.ivory} position={[0, 0.27, 0]} />
      <RBox size={[0.32, 0.21, 0.018]} r={0.015} color="#DCE5D4" position={[0, 0.14, -0.015]} />
    </group>)}
    <mesh position={[0.18, 0.105, 0.28]}><sphereGeometry args={[0.085, 18, 12]} /><meshStandardMaterial color={C.ivory} /></mesh>
    {[0, 1, 2].map((i) => <RBox key={i} size={[0.025, 0.006, 0.03]} r={0.006} color={C.plum} position={[0.18 + (i - 1) * 0.035, 0.18, 0.28]} rotation={[0, i * 0.9, 0]} />)}
    <RBox size={[0.36, 0.18, 0.08]} r={0.035} color={C.plum} position={[-0.42, 0.48, -0.2]} />
    <RBox size={[0.25, 0.07, 0.02]} r={0.015} color={C.apricot} position={[-0.42, 0.49, -0.155]} />
    <RBox size={[0.17, 0.025, 0.02]} r={0.008} color={C.ivory} position={[-0.42, 0.41, -0.155]} />
  </group>;
}

function TransportDetail() {
  return <group>
    {/* Compact island station: platform, rails, a two-car tram, and a shelter. */}
    <RBox size={[1.02, 0.07, 0.62]} r={0.07} color="#C9B89D" position={[0, 0.05, 0]} />
    <RBox size={[0.92, 0.035, 0.49]} r={0.05} color={C.ivory} position={[0, 0.1, 0]} />
    {[-0.18, 0.18].map((z) => <RBox key={`rail-${z}`} size={[0.92, 0.025, 0.025]} r={0.01} color="#6D7279" position={[0, 0.14, z]} />)}
    {[-0.38, -0.19, 0, 0.19, 0.38].map((x) => <RBox key={`tie-${x}`} size={[0.045, 0.02, 0.5]} r={0.01} color={C.wood} position={[x, 0.125, 0]} />)}
    <RBox size={[0.76, 0.28, 0.34]} r={0.08} color={C.apricot} position={[0, 0.35, 0.02]} />
    <RBox size={[0.7, 0.08, 0.35]} r={0.05} color={C.violet} position={[0, 0.49, 0.02]} />
    {[-0.25, -0.08, 0.09, 0.26].map((x) => <RBox key={`window-${x}`} size={[0.12, 0.12, 0.018]} r={0.025} color="#B9DFE1" position={[x, 0.38, 0.196]} />)}
    {[-0.24, 0.24].map((x) => <group key={`wheel-${x}`}>
      <mesh position={[x, 0.19, 0.17]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.075, 0.075, 0.045, 16]} /><meshStandardMaterial color="#493C3C" /></mesh>
      <mesh position={[x, 0.19, 0.198]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.032, 0.032, 0.05, 12]} /><meshStandardMaterial color={C.apricot} /></mesh>
    </group>)}
    {[-0.37, 0.37].map((x) => <RBox key={`post-${x}`} size={[0.035, 0.55, 0.035]} r={0.012} color={C.wood} position={[x, 0.4, -0.24]} />)}
    <RBox size={[0.86, 0.055, 0.39]} r={0.035} color={C.wood} position={[0, 0.68, -0.24]} />
    <RBox size={[0.8, 0.025, 0.34]} r={0.02} color={C.lavender} position={[0, 0.72, -0.24]} />
    <RBox size={[0.3, 0.2, 0.05]} r={0.025} color={C.plum} position={[-0.42, 0.36, -0.25]} />
    <RBox size={[0.2, 0.08, 0.02]} r={0.012} color={C.apricot} position={[-0.42, 0.38, -0.218]} />
  </group>;
}

function BeautyDetail() {
  return <group>
    {/* A professional grooming studio: barber chair, tall mirror, counter and tools. */}
    <RBox size={[0.98, 0.06, 0.62]} r={0.05} color={C.wood} position={[0, 0.03, 0]} />
    <RBox size={[0.42, 0.22, 0.38]} r={0.08} color={C.violet} position={[-0.23, 0.21, 0.03]} />
    <RBox size={[0.38, 0.34, 0.13]} r={0.08} color={C.plum} position={[-0.23, 0.47, -0.09]} />
    <RBox size={[0.25, 0.06, 0.09]} r={0.025} color={C.apricot} position={[-0.23, 0.63, -0.09]} />
    <mesh position={[-0.23, 0.34, 0.03]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.1, 0.1, 0.08, 16]} /><meshStandardMaterial color={C.wood} /></mesh>
    <RBox size={[0.36, 0.44, 0.045]} r={0.08} color={C.plum} position={[0.31, 0.57, -0.2]} />
    <RBox size={[0.27, 0.34, 0.018]} r={0.06} color="#A9D5D5" position={[0.31, 0.58, -0.172]} />
    <mesh position={[0.31, 0.58, -0.154]}><torusGeometry args={[0.145, 0.018, 8, 24]} /><meshStandardMaterial color={C.apricot} /></mesh>
    <RBox size={[0.62, 0.08, 0.2]} r={0.03} color={C.wood} position={[0.25, 0.17, 0.13]} />
    {[-0.1, 0.06, 0.22, 0.36].map((x, i) => <mesh key={`bottle-${x}`} position={[x, 0.27, 0.14]}><cylinderGeometry args={[0.035, 0.045, 0.16 + (i % 2) * 0.045, 10]} /><meshStandardMaterial color={[C.apricot, C.lavender, C.ivory, C.violet][i]!} /></mesh>)}
    <RBox size={[0.11, 0.22, 0.035]} r={0.02} color="#59616E" position={[-0.47, 0.22, 0.2]} rotation={[0, 0, 0.18]} />
    <RBox size={[0.07, 0.09, 0.025]} r={0.02} color={C.apricot} position={[-0.47, 0.36, 0.2]} />
  </group>;
}

function SecurityDetail() {
  return <group>
    {/* A compact civic safety post with tower, beacon, shield and barrier. */}
    <RBox size={[0.92, 0.06, 0.58]} r={0.05} color="#BCA990" position={[0, 0.03, 0]} />
    <RBox size={[0.42, 0.36, 0.3]} r={0.045} color={C.ivory} position={[-0.17, 0.22, -0.08]} />
    <RBox size={[0.5, 0.08, 0.36]} r={0.035} color={C.violet} position={[-0.17, 0.44, -0.08]} />
    <RBox size={[0.25, 0.12, 0.035]} r={0.02} color="#B9DCDD" position={[-0.17, 0.25, 0.078]} />
    <RBox size={[0.035, 0.16, 0.04]} r={0.012} color={C.plum} position={[-0.17, 0.25, 0.1]} />
    <RBox size={[0.26, 0.42, 0.25]} r={0.045} color={C.wood} position={[0.37, 0.24, -0.12]} />
    <RBox size={[0.32, 0.07, 0.32]} r={0.035} color={C.plum} position={[0.37, 0.49, -0.12]} />
    <RBox size={[0.18, 0.18, 0.035]} r={0.04} color={C.apricot} position={[0.37, 0.3, 0.02]} />
    <mesh position={[0.37, 0.3, 0.047]}><torusGeometry args={[0.045, 0.012, 8, 16]} /><meshStandardMaterial color={C.ivory} /></mesh>
    <RBox size={[0.08, 0.55, 0.08]} r={0.025} color={C.plum} position={[-0.44, 0.3, 0.2]} />
    <mesh position={[-0.44, 0.65, 0.2]}><sphereGeometry args={[0.075, 12, 8]} /><meshStandardMaterial color={C.apricot} emissive={C.apricot} emissiveIntensity={0.35} /></mesh>
    <RBox size={[0.47, 0.045, 0.045]} r={0.016} color={C.white} position={[-0.16, 0.1, 0.27]} />
    {[-0.35, 0.03].map((x) => <RBox key={x} size={[0.045, 0.13, 0.045]} r={0.012} color={C.apricot} position={[x, 0.1, 0.27]} />)}
  </group>;
}

function ReligionDetail() {
  return <group>
    {/* Quiet, welcoming prayer pavilion: archway, dome, crescent and a small garden approach. */}
    <RBox size={[0.88, 0.07, 0.56]} r={0.05} color="#D3C0A1" position={[0, 0.035, 0]} />
    <RBox size={[0.66, 0.11, 0.42]} r={0.035} color={C.ivory} position={[0, 0.1, -0.04]} />
    <RBox size={[0.52, 0.42, 0.34]} r={0.055} color="#E7D4B4" position={[0, 0.35, -0.07]} />
    {[-0.2, 0.2].map((x) => <RBox key={`pillar-${x}`} size={[0.08, 0.4, 0.09]} r={0.025} color={C.ivory} position={[x, 0.34, 0.13]} />)}
    <RBox size={[0.48, 0.08, 0.1]} r={0.025} color={C.apricot} position={[0, 0.58, 0.12]} />
    <mesh position={[0, 0.73, -0.06]}><sphereGeometry args={[0.22, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={C.violet} /></mesh>
    <mesh position={[0, 0.76, -0.06]}><cylinderGeometry args={[0.22, 0.22, 0.055, 20]} /><meshStandardMaterial color={C.violet} /></mesh>
    <mesh position={[0, 0.98, -0.06]}><cylinderGeometry args={[0.018, 0.024, 0.18, 8]} /><meshStandardMaterial color={C.apricot} /></mesh>
    <mesh position={[0.01, 1.09, -0.06]}><torusGeometry args={[0.055, 0.012, 8, 20, Math.PI * 1.65]} /><meshStandardMaterial color={C.apricot} /></mesh>
    <RBox size={[0.16, 0.24, 0.08]} r={0.045} color={C.wood} position={[0, 0.22, 0.2]} />
    <RBox size={[0.11, 0.14, 0.025]} r={0.035} color={C.plum} position={[0, 0.23, 0.25]} />
    {[-0.37, 0.37].map((x) => <group key={`plant-${x}`} position={[x, 0.1, 0.18]}>
      <mesh><cylinderGeometry args={[0.06, 0.08, 0.14, 10]} /><meshStandardMaterial color={C.wood} /></mesh>
      <mesh position={[0, 0.16, 0]}><sphereGeometry args={[0.12, 12, 8]} /><meshStandardMaterial color={C.green} /></mesh>
    </group>)}
  </group>;
}

function PerformingDetail() {
  return <group>
    {/* A tiny open-air theatre with curtains, lit footlights and recognizable instruments. */}
    <RBox size={[0.98, 0.08, 0.55]} r={0.05} color={C.wood} position={[0, 0.04, -0.04]} />
    <RBox size={[0.86, 0.08, 0.44]} r={0.04} color={C.plum} position={[0, 0.12, -0.04]} />
    <RBox size={[0.8, 0.035, 0.38]} r={0.025} color="#8A5A75" position={[0, 0.18, -0.04]} />
    <RBox size={[0.055, 0.72, 0.055]} r={0.02} color={C.wood} position={[-0.43, 0.48, -0.2]} />
    <RBox size={[0.055, 0.72, 0.055]} r={0.02} color={C.wood} position={[0.43, 0.48, -0.2]} />
    <RBox size={[0.95, 0.065, 0.1]} r={0.025} color={C.apricot} position={[0, 0.85, -0.2]} />
    <RBox size={[0.16, 0.54, 0.09]} r={0.035} color={C.violet} position={[-0.34, 0.52, -0.12]} />
    <RBox size={[0.16, 0.54, 0.09]} r={0.035} color={C.violet} position={[0.34, 0.52, -0.12]} />
    {[-0.27, -0.09, 0.09, 0.27].map((x) => <mesh key={`light-${x}`} position={[x, 0.24, 0.18]}><sphereGeometry args={[0.035, 10, 8]} /><meshStandardMaterial color={C.apricot} emissive={C.apricot} emissiveIntensity={0.55} /></mesh>)}
    {/* Floor microphone */}
    <mesh position={[-0.23, 0.48, 0.09]}><cylinderGeometry args={[0.018, 0.022, 0.46, 8]} /><meshStandardMaterial color="#59616E" /></mesh>
    <mesh position={[-0.23, 0.73, 0.09]} rotation={[0, 0, -0.45]}><cylinderGeometry args={[0.025, 0.035, 0.16, 10]} /><meshStandardMaterial color={C.apricot} /></mesh>
    <mesh position={[-0.23, 0.24, 0.09]}><cylinderGeometry args={[0.12, 0.12, 0.025, 14]} /><meshStandardMaterial color={C.plumDark} /></mesh>
    {/* Guitar and its neck */}
    <mesh position={[0.22, 0.35, 0.14]} rotation={[0, 0, -0.22]}><sphereGeometry args={[0.16, 16, 10]} scale={[0.75, 1, 0.35]} /><meshStandardMaterial color={C.apricot} /></mesh>
    <RBox size={[0.06, 0.35, 0.045]} r={0.012} color={C.wood} position={[0.28, 0.58, 0.14]} rotation={[0, 0, -0.22]} />
    <mesh position={[0.22, 0.35, 0.195]}><circleGeometry args={[0.035, 12]} /><meshStandardMaterial color={C.plum} /></mesh>
    {/* Small drum */}
    <mesh position={[0.45, 0.28, -0.02]}><cylinderGeometry args={[0.1, 0.1, 0.16, 16]} /><meshStandardMaterial color={C.violet} /></mesh>
    <mesh position={[0.45, 0.37, -0.02]}><cylinderGeometry args={[0.1, 0.1, 0.025, 16]} /><meshStandardMaterial color={C.ivory} /></mesh>
  </group>;
}

const DETAILS: Record<GroupId, () => React.JSX.Element> = {
  tech: TechDetail,
  science: ScienceDetail,
  health: HealthDetail,
  agriculture: AgricultureDetail,
  tourism: TourismDetail,
  education: EducationDetail,
  law: LawDetail,
  business: BusinessDetail,
  media: MediaDetail,
  creative: CreativeDetail,
  engineering: EngineeringDetail,
  trades: TradesDetail,
  sports: SportsDetail,
  transport: TransportDetail,
  beauty: BeautyDetail,
  security: SecurityDetail,
  religion: ReligionDetail,
  performing: PerformingDetail,
};

/** Distinct, modeled scene dressing for each career island, built from Three.js meshes. */
export function IslandSceneDetail({ id }: { id: GroupId }) {
  const Detail = DETAILS[id];
  return <Detail />;
}
