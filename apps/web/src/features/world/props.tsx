'use client';

import { useFrame, type ThreeElements } from '@react-three/fiber';
import { useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  CanvasTexture,
  CatmullRomCurve3,
  ExtrudeGeometry,
  MeshStandardMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  type Group,
  type Shape,
} from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

import {
  bubbleShape,
  gearShape,
  nibShape,
  roundedBox,
  setSquareShape,
  wrenchShape,
} from './geometry';
import { BRAND, muteColor, MutedContext, SCENE, useToy, type ToyOptions } from './materials';
import type { GroupId } from './types';

type MeshProps = Omit<ThreeElements['mesh'], 'args'>;

export const C = {
  violet: BRAND.violet,
  apricot: BRAND.apricot,
  plum: '#624733',
  plumDark: BRAND.plum,
  ivory: BRAND.ivory,
  white: '#FFFFFF',
  lavender: SCENE.lavender,
  lilac: SCENE.lilac,
  sand: '#F4C892',
  wood: '#D9A877',
  green: SCENE.tree,
};

export function RBox({ size, r = 0.06, color, o, ...rest }: MeshProps & { size: [number, number, number]; r?: number; color: string; o?: ToyOptions }) {
  const m = useToy();
  return <mesh geometry={roundedBox(size[0], size[1], size[2], r)} material={m(color, o)} {...rest} />;
}

export function Extruded({ shape, depth, bevel = 0.025, color, o, ...rest }: MeshProps & { shape: Shape; depth: number; bevel?: number; color: string; o?: ToyOptions }) {
  const m = useToy();
  const geo = useMemo(() => {
    const g = new ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 3,
      curveSegments: 24,
    });
    g.translate(0, 0, -depth / 2);
    return g;
  }, [shape, depth, bevel]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={m(color, o)} {...rest} />;
}

export function Tube({ points, radius, color, closed = false, ...rest }: MeshProps & { points: [number, number, number][]; radius: number; color: string; closed?: boolean }) {
  const m = useToy();
  const curve = useMemo(() => new CatmullRomCurve3(points.map((p) => new Vector3(...p)), closed), [points, closed]);
  return (
    <mesh material={m(color)} {...rest}>
      <tubeGeometry args={[curve, 48, radius, 10, closed]} />
    </mesh>
  );
}

/** Gentle idle bob for floating parts. */
export function Bob({ children, amp = 0.05, speed = 1.2, phase = 0 }: { children: ReactNode; amp?: number; speed?: number; phase?: number }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = Math.sin(clock.elapsedTime * speed + phase) * amp;
  });
  return <group ref={ref}>{children}</group>;
}

// --- Shapes (built once) ------------------------------------------------------

const SHAPES = {
  setSquare: setSquareShape(1.05, 1.3, 0.2),
  bubble: bubbleShape(0.82, 0.56, 0.16),
  gearBig: gearShape(10, 0.56, 0.44, 0.17),
  gearSmall: gearShape(8, 0.34, 0.26, 0.1),
  wrench: wrenchShape(0.95, 0.075, 0.2, 0.08),
  nib: nibShape(0.62, 1.0),
};

// --- Group icons --------------------------------------------------------------

function screenTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 512, 320);
  g.addColorStop(0, '#8A4BE0');
  g.addColorStop(1, '#5A1FA3');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 320);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 150px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('</>', 256, 168);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function Laptop() {
  const muted = useContext(MutedContext);
  const tex = useMemo(() => screenTexture(), []);
  const screenMat = useMemo(
    () =>
      new MeshStandardMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: '#ffffff',
        emissiveIntensity: muted ? 0.15 : 0.55,
        color: muted ? muteColor('#ffffff') : '#ffffff',
        roughness: 0.3,
      }),
    [tex, muted],
  );
  useEffect(() => () => (tex.dispose(), screenMat.dispose()), [tex, screenMat]);
  return (
    <group position={[0, 0, 0.1]}>
      <RBox size={[1.55, 0.09, 1.0]} r={0.04} color={C.plum} position={[0, 0.045, 0]} />
      <RBox size={[1.3, 0.02, 0.52]} r={0.01} color="#5B4380" position={[0, 0.095, 0.12]} />
      <group position={[0, 0.07, -0.48]} rotation={[-0.2, 0, 0]}>
        <RBox size={[1.55, 1.02, 0.07]} r={0.04} color={C.plum} position={[0, 0.51, 0]} />
        <mesh position={[0, 0.51, 0.04]} material={screenMat}>
          <planeGeometry args={[1.38, 0.86]} />
        </mesh>
      </group>
    </group>
  );
}

function Health() {
  const m = useToy();
  const steth: [number, number, number][] = [
    [-1.0, 1.3, 0],
    [-1.02, 0.95, 0.02],
    [-0.8, 0.66, 0.04],
    [-0.55, 0.92, 0.02],
    [-0.52, 1.3, 0],
  ];
  const hose: [number, number, number][] = [
    [-0.79, 0.66, 0.04],
    [-0.82, 0.38, 0.12],
    [-0.62, 0.16, 0.3],
    [-0.32, 0.2, 0.42],
    [-0.22, 0.34, 0.42],
  ];
  return (
    <group position={[0.15, 0, 0]}>
      <RBox size={[0.95, 0.7, 0.6]} r={0.12} color={C.violet} position={[0.32, 0.36, -0.05]} />
      <mesh position={[0.32, 0.76, -0.05]} material={m(C.plum)}>
        <torusGeometry args={[0.17, 0.05, 10, 24, Math.PI]} />
      </mesh>
      <mesh position={[0.32, 0.38, 0.26]} rotation={[Math.PI / 2, 0, 0]} material={m(C.white)}>
        <cylinderGeometry args={[0.22, 0.22, 0.03, 32]} />
      </mesh>
      <RBox size={[0.26, 0.08, 0.03]} r={0.012} color={C.violet} position={[0.32, 0.38, 0.28]} />
      <RBox size={[0.08, 0.26, 0.03]} r={0.012} color={C.violet} position={[0.32, 0.38, 0.28]} />
      <Tube points={steth} radius={0.045} color={C.plum} />
      <Tube points={hose} radius={0.045} color={C.plum} />
      <mesh position={[-1.0, 1.32, 0]} material={m(C.plumDark)}>
        <sphereGeometry args={[0.07, 16, 12]} />
      </mesh>
      <mesh position={[-0.52, 1.32, 0]} material={m(C.plumDark)}>
        <sphereGeometry args={[0.07, 16, 12]} />
      </mesh>
      <mesh position={[-0.2, 0.36, 0.42]} rotation={[0, 0, Math.PI / 2]} material={m(C.lavender, { rough: 0.25 })}>
        <cylinderGeometry args={[0.15, 0.15, 0.09, 24]} />
      </mesh>
    </group>
  );
}

function Engineering() {
  return (
    <group>
      <Extruded shape={SHAPES.setSquare} depth={0.12} color={C.apricot} position={[-0.15, 0.06, 0.05]} rotation={[0, -0.35, 0]} />
      {[0, 1, 2].map((i) => (
        <RBox key={`a${i}`} size={[0.34, 0.34, 0.34]} r={0.05} color={i === 1 ? '#EFE6F8' : C.ivory} position={[-0.72, 0.17 + i * 0.35, -0.25]} />
      ))}
      {[0, 1].map((i) => (
        <RBox key={`b${i}`} size={[0.3, 0.3, 0.3]} r={0.05} color={i ? C.ivory : '#EFE6F8'} position={[-0.38, 0.15 + i * 0.31, -0.55]} />
      ))}
    </group>
  );
}

function Business() {
  return (
    <group>
      <RBox size={[1.05, 0.72, 0.38]} r={0.08} color={C.plum} position={[-0.25, 0.36, 0.05]} />
      <RBox size={[1.07, 0.04, 0.4]} r={0.015} color={C.plumDark} position={[-0.25, 0.5, 0.05]} />
      <RBox size={[0.16, 0.14, 0.06]} r={0.02} color={C.apricot} position={[-0.25, 0.47, 0.25]} />
      <BriefHandle />
      <RBox size={[0.15, 0.78, 0.52]} r={0.03} color={C.apricot} position={[0.5, 0.39, -0.05]} />
      <RBox size={[0.13, 0.64, 0.48]} r={0.03} color={C.lavender} position={[0.67, 0.32, -0.05]} />
      <RBox size={[0.15, 0.84, 0.52]} r={0.03} color={C.violet} position={[0.86, 0.43, -0.05]} rotation={[0, 0, -0.12]} />
    </group>
  );
}

function BriefHandle() {
  const m = useToy();
  return (
    <mesh position={[-0.25, 0.72, 0.05]} material={m(C.plumDark)}>
      <torusGeometry args={[0.16, 0.045, 10, 24, Math.PI]} />
    </mesh>
  );
}

function Media() {
  const m = useToy();
  return (
    <group>
      <group position={[-0.25, 0.55, 0.05]} rotation={[0, 0.5, -Math.PI / 2 + 0.25]}>
        <mesh material={m(C.violet)}>
          <cylinderGeometry args={[0.13, 0.46, 0.85, 32, 1, true]} />
        </mesh>
        <mesh position={[0, -0.43, 0]} rotation={[Math.PI / 2, 0, 0]} material={m(C.apricot)}>
          <torusGeometry args={[0.46, 0.05, 10, 36]} />
        </mesh>
        <mesh position={[0, 0.47, 0]} material={m(C.plum)}>
          <cylinderGeometry args={[0.15, 0.15, 0.12, 24]} />
        </mesh>
      </group>
      <RBox size={[0.12, 0.38, 0.12]} r={0.04} color={C.plum} position={[-0.2, 0.22, 0.05]} />
      <Bob amp={0.06} phase={1}>
        <group position={[0.55, 1.12, -0.1]}>
          <Extruded shape={SHAPES.bubble} depth={0.12} color={C.apricot} />
          {[-0.2, 0, 0.2].map((x) => (
            <mesh key={x} position={[x, 0.02, 0.1]} material={m(C.white)}>
              <sphereGeometry args={[0.055, 14, 10]} />
            </mesh>
          ))}
        </group>
      </Bob>
    </group>
  );
}

function Creative() {
  const m = useToy();
  return (
    <group>
      <mesh position={[-0.3, 0.1, 0]} material={m(C.plum)}>
        <cylinderGeometry args={[0.36, 0.42, 0.2, 32]} />
      </mesh>
      <mesh position={[-0.3, 0.22, 0]} material={m(C.violet)}>
        <cylinderGeometry args={[0.25, 0.3, 0.08, 32]} />
      </mesh>
      <group position={[-0.3, 0.26, 0]}>
        <Extruded shape={SHAPES.nib} depth={0.16} color={C.apricot} />
        <mesh position={[0, 0.48, 0.1]} rotation={[Math.PI / 2, 0, 0]} material={m(C.plumDark)}>
          <cylinderGeometry args={[0.07, 0.07, 0.04, 20]} />
        </mesh>
        <RBox size={[0.03, 0.42, 0.04]} r={0.01} color={C.plumDark} position={[0, 0.74, 0.09]} />
      </group>
      {[
        [0.42, 0.14, 0.15, C.violet],
        [0.72, 0.14, 0.15, C.lavender],
        [0.42, 0.14, -0.15, C.lilac],
        [0.72, 0.14, -0.15, C.violet],
        [0.57, 0.42, 0, C.apricot],
      ].map(([x, y, z, c]) => (
        <RBox key={`${x}${z}${y}`} size={[0.27, 0.27, 0.27]} r={0.05} color={c as string} position={[x as number, y as number, z as number]} />
      ))}
    </group>
  );
}

function Law() {
  const m = useToy();
  return (
    <group>
      <RBox size={[0.7, 0.1, 0.46]} r={0.04} color={C.plum} position={[0, 0.05, 0]} />
      <mesh position={[0, 0.65, 0]} material={m(C.plum)}>
        <cylinderGeometry args={[0.065, 0.085, 1.15, 20]} />
      </mesh>
      <mesh position={[0, 1.28, 0]} material={m(C.apricot)}>
        <sphereGeometry args={[0.09, 20, 14]} />
      </mesh>
      <Bob amp={0.03} speed={0.9}>
        <group position={[0, 1.18, 0]} rotation={[0, 0, 0.05]}>
          <RBox size={[1.35, 0.07, 0.08]} r={0.03} color={C.apricot} />
          {[-0.6, 0.6].map((x) => (
            <group key={x} position={[x, 0, 0]}>
              <mesh position={[0, -0.2, 0]} material={m(C.plumDark)}>
                <cylinderGeometry args={[0.012, 0.012, 0.4, 6]} />
              </mesh>
              <mesh position={[0, -0.42, 0]} material={m(C.violet)}>
                <cylinderGeometry args={[0.28, 0.16, 0.07, 32]} />
              </mesh>
            </group>
          ))}
        </group>
      </Bob>
    </group>
  );
}

function Education() {
  const m = useToy();
  return (
    <group position={[-0.1, 0, 0.1]}>
      <RBox size={[1.5, 0.06, 0.98]} r={0.03} color={C.violet} position={[0, 0.05, 0]} />
      <RBox size={[0.7, 0.1, 0.88]} r={0.03} color={C.ivory} position={[-0.36, 0.16, 0]} rotation={[0, 0, -0.14]} />
      <RBox size={[0.7, 0.1, 0.88]} r={0.03} color={C.ivory} position={[0.36, 0.16, 0]} rotation={[0, 0, 0.14]} />
      {[-0.2, 0, 0.2].map((z) => (
        <group key={z}>
          <RBox size={[0.45, 0.01, 0.03]} r={0.005} color={C.lavender} position={[-0.38, 0.23, z]} rotation={[0, 0, -0.14]} />
          <RBox size={[0.45, 0.01, 0.03]} r={0.005} color={C.lavender} position={[0.38, 0.23, z]} rotation={[0, 0, 0.14]} />
        </group>
      ))}
      <Bob amp={0.06} phase={2}>
        <group position={[0.55, 1.05, -0.25]}>
          <Extruded shape={SHAPES.bubble} depth={0.12} color={C.violet} />
          <RBox size={[0.42, 0.09, 0.04]} r={0.04} color={C.white} position={[0, 0.02, 0.09]} />
        </group>
      </Bob>
      <mesh position={[0.55, 0.5, -0.25]} material={m(C.plum)}>
        <cylinderGeometry args={[0.02, 0.02, 0.5, 6]} />
      </mesh>
    </group>
  );
}

function Science() {
  const m = useToy();
  const flask = useMemo(
    () =>
      [
        [0.001, 0],
        [0.42, 0],
        [0.46, 0.06],
        [0.2, 0.62],
        [0.13, 0.72],
        [0.13, 0.98],
        [0.17, 1.02],
      ].map(([x, y]) => new Vector2(x, y)),
    [],
  );
  const liquid = useMemo(
    () =>
      [
        [0.001, 0.02],
        [0.39, 0.02],
        [0.42, 0.07],
        [0.29, 0.36],
        [0.001, 0.36],
      ].map(([x, y]) => new Vector2(x, y)),
    [],
  );
  return (
    <group>
      <group position={[-0.3, 0, 0]}>
        <mesh material={m(C.violet, { glow: 0.25 })}>
          <latheGeometry args={[liquid, 32]} />
        </mesh>
        <mesh material={m('#E9E0FB', { opacity: 0.5, rough: 0.1 })}>
          <latheGeometry args={[flask, 32]} />
        </mesh>
      </group>
      <Bob amp={0.05} phase={0.5}>
        <group position={[0.55, 0.95, -0.1]}>
          <mesh material={m(C.apricot)}>
            <sphereGeometry args={[0.13, 20, 14]} />
          </mesh>
          {[0, 1.05, -1.05].map((a) => (
            <mesh key={a} rotation={[Math.PI / 2 + 0.3, a, 0]} material={m(C.violet)}>
              <torusGeometry args={[0.38, 0.025, 8, 48]} />
            </mesh>
          ))}
        </group>
      </Bob>
    </group>
  );
}

function Tourism() {
  const m = useToy();
  const trunk: [number, number, number][] = [
    [0.6, 0, 0.1],
    [0.62, 0.45, 0.1],
    [0.7, 0.9, 0.1],
    [0.82, 1.25, 0.1],
  ];
  return (
    <group>
      <mesh position={[-0.25, 0.47, -0.05]} rotation={[0, Math.PI / 4, 0]} material={m(C.sand)}>
        <coneGeometry args={[0.78, 0.95, 4]} />
      </mesh>
      <mesh position={[-0.85, 0.3, -0.45]} rotation={[0, Math.PI / 4 + 0.2, 0]} material={m('#EDB879')}>
        <coneGeometry args={[0.48, 0.6, 4]} />
      </mesh>
      <Tube points={trunk} radius={0.06} color="#A57B55" />
      <group position={[0.82, 1.27, 0.1]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh
            key={i}
            rotation={[0, (i * 2 * Math.PI) / 5, 0.95]}
            position={[Math.cos((i * 2 * Math.PI) / 5) * 0.22, -0.06, -Math.sin((i * 2 * Math.PI) / 5) * 0.22]}
            scale={[0.12, 0.42, 0.05]}
            material={m(C.green)}
          >
            <sphereGeometry args={[1, 12, 8]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Trades() {
  const ref = useRef<Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += dt * 0.25;
  });
  return (
    <group>
      <group position={[-0.3, 0.66, -0.05]}>
        <group ref={ref}>
          <Extruded shape={SHAPES.gearBig} depth={0.16} color={C.apricot} />
        </group>
      </group>
      <group position={[0.42, 0.36, 0.05]} rotation={[0, 0, 0.2]}>
        <Extruded shape={SHAPES.gearSmall} depth={0.14} color={C.violet} />
      </group>
      <Extruded shape={SHAPES.wrench} depth={0.08} color={C.plum} position={[0.45, 0.02, 0.32]} rotation={[0, -0.2, -0.45]} />
    </group>
  );
}

function Agriculture() {
  const m = useToy();
  const stalks = [-0.24, -0.12, 0, 0.12, 0.24];
  return (
    <group>
      <group position={[-0.35, 0, 0]}>
        {stalks.map((x, i) => (
          <group key={x} position={[x * 0.5, 0, 0]} rotation={[0, 0, -x * 0.9]}>
            <mesh position={[0, 0.5, 0]} material={m('#E2B062')}>
              <cylinderGeometry args={[0.022, 0.026, 1.0, 6]} />
            </mesh>
            <mesh position={[0, 1.08, 0]} scale={[0.075, 0.2, 0.075]} material={m(i % 2 ? C.apricot : '#F2B66B')}>
              <sphereGeometry args={[1, 12, 10]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.45, 0]} rotation={[Math.PI / 2, 0, 0]} material={m(C.violet)}>
          <torusGeometry args={[0.1, 0.035, 8, 20]} />
        </mesh>
      </group>
      <RBox size={[0.75, 0.42, 0.52]} r={0.04} color={C.wood} position={[0.45, 0.21, 0.05]} />
      {[0.12, 0.3].map((y) => (
        <RBox key={y} size={[0.77, 0.04, 0.54]} r={0.015} color="#C08F5F" position={[0.45, y, 0.05]} />
      ))}
      {[
        [0.28, C.apricot],
        [0.47, C.violet],
        [0.64, '#7FAF5E'],
      ].map(([x, c]) => (
        <mesh key={x as number} position={[x as number, 0.5, 0.05]} material={m(c as string)}>
          <sphereGeometry args={[0.1, 16, 12]} />
        </mesh>
      ))}
    </group>
  );
}

const ICONS: Record<GroupId, () => ReactNode> = {
  tech: Laptop,
  health: Health,
  engineering: Engineering,
  business: Business,
  media: Media,
  creative: Creative,
  law: Law,
  education: Education,
  science: Science,
  tourism: Tourism,
  trades: Trades,
  agriculture: Agriculture,
};

export function GroupIcon({ id }: { id: GroupId }) {
  const Icon = ICONS[id];
  return <Icon />;
}

// --- Logo (core island) -------------------------------------------------------

// Paths from the brand logo SVG (1183×604 artboard): the plum frame and the apricot half disc.
const LOGO_FRAME =
  'M164.724 77.0248L445.123 126.645C462.926 130.462 471.828 141.913 471.828 160.998V464.446C471.828 479.714 464.198 487.348 448.938 487.348C436.221 487.348 429.863 479.714 429.863 464.446V185.808C429.863 170.54 421.597 164.815 405.066 168.632L246.745 210.618C226.399 215.708 216.226 226.522 216.226 243.062V378.565C216.226 397.649 226.399 409.736 246.745 414.826L394 464.446L164.724 512.158C141.834 518.52 130.389 508.977 130.389 483.531V109.469C130.389 84.0225 141.834 73.2078 164.724 77.0248Z';
const LOGO_SUN = 'M408 208C253.333 208 253.333 429 408 429V208Z';
/** Inside of the window, behind the sun (ivory). */
const LOGO_WINDOW = 'M246 210L405 168L430 186V466L394 466L246 415L216 379V243Z';

function svgShapes(d: string): Shape[] {
  const data = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`);
  return data.paths.flatMap((p) => p.toShapes());
}

function LogoPart({ d, depth, z, color, o }: { d: string; depth: number; z: number; color: string; o?: ToyOptions }) {
  const m = useToy();
  const geo = useMemo(() => {
    const g = new ExtrudeGeometry(svgShapes(d), { depth, bevelEnabled: true, bevelThickness: 4, bevelSize: 3, bevelSegments: 3, curveSegments: 32 });
    g.translate(-301, -296, z);
    return g;
  }, [d, depth, z]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={m(color, o)} castShadow receiveShadow />;
}

/** The anaBokra mark, extruded and standing on the core island. */
export function Logo3D({ height = 2.6 }: { height?: number }) {
  const s = height / 445;
  return (
    // Negative Y scale flips SVG coordinates (y down) to world (y up); three fixes the face winding.
    <group scale={[s, -s, s]}>
      <LogoPart d={LOGO_WINDOW} depth={18} z={8} color={BRAND.ivory} />
      <LogoPart d={LOGO_SUN} depth={26} z={18} color={BRAND.logoApricot} o={{ glow: 0.12 }} />
      <LogoPart d={LOGO_FRAME} depth={56} z={0} color={BRAND.logoPlum} />
    </group>
  );
}

