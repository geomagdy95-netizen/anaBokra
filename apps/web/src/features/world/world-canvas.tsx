'use client';

import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  Color,
  MeshStandardMaterial,
  NeutralToneMapping,
  PMREMGenerator,
  Vector3,
  type Camera,
  type DirectionalLight,
  type Group,
  type PerspectiveCamera,
} from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { Bridge, bridgeEnds } from './bridges';
import { bridgePoint, islandGeometry } from './geometry';
import { CORE_RADIUS, ISLAND_RADIUS, ISLAND_TOP, WORLD_EXTENT, islandPlacements, type IslandPlacement } from './layout';
import { BRAND, MutedContext, SCENE } from './materials';
import { GroupIcon, Logo3D } from './props';
import { Backdrop, Clouds, Sea, SkyDome, Trees, treesFor } from './scenery';
import type { GroupId, IslandState, Selection } from './types';

export type Quality = 'high' | 'low';

/** A point in the world that a DOM label follows. */
export interface LabelAnchor {
  key: string;
  pos: Vector3;
}

export interface WorldCanvasProps {
  states: Record<GroupId, IslandState>;
  selected: Selection | null;
  onSelect: (id: Selection | null) => void;
  quality: Quality;
  reducedMotion: boolean;
  /** DOM label elements by anchor key; the canvas moves them to follow their anchors. */
  labels: Map<string, HTMLElement>;
  onError?: () => void;
}

const PLACEMENTS = islandPlacements();

/** Where each label sits: island name at the front edge, "updating" tags at the middle of a bridge. */
export function labelAnchors(): { islands: Record<GroupId, Vector3>; bridges: Record<GroupId, Vector3>; core: Vector3 } {
  const islands = {} as Record<GroupId, Vector3>;
  const bridges = {} as Record<GroupId, Vector3>;
  for (const p of PLACEMENTS) {
    islands[p.id] = new Vector3(p.pos[0], ISLAND_TOP + 0.1, p.pos[1] + ISLAND_RADIUS * 0.72);
    bridges[p.id] = bridgePoint(bridgeEnds([0, 0], CORE_RADIUS, p.pos, ISLAND_RADIUS), 0.5).setY(ISLAND_TOP + 0.9);
  }
  return { islands, bridges, core: new Vector3(0, ISLAND_TOP + 0.1, CORE_RADIUS * 0.8) };
}
const ANCHORS = labelAnchors();

// --- Islands ------------------------------------------------------------------

function Island({
  placement,
  state,
  selected,
  onSelect,
  animate,
  shadows,
}: {
  placement: IslandPlacement;
  state: IslandState;
  selected: boolean;
  onSelect: (id: GroupId) => void;
  animate: boolean;
  shadows: boolean;
}) {
  const muted = state.relation === 'other';
  const geo = useMemo(
    () => islandGeometry({ seed: placement.id, radius: ISLAND_RADIUS, landAt: [Math.atan2(-placement.dir[1], -placement.dir[0])] }),
    [placement],
  );
  const mat = useMemo(
    () => new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, color: muted ? '#E5E1EC' : '#FFFFFF' }),
    [muted],
  );
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);

  const root = useRef<Group>(null);
  const icon = useRef<Group>(null);
  useLayoutEffect(() => {
    root.current?.traverse((o) => {
      if ('isMesh' in o && o.isMesh) {
        o.castShadow = shadows;
        o.receiveShadow = shadows;
      }
    });
  });
  useFrame(({ clock }, dt) => {
    const g = icon.current;
    if (!g) return;
    const target = selected ? 1.36 : 1.22;
    const s = g.scale.x + (target - g.scale.x) * Math.min(1, dt * 8);
    g.scale.setScalar(s);
    g.position.y = ISLAND_TOP + (animate && selected ? Math.abs(Math.sin(clock.elapsedTime * 2.4)) * 0.12 : 0);
  });

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 8) return; // a drag, not a tap
    onSelect(placement.id);
  };

  return (
    <group
      ref={root}
      position={[placement.pos[0], 0, placement.pos[1]]}
      onClick={click}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <mesh geometry={geo} material={mat} />
      <MutedContext.Provider value={muted}>
        <group ref={icon} position={[0, ISLAND_TOP, -0.1]} scale={1.22}>
          <GroupIcon id={placement.id} />
        </group>
      </MutedContext.Provider>
      {selected && <SelectionRing radius={ISLAND_RADIUS} color={BRAND.violet} />}
    </group>
  );
}

/** A glowing ring on the water around the selected island, just past its beach. */
function SelectionRing({ radius, color }: { radius: number; color: string }) {
  return (
    <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius + 0.6, radius + 0.78, 96]} />
      <meshBasicMaterial color={color} transparent opacity={0.85} depthWrite={false} />
    </mesh>
  );
}

function CoreIsland({ shadows, selected, onSelect, animate }: { shadows: boolean; selected: boolean; onSelect: () => void; animate: boolean }) {
  // Bridges land all around the core, so its outline only wanders a little.
  const base = useMemo(() => islandGeometry({ seed: 'core', radius: CORE_RADIUS, wobble: 0.025, segments: 128 }), []);
  const tierTop = ISLAND_TOP + 0.34;
  const tier = useMemo(() => islandGeometry({ seed: 'core-tier', radius: 2.05, top: tierTop, beach: false, wobble: 0.05, segments: 112 }), [tierTop]);
  const mat = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), []);
  useEffect(() => () => (base.dispose(), tier.dispose(), mat.dispose()), [base, tier, mat]);
  const logo = useRef<Group>(null);
  useFrame(({ clock }, dt) => {
    const g = logo.current;
    if (!g) return;
    const s = g.scale.x + ((selected ? 1.08 : 1) - g.scale.x) * Math.min(1, dt * 8);
    g.scale.setScalar(s);
    g.position.y = tierTop + 1.33 + (animate && selected ? Math.abs(Math.sin(clock.elapsedTime * 2.2)) * 0.12 : 0);
  });
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 8) return;
    onSelect();
  };
  return (
    <group
      onClick={click}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <mesh geometry={base} material={mat} castShadow={shadows} receiveShadow={shadows} />
      <mesh geometry={tier} material={mat} castShadow={shadows} receiveShadow={shadows} />
      <group ref={logo} position={[0, tierTop + 1.33, -0.25]} rotation={[-0.08, 0, 0]}>
        <Logo3D height={2.65} />
      </group>
      {selected && <SelectionRing radius={CORE_RADIUS} color={BRAND.apricot} />}
    </group>
  );
}

// --- Camera -------------------------------------------------------------------

function Rig({ focus, animate }: { focus: Selection | null; animate: boolean }) {
  const get = useThree((s) => s.get);
  const portrait = useThree((s) => s.size.width < s.size.height);
  const controls = useRef<MapControls | null>(null);
  const goal = useRef<Vector3 | null>(null);

  useEffect(() => {
    const { camera, gl, invalidate } = get();
    const c = new MapControls(camera, gl.domElement);
    c.enableDamping = true;
    c.dampingFactor = 0.09;
    c.enableRotate = false;
    c.screenSpacePanning = false;
    c.minDistance = 11;
    c.maxDistance = 70;
    c.zoomToCursor = true;
    const onChange = () => invalidate();
    c.addEventListener('change', onChange);
    controls.current = c;
    return () => {
      c.removeEventListener('change', onChange);
      c.dispose();
      controls.current = null;
    };
  }, [get]);

  // Frame the whole archipelago (portrait screens start a little closer).
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    frameWorld(c, get().camera as PerspectiveCamera, get().size, portrait);
    get().invalidate();
  }, [get, portrait]);

  useEffect(() => {
    // Aim in front of the island so it sits above the details sheet.
    const p = focus && focus !== 'core' ? PLACEMENTS.find((x) => x.id === focus) : undefined;
    goal.current = focus === 'core' ? new Vector3(0, 0, 5) : p ? new Vector3(p.pos[0] * 0.85, 0, p.pos[1] * 0.85 + 5) : null;
    get().invalidate();
  }, [focus, get]);

  useFrame((state) => {
    const c = controls.current;
    if (!c) return;
    if (goal.current && glide(c, state.camera, goal.current, animate ? 0.06 : 1)) goal.current = null;
    else if (goal.current) state.invalidate();
    keepInBounds(c, state.camera);
    c.update();
  });
  return null;
}

function frameWorld(c: MapControls, camera: PerspectiveCamera, size: { width: number; height: number }, portrait: boolean) {
  // Portrait phones get a wider lens and a steeper view (less sky), and start on the middle of the map.
  camera.fov = portrait ? 44 : 34;
  camera.updateProjectionMatrix();
  const aspect = size.width / size.height;
  const half = Math.tan((camera.fov * Math.PI) / 360);
  const needW = (portrait ? WORLD_EXTENT * 0.62 : WORLD_EXTENT + 1.5) / (half * aspect);
  const needH = (WORLD_EXTENT + 1) / half / 1.35;
  const d = Math.min(64, Math.max(16, Math.max(needW, needH)));
  const polar = portrait ? 0.7 : 0.9;
  // Aim a little in front of the centre so the map sits above the legend panel.
  const aim = portrait ? 2 : 3;
  camera.position.set(0, Math.cos(polar) * d, Math.sin(polar) * d + aim);
  c.target.set(0, 0, aim);
  c.update();
}

/** Moves target and camera together toward the goal. Returns true once arrived. */
function glide(c: MapControls, camera: { position: Vector3 }, goal: Vector3, k: number): boolean {
  const delta = goal.clone().sub(c.target).multiplyScalar(k);
  c.target.add(delta);
  camera.position.add(delta);
  return delta.lengthSq() < 1e-5;
}

/** Keeps panning within the archipelago. */
function keepInBounds(c: MapControls, camera: { position: Vector3 }) {
  const t = c.target;
  const r = Math.hypot(t.x, t.z);
  const max = WORLD_EXTENT * 0.9;
  if (r <= max) return;
  const k = max / r - 1;
  const shift = new Vector3(t.x * k, 0, t.z * k);
  t.add(shift);
  camera.position.add(shift);
}

// --- Labels -------------------------------------------------------------------

const projected = new Vector3();

/** Moves one DOM label to the screen position of its anchor. */
function placeLabel(el: HTMLElement, anchor: Vector3, camera: Camera, size: { width: number; height: number }) {
  projected.copy(anchor).project(camera);
  const x = (projected.x * 0.5 + 0.5) * size.width;
  const y = (-projected.y * 0.5 + 0.5) * size.height;
  el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  el.style.visibility = projected.z < 1 ? 'visible' : 'hidden';
}

function LabelProjector({ labels }: { labels: Map<string, HTMLElement> }) {
  useFrame(({ camera, size }) => {
    for (const [key, el] of labels) {
      const [kind, id] = key.split(':') as ['island' | 'bridge' | 'core', GroupId];
      const anchor = kind === 'core' ? ANCHORS.core : kind === 'island' ? ANCHORS.islands[id] : ANCHORS.bridges[id];
      if (anchor) placeLabel(el, anchor, camera, size);
    }
  });
  return null;
}

// --- Scene --------------------------------------------------------------------

function Environment() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    const { gl, scene } = get();
    const pmrem = new PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.38;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [get]);
  return null;
}

function Lights({ shadows }: { shadows: boolean }) {
  const sun = useRef<DirectionalLight>(null);
  useLayoutEffect(() => {
    const l = sun.current;
    if (!l) return;
    const cam = l.shadow.camera;
    cam.left = -18;
    cam.right = 18;
    cam.top = 18;
    cam.bottom = -18;
    cam.near = 1;
    cam.far = 70;
    cam.updateProjectionMatrix();
    l.shadow.bias = -0.0004;
    l.shadow.normalBias = 0.02;
    l.shadow.radius = 4;
  }, []);
  return (
    <>
      <hemisphereLight args={['#FFFFFF', '#AE97E6', 0.95]} />
      <directionalLight
        ref={sun}
        position={[-12, 22, 14]}
        intensity={2.3}
        color="#FFECD9"
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[10, 8, -12]} intensity={0.35} color="#D9C8FF" />
    </>
  );
}

function Scene({ states, selected, onSelect, quality, reducedMotion, labels }: WorldCanvasProps) {
  const shadows = quality === 'high';
  const animate = !reducedMotion;

  const trees = useMemo(() => {
    const spots = PLACEMENTS.flatMap((p) => treesFor(p.id, p.pos, ISLAND_RADIUS, 5, states[p.id].relation === 'other'));
    // The core keeps a ring of trees around its tier.
    const core = treesFor('core', [0, 0], CORE_RADIUS, 9, false).filter((t) => Math.hypot(t.x, t.z) > 2.25);
    return [...spots, ...core];
  }, [states]);

  // Where each island meets the water (its beach runs about 0.24 past the radius).
  const shores = useMemo(
    () => [{ pos: [0, 0] as const, radius: CORE_RADIUS + 0.24 }, ...PLACEMENTS.map((p) => ({ pos: p.pos, radius: ISLAND_RADIUS + 0.24 }))],
    [],
  );

  return (
    <>
      <color attach="background" args={[SCENE.horizon]} />
      <fog attach="fog" args={[new Color(SCENE.horizon), 48, 120]} />
      <Environment />
      <Lights shadows={shadows} />
      <SkyDome />
      <Sea shadows={shadows} islands={shores} animate={animate} />
      <Clouds islands={PLACEMENTS} density={quality === 'high' ? 1 : 0.5} animate={animate} />
      <Backdrop />
      <CoreIsland shadows={shadows} selected={selected === 'core'} onSelect={() => onSelect('core')} animate={animate} />
      {PLACEMENTS.map((p) => {
        const s = states[p.id];
        return (
          <Bridge
            key={`b-${p.id}`}
            from={[0, 0]}
            fromRadius={CORE_RADIUS}
            to={p.pos}
            toRadius={ISLAND_RADIUS}
            relation={s.relation}
            mode={s.bridge}
            done={s.done}
            total={s.total}
            animate={animate}
            shadows={shadows}
          />
        );
      })}
      {PLACEMENTS.map((p) => (
        <Island
          key={p.id}
          placement={p}
          state={states[p.id]}
          selected={selected === p.id}
          onSelect={onSelect}
          animate={animate}
          shadows={shadows}
        />
      ))}
      <Trees spots={trees} shadows={shadows} />
      <Rig focus={selected} animate={animate} />
      <LabelProjector labels={labels} />
    </>
  );
}

export default function WorldCanvas(props: WorldCanvasProps) {
  const high = props.quality === 'high';
  // Unmounting the canvas (e.g. switching to the list) also loses the context; only report losses while mounted.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const { onError } = props;
  return (
    <Canvas
      shadows={high ? 'percentage' : false}
      dpr={high ? [1, 2] : [1, 1.25]}
      frameloop={props.reducedMotion ? 'demand' : 'always'}
      camera={{ fov: 34, near: 0.5, far: 400, position: [0, 30, 30] }}
      gl={{ antialias: high, toneMapping: NeutralToneMapping, powerPreference: 'high-performance' }}
      onPointerMissed={() => props.onSelect(null)}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener(
          'webglcontextlost',
          () => {
            if (mounted.current) onError?.();
          },
          { once: true },
        );
      }}
      style={{ touchAction: 'none' }}
    >
      <Scene {...props} />
    </Canvas>
  );
}
