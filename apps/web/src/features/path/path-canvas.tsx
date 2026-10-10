'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { DoubleSide, Object3D, Vector3, type InstancedMesh } from 'three';

import { hexToRgb, propColor, rgbToHex, type ScenePalette } from './palette';
import { buildRibbonGeometry, buildTerrainGeometry, linearColor, propGeometry } from './scene-geometry';
import { activeTarget, LANDMARK_INDEX, stationState, targetPos, type PathSceneProps } from './scene-state';
import type { PropKind, StationState, Vec3, World, WorldProp } from './types';

export interface PathCanvasProps extends PathSceneProps {
  /** Snap the camera instead of gliding. */
  reducedMotion: boolean;
  antialias: boolean;
  /** Called once per rendered frame (dev FPS probe). */
  onFrame?: () => void;
  /** WebGL context lost or unrecoverable error: the parent should switch to 2D. */
  onError?: () => void;
  /** Results reveal: 'play' pulls the camera back from the landmark to a view of the whole world, 'end' shows that final view at once. */
  intro?: 'play' | 'end';
}

export const INTRO_SECONDS = 3.4;

function Terrain({ world, palette }: { world: World; palette: ScenePalette }) {
  const geo = useMemo(() => buildTerrainGeometry(world, palette), [world, palette]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo}>
      <meshLambertMaterial vertexColors />
    </mesh>
  );
}

function Ribbon({ world, palette, progress }: { world: World; palette: ScenePalette; progress: number }) {
  const geo = useMemo(() => buildRibbonGeometry(world, palette, progress), [world, palette, progress]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo}>
      <meshLambertMaterial vertexColors side={DoubleSide} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
    </mesh>
  );
}

const dummy = new Object3D();

function PropInstances({ kind, items, palette }: { kind: PropKind; items: WorldProp[]; palette: ScenePalette }) {
  const ref = useRef<InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((p, i) => {
      dummy.position.set(p.pos[0], p.pos[1], p.pos[2]);
      dummy.rotation.set(0, p.rotY, 0);
      dummy.scale.set(p.scale, p.scale * p.stretch, p.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, linearColor(propColor(p, palette)));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    invalidate();
  }, [items, palette, invalidate]);
  return (
    <instancedMesh key={`${kind}-${items.length}`} ref={ref} args={[propGeometry(kind), undefined, items.length]} frustumCulled={false}>
      {kind === 'lamp' ? <meshBasicMaterial /> : <meshLambertMaterial flatShading />}
    </instancedMesh>
  );
}

function Props({ world, palette }: { world: World; palette: ScenePalette }) {
  const groups = useMemo(() => {
    const m = new Map<PropKind, WorldProp[]>();
    for (const p of world.props) m.set(p.kind, [...(m.get(p.kind) ?? []), p]);
    return [...m.entries()];
  }, [world]);
  return (
    <>
      {groups.map(([kind, items]) => (
        <PropInstances key={kind} kind={kind} items={items} palette={palette} />
      ))}
    </>
  );
}

function SelectionRing({ radius }: { radius: number }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.2}>
      <ringGeometry args={[radius, radius + 0.45, 28]} />
      <meshBasicMaterial color="#ffffff" />
    </mesh>
  );
}

function HitArea({ radius, y }: { radius: number; y: number }) {
  return (
    <mesh position-y={y}>
      <sphereGeometry args={[radius, 8, 6]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

function Station({ pos, state, selected, palette, onSelect }: { pos: Vec3; state: StationState; selected: boolean; palette: ScenePalette; onSelect: () => void }) {
  const color = palette.station[state];
  return (
    <group
      position={[pos[0], pos[1], pos[2]]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <mesh position-y={0.25}>
        <cylinderGeometry args={[1.5, 1.8, 0.5, 10]} />
        <meshLambertMaterial color={color} flatShading />
      </mesh>
      {state === 'done' && (
        <mesh position-y={1.5}>
          <icosahedronGeometry args={[0.9, 0]} />
          <meshLambertMaterial color={color} flatShading />
        </mesh>
      )}
      {state === 'locked' && (
        <mesh position-y={0.95}>
          <boxGeometry args={[0.9, 0.9, 0.9]} />
          <meshLambertMaterial color={color} flatShading />
        </mesh>
      )}
      {state === 'current' && (
        <>
          <mesh position-y={3.5}>
            <cylinderGeometry args={[0.25, 0.25, 6, 6]} />
            <meshBasicMaterial color={color} transparent opacity={0.8} />
          </mesh>
          <mesh position-y={6.8}>
            <octahedronGeometry args={[0.9, 0]} />
            <meshBasicMaterial color={color} />
          </mesh>
        </>
      )}
      {selected && <SelectionRing radius={2.2} />}
      <HitArea radius={2.8} y={1.5} />
    </group>
  );
}

function Landmark({ world, unlocked, selected, palette, onSelect }: { world: World; unlocked: boolean; selected: boolean; palette: ScenePalette; onSelect: () => void }) {
  const color = unlocked ? palette.station.current : palette.station.locked;
  const [x, y, z] = world.landmark.pos;
  return (
    <group
      position={[x, y, z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <mesh position-y={0.2}>
        <cylinderGeometry args={[5.2, 5.8, 0.4, 14]} />
        <meshLambertMaterial color={palette.road} flatShading />
      </mesh>
      {[-1.9, 1.9].map((dx) => (
        <mesh key={dx} position={[dx, 2.4, 0]}>
          <boxGeometry args={[0.9, 4.4, 0.9]} />
          <meshLambertMaterial color={color} flatShading />
        </mesh>
      ))}
      <mesh position={[0, 4.9, 0]}>
        <boxGeometry args={[5, 0.9, 1]} />
        <meshLambertMaterial color={color} flatShading />
      </mesh>
      {selected && <SelectionRing radius={5.4} />}
      <HitArea radius={5} y={2.5} />
    </group>
  );
}

function Slots({ world, palette }: { world: World; palette: ScenePalette }) {
  return (
    <>
      {world.slots.map((s) => (
        <group key={s.rank} position={[s.pos[0], s.pos[1], s.pos[2]]}>
          <mesh position-y={0.3}>
            <cylinderGeometry args={[1.6, 2, 0.6, 8]} />
            <meshLambertMaterial color={palette.regions[s.region]} flatShading />
          </mesh>
          <mesh position-y={1.5}>
            <octahedronGeometry args={[0.7, 0]} />
            <meshLambertMaterial color="#ffffff" flatShading />
          </mesh>
        </group>
      ))}
    </>
  );
}

function CameraRig({ target, instant, onFrame, intro }: { target: Vec3; instant: boolean; onFrame?: () => void; intro?: 'play' | 'end' }) {
  const t0 = useRef<number | null>(null);
  const cur = useRef<Vector3 | null>(null);
  const goal = useMemo(() => new Vector3(), []);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [target, instant, intro, invalidate]);
  useFrame((state, delta) => {
    onFrame?.();
    goal.set(target[0], target[1], target[2]);
    const c = (cur.current ??= goal.clone());
    let zoom = 1;
    if (intro) {
      // 0 = close on the landmark, 1 = the whole world in view.
      let k = 1;
      if (intro === 'play' && !instant) {
        t0.current ??= state.clock.elapsedTime;
        k = Math.min(1, (state.clock.elapsedTime - t0.current) / INTRO_SECONDS);
        if (k < 1) state.invalidate();
      }
      const e = 1 - Math.pow(1 - k, 3);
      zoom = 0.34 + (1.55 - 0.34) * e;
      c.set(goal.x * (1 - e), goal.y * (1 - e), goal.z * (1 - e));
    } else {
      t0.current = null;
      if (instant) c.copy(goal);
      else c.lerp(goal, 1 - Math.exp(-Math.min(delta, 1 / 30) * 3));
    }
    const aspect = state.size.width / Math.max(1, state.size.height);
    const dist = 58 * zoom * (aspect < 1 ? Math.min(1.7, Math.pow(1 / aspect, 0.55)) : 1);
    state.camera.position.set(c.x, c.y + dist * 0.72, c.z + dist * 0.69);
    state.camera.lookAt(c);
    if (c.distanceToSquared(goal) > 0.0004) state.invalidate();
  });
  return null;
}

export default function PathCanvas({ world, progress, focus, onFocus, palette, reducedMotion, antialias, onFrame, onError, intro }: PathCanvasProps) {
  const active = activeTarget(progress, focus);
  const target = targetPos(world, active);
  const sky = palette.sky;
  const hemiGround = rgbToHex(hexToRgb(palette.groundHigh));
  const toggle = (i: number) => onFocus(focus === i ? null : i);

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      flat
      camera={{ fov: 32, near: 2, far: 400, position: [0, 45, 60] }}
      gl={{ antialias, powerPreference: 'default', alpha: false }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          onError?.();
        });
      }}
      onPointerMissed={() => onFocus(null)}
      style={{ touchAction: 'pan-y' }}
    >
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={[sky, 70, 170]} />
      <hemisphereLight args={[sky, hemiGround, 1.6]} />
      <directionalLight position={[-30, 50, 25]} intensity={2} color="#fff3df" />

      <Terrain world={world} palette={palette} />
      <Ribbon world={world} palette={palette} progress={progress} />
      <Props world={world} palette={palette} />
      <Slots world={world} palette={palette} />
      {world.stations.map((s) => (
        <Station key={s.index} pos={s.pos} state={stationState(s.index, progress)} selected={active === s.index} palette={palette} onSelect={() => toggle(s.index)} />
      ))}
      <Landmark world={world} unlocked={progress >= LANDMARK_INDEX} selected={active === LANDMARK_INDEX} palette={palette} onSelect={() => toggle(LANDMARK_INDEX)} />
      <CameraRig target={target} instant={reducedMotion} onFrame={onFrame} intro={intro} />
    </Canvas>
  );
}
