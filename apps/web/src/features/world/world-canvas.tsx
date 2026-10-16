'use client';

import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  Color,
  MeshStandardMaterial,
  NeutralToneMapping,
  PMREMGenerator,
  Plane,
  Vector3,
  type Camera,
  type DirectionalLight,
  type Group,
  type PerspectiveCamera,
} from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { Bridge, bridgeEnds } from './bridges';
import { bridgePoint, islandGeometry } from './geometry';
import { ARRANGE_RING, CORE_RADIUS, ISLAND_RADIUS, ISLAND_TOP, ISLET_RADIUS, clearSpot, islandPlacements, isletPlacements, landmarkOffset, mapExtent, stationSpots, type IslandPlacement, type XZ } from './layout';
import { BRAND, MutedContext } from './materials';
import { Landmark } from './landmarks';
import { Logo3D, RBox, Tube } from './props';
import { IslandSceneDetail } from './island-scene-details';
import { Cliffs } from './cliffs';
import { Flag, flagSpot, Garden, growthSpots } from './garden';
import { Motes } from './atmosphere';
import { Clouds, Sea, SkyDome } from './scenery';
import { WORLD_THEME } from './theme';
import { GROUP_ORDER, type CareerIslet, type GroupId, type IslandState, type Selection } from './types';

export type Quality = 'high' | 'low';

export interface CameraCommand {
  kind: 'in' | 'out' | 'home';
  n: number;
}

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
  /** Stored custom X/Z coordinates for islands arranged by the user. */
  positions?: Partial<Record<GroupId, XZ>>;
  /** In arrange mode, drag an island to move it; map panning is paused. */
  arrange?: boolean;
  onMove?: (id: GroupId, x: number, z: number) => void;
  /** 0–1: how far the core island (the user) has grown, from Discover. Full when missing. */
  coreGrowth?: number;
  /** L2 career islets per checked group island, best first. */
  careers?: Partial<Record<GroupId, CareerIslet[]>>;
  /** Tapping a career islet. */
  onSelectCareer?: (group: GroupId, careerId: string) => void;
  /** Number of Discover stations round my island; their DOM pins use the keys `station:1` … `station:n`. */
  stations?: number;
  /** A camera button press: zoom in or out, or back to the whole map. `n` changes on every press. */
  view?: CameraCommand;
  onError?: () => void;
}

/** Where each label sits: island name at the front edge, "updating" tags at the middle of a bridge. */
export function labelAnchors(
  positions?: Partial<Record<GroupId, XZ>>,
  slots?: Partial<Record<GroupId, number>>,
): { islands: Record<GroupId, Vector3>; bridges: Record<GroupId, Vector3>; core: Vector3 } {
  const placements = islandPlacements(positions, slots);
  const islands = {} as Record<GroupId, Vector3>;
  const bridges = {} as Record<GroupId, Vector3>;
  for (const p of placements) {
    islands[p.id] = new Vector3(p.pos[0], ISLAND_TOP + 0.1, p.pos[1] + ISLAND_RADIUS * 0.72);
    bridges[p.id] = bridgePoint(bridgeEnds([0, 0], CORE_RADIUS, p.pos, ISLAND_RADIUS), 0.5).setY(ISLAND_TOP + 0.9);
  }
  // My name sits on the front rim, clear of the Discover stations just inside it.
  return { islands, bridges, core: new Vector3(0, ISLAND_TOP + 0.1, CORE_RADIUS + 0.1) };
}

// --- Islands ------------------------------------------------------------------

const LANDMARK_SCALE = 1.55;

/** A small timber landing joins each island's footpath to its rope bridge. */
function IslandLanding({ dir, shadows }: { dir: XZ; shadows: boolean }) {
  const rotation = Math.atan2(-dir[0], -dir[1]);
  const sideRails: [number, number, number][][] = [-1, 1].map((side) => [
    [side * 0.39, 0.2, 1.48],
    [side * 0.39, 0.14, 1.6],
    [side * 0.39, 0.14, 1.75],
    [side * 0.39, 0.2, 1.88],
  ]);
  return (
    <group position={[0, ISLAND_TOP, 0]} rotation={[0, rotation, 0]}>
      {Array.from({ length: 4 }, (_, i) => (
        <RBox key={`step-${i}`} size={[0.84, 0.13, 0.23]} r={0.035} color={i % 2 ? '#C7A77C' : '#D8BD94'} position={[0, -0.045 - i * 0.085, 0.92 + i * 0.19]} />
      ))}
      {Array.from({ length: 4 }, (_, i) => (
        <RBox key={`plank-${i}`} size={[0.82, 0.07, 0.19]} r={0.025} color={i % 2 ? '#C89058' : '#D9A56C'} position={[0, -0.34, 1.5 + i * 0.14]} />
      ))}
      {[1.55, 1.95].map((z) => (
        <RBox key={`beam-${z}`} size={[1.02, 0.12, 0.16]} r={0.035} color="#815334" position={[0, -0.43, z]} />
      ))}
      {[-1, 1].flatMap((side) => [1.62, 1.91].map((z) => (
        <mesh key={`pile-${side}-${z}`} position={[side * 0.37, -0.68, z]} castShadow={shadows}>
          <cylinderGeometry args={[0.055, 0.075, 0.82, 8]} />
          <meshStandardMaterial color="#795033" roughness={0.82} />
        </mesh>
      )))}
      {[-1, 1].map((side) => (
        <group key={`rail-${side}`}>
          {[1.48, 1.88].map((z) => (
            <RBox key={`post-${z}`} size={[0.075, 0.5, 0.075]} r={0.025} color="#805536" position={[side * 0.43, -0.09, z]} />
          ))}
          <Tube points={sideRails[side === -1 ? 0 : 1]!} radius={0.028} color="#9C6B42" />
        </group>
      ))}
    </group>
  );
}

function Island({
  placement,
  state,
  selected,
  onSelect,
  animate,
  shadows,
  arrange,
  onMove,
}: {
  placement: IslandPlacement;
  state: IslandState;
  selected: boolean;
  onSelect: (id: GroupId) => void;
  animate: boolean;
  shadows: boolean;
  arrange: boolean;
  onMove?: (id: GroupId, x: number, z: number) => void;
}) {
  const muted = state.relation === 'other';
  const id = placement.id;
  const landing = Math.atan2(-placement.dir[1], -placement.dir[0]);
  const geo = useMemo(() => islandGeometry({ seed: id, radius: ISLAND_RADIUS, beach: false, base: -0.3, landAt: [landing] }), [id, landing]);
  const mat = useMemo(
    () => new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, color: muted ? '#E5E1EC' : '#FFFFFF' }),
    [muted],
  );
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);

  const root = useRef<Group>(null);
  const model = useRef<Group>(null);
  const dragging = useRef(false);
  const dragPlane = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), []);
  const dragPoint = useMemo(() => new Vector3(), []);
  const lm = landmarkOffset(placement);
  const detailSide = GROUP_ORDER.indexOf(placement.id) % 2 ? 1 : -1;
  useLayoutEffect(() => {
    root.current?.traverse((o) => {
      if ('isMesh' in o && o.isMesh) {
        o.castShadow = shadows;
        o.receiveShadow = shadows;
      }
    });
  });
  useFrame(({ clock }, dt) => {
    const g = model.current;
    if (!g) return;
    const target = selected ? 1.04 : 1;
    const s = g.scale.x + (target - g.scale.x) * Math.min(1, dt * 8);
    g.scale.setScalar(s);
    g.position.y = animate && selected ? Math.abs(Math.sin(clock.elapsedTime * 2.4)) * 0.08 : 0;
  });

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 8) return; // a drag, not a tap
    onSelect(placement.id);
  };

  const dragTo = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current || !root.current) return;
    const point = e.ray.intersectPlane(dragPlane, dragPoint);
    if (!point) return;
    const distance = Math.hypot(point.x, point.z);
    const radius = Math.max(ARRANGE_RING[0], Math.min(ARRANGE_RING[1], distance));
    const scale = radius / (distance || 1);
    root.current.position.set(point.x * scale, 0, point.z * scale);
  };

  const endDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return;
    dragging.current = false;
    e.stopPropagation();
    (e.target as unknown as { releasePointerCapture(pointerId: number): void }).releasePointerCapture(e.pointerId);
    const pos = root.current?.position;
    if (pos) onMove?.(placement.id, pos.x, pos.z);
  };

  return (
    <group
      ref={root}
      position={[placement.pos[0], 0, placement.pos[1]]}
      onClick={click}
      onPointerDown={(e) => {
        if (!arrange) return;
        e.stopPropagation();
        dragging.current = true;
        (e.target as unknown as { setPointerCapture(pointerId: number): void }).setPointerCapture(e.pointerId);
      }}
      onPointerMove={dragTo}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerOver={() => (document.body.style.cursor = arrange ? 'grab' : 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <mesh geometry={geo} material={mat} castShadow={shadows} receiveShadow={shadows} />
      <IslandLanding dir={placement.dir} shadows={shadows} />
      <MutedContext.Provider value={muted}>
        <group ref={model}>
          <group position={[lm[0], ISLAND_TOP, lm[1]]} rotation={[0, -lm[0] * 0.35, 0]} scale={LANDMARK_SCALE}>
            <Landmark id={placement.id} />
          </group>
        </group>
        {placement.id === 'tourism' ? (
          <group position={[placement.dir[0] * (ISLAND_RADIUS + 0.48), 0, placement.dir[1] * (ISLAND_RADIUS + 0.48)]} rotation={[0, Math.atan2(placement.dir[0], placement.dir[1]), 0]} scale={0.86}>
            <IslandSceneDetail id={placement.id} />
          </group>
        ) : (
          <group position={[detailSide * 1.08, ISLAND_TOP, 0.1]} scale={0.88}>
            <IslandSceneDetail id={placement.id} />
          </group>
        )}
      </MutedContext.Provider>
      {selected && <SelectionRing radius={ISLAND_RADIUS} color={BRAND.violet} />}
    </group>
  );
}

// --- L2 career islets ---------------------------------------------------------------

export interface PlacedIslet extends CareerIslet {
  group: GroupId;
  pos: XZ;
  dir: XZ;
  from: XZ;
}

/** The career islets of every visible group, placed behind their group island. */
export function placeIslets(placements: readonly IslandPlacement[], careers: Partial<Record<GroupId, CareerIslet[]>> = {}): PlacedIslet[] {
  return placements.flatMap((p) => {
    const list = careers[p.id] ?? [];
    return isletPlacements(p, list.length).map((spot, i) => ({ ...list[i]!, group: p.id, pos: spot.pos, dir: spot.dir, from: p.pos }));
  });
}

const ISLET_TINT: Record<CareerIslet['state'], string> = { available: '#F1ECE4', building: '#FFFFFF', reached: '#FFFFFF', selected: '#FFF4E6' };

/**
 * A small career islet: a rocky islet with a little tree, a flag once its quest is finished and a warm
 * ring once it is one of the user's careers. Tapping it opens the career island.
 */
function Islet({ islet, shadows, animate, onSelect }: { islet: PlacedIslet; shadows: boolean; animate: boolean; onSelect?: () => void }) {
  const landing = Math.atan2(-islet.dir[1], -islet.dir[0]);
  const geo = useMemo(() => islandGeometry({ seed: islet.id, radius: ISLET_RADIUS, beach: false, base: -0.3, landAt: [landing] }), [islet.id, landing]);
  const mat = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, color: ISLET_TINT[islet.state] }), [islet.state]);
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  const reached = islet.state === 'reached' || islet.state === 'selected';
  return (
    <group
      position={[islet.pos[0], 0, islet.pos[1]]}
      onClick={(e) => {
        e.stopPropagation();
        if (e.delta > 8) return;
        onSelect?.();
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <mesh geometry={geo} material={mat} castShadow={shadows} receiveShadow={shadows} />
      {/* A little cypress: taller once the quest is under way. */}
      <mesh position={[0.12, ISLAND_TOP + (islet.state === 'available' ? 0.18 : 0.3), -0.1]} castShadow={shadows}>
        <coneGeometry args={[0.13, islet.state === 'available' ? 0.36 : 0.6, 10]} />
        <meshStandardMaterial color={islet.state === 'available' ? '#9DB58A' : '#5E8B5A'} roughness={0.8} />
      </mesh>
      {reached && (
        <group position={[0, ISLAND_TOP * 0.4, 0]} scale={0.6}>
          <Flag at={[-0.3, 0.2]} animate={animate} />
        </group>
      )}
      {islet.state === 'selected' && <SelectionRing radius={ISLET_RADIUS - 0.25} color={BRAND.apricot} />}
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
  const base = useMemo(() => islandGeometry({ seed: 'core', radius: CORE_RADIUS, beach: false, base: -0.3, wobble: 0.025, segments: 128 }), []);
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

function Rig({
  focus,
  animate,
  arrange,
  placements,
  extent,
  view,
}: {
  focus: Selection | null;
  animate: boolean;
  arrange: boolean;
  placements: IslandPlacement[];
  extent: number;
  view?: CameraCommand;
}) {
  const get = useThree((s) => s.get);
  const portrait = useThree((s) => s.size.width < s.size.height);
  const controls = useRef<MapControls | null>(null);
  const goal = useRef<Vector3 | null>(null);
  const homeTarget = useRef(new Vector3(0, 0, 3));
  const homeDistance = useRef(34);
  const distanceGoal = useRef<number | null>(null);

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

  useEffect(() => {
    if (controls.current) controls.current.enabled = !arrange;
  }, [arrange]);

  // Frame the whole archipelago (portrait screens start a little closer).
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    homeDistance.current = frameWorld(c, get().camera as PerspectiveCamera, get().size, portrait, extent);
    homeTarget.current.set(0, 0, portrait ? 2 : 3);
    get().invalidate();
  }, [get, portrait, extent]);

  useEffect(() => {
    // Bring a selected miniature close enough to read its building and props; restore the full map when closed.
    const p = focus && focus !== 'core' ? placements.find((x) => x.id === focus) : undefined;
    goal.current = focus === 'core' ? new Vector3(0, 0, 4.8) : p ? new Vector3(p.pos[0] * 0.85, 0, p.pos[1] * 0.85 + 4.6) : homeTarget.current.clone();
    distanceGoal.current = focus ? (portrait ? 17.5 : 22) : homeDistance.current;
    get().invalidate();
  }, [focus, get, placements, portrait]);

  // Zoom and "whole map" buttons (the map's glass controls), for tablets and mice where pinching is awkward.
  useEffect(() => {
    const c = controls.current;
    if (!view || !c) return;
    const { camera } = get();
    const distance = camera.position.distanceTo(c.target);
    if (view.kind === 'home') {
      goal.current = homeTarget.current.clone();
      distanceGoal.current = homeDistance.current;
    } else {
      distanceGoal.current = Math.min(c.maxDistance, Math.max(c.minDistance, distance * (view.kind === 'in' ? 0.72 : 1.38)));
    }
    get().invalidate();
  }, [view, get]);

  useFrame((state) => {
    const c = controls.current;
    if (!c) return;
    if (goal.current && glide(c, state.camera, goal.current, animate ? 0.06 : 1)) goal.current = null;
    else if (goal.current) state.invalidate();
    if (distanceGoal.current !== null) {
      const offset = state.camera.position.clone().sub(c.target);
      const distance = offset.length();
      const delta = distanceGoal.current - distance;
      if (Math.abs(delta) < 0.025) distanceGoal.current = null;
      else {
        offset.setLength(distance + delta * (animate ? 0.06 : 1));
        state.camera.position.copy(c.target).add(offset);
        state.invalidate();
      }
    }
    keepInBounds(c, state.camera, extent);
    c.update();
  });
  return null;
}

function frameWorld(c: MapControls, camera: PerspectiveCamera, size: { width: number; height: number }, portrait: boolean, extent: number): number {
  // Portrait phones get a wider lens and a steeper view (less sky), and start on the middle of the map.
  camera.fov = portrait ? 44 : 34;
  camera.updateProjectionMatrix();
  const aspect = size.width / size.height;
  const half = Math.tan((camera.fov * Math.PI) / 360);
  // A full archipelago may crop at the sides on a phone; a small map (a few islands) fits whole.
  const needW = (portrait ? extent * (extent < 14 ? 0.86 : 0.62) : extent + 1.5) / (half * aspect);
  const needH = (extent + 1) / half / 1.35;
  const d = Math.min(64, Math.max(16, Math.max(needW, needH)));
  const polar = portrait ? 0.7 : 0.9;
  // Aim a little in front of the centre so the map sits above the legend panel.
  const aim = portrait ? 2 : 3;
  camera.position.set(0, Math.cos(polar) * d, Math.sin(polar) * d + aim);
  c.target.set(0, 0, aim);
  c.update();
  return d;
}

/** Moves target and camera together toward the goal. Returns true once arrived. */
function glide(c: MapControls, camera: { position: Vector3 }, goal: Vector3, k: number): boolean {
  const delta = goal.clone().sub(c.target).multiplyScalar(k);
  c.target.add(delta);
  camera.position.add(delta);
  return delta.lengthSq() < 1e-5;
}

/** Keeps panning within the islands on the map. */
function keepInBounds(c: MapControls, camera: { position: Vector3 }, extent: number) {
  const t = c.target;
  const r = Math.hypot(t.x, t.z);
  const max = Math.max(4, extent * 0.9);
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

function hideLabel(el: HTMLElement) {
  el.style.visibility = 'hidden';
}

function LabelProjector({
  labels,
  anchors,
  visible,
  careers,
  stations,
}: {
  labels: Map<string, HTMLElement>;
  anchors: ReturnType<typeof labelAnchors>;
  visible: ReadonlySet<GroupId>;
  careers: ReadonlyMap<string, Vector3>;
  stations: readonly Vector3[];
}) {
  useFrame(({ camera, size }) => {
    for (const [key, el] of labels) {
      const [kind, id] = key.split(':') as ['island' | 'bridge' | 'core' | 'career' | 'station', GroupId];
      if (kind === 'station') {
        const anchor = stations[Number(id) - 1];
        if (anchor) placeLabel(el, anchor, camera, size);
        else hideLabel(el);
        continue;
      }
      if (kind === 'career') {
        const anchor = careers.get(id);
        if (anchor) placeLabel(el, anchor, camera, size);
        else hideLabel(el);
        continue;
      }
      if (kind !== 'core' && !visible.has(id)) {
        hideLabel(el);
        continue;
      }
      const anchor = kind === 'core' ? anchors.core : kind === 'island' ? anchors.islands[id] : anchors.bridges[id];
      if (anchor) placeLabel(el, anchor, camera, size);
    }
  });
  return null;
}

// --- Miniature look ---------------------------------------------------------------

/**
 * Tilt-shift: the top and bottom of the view go softly out of focus, so the archipelago reads as a
 * small model on a table. High quality only (two extra full-screen passes).
 */
function TiltShift() {
  const get = useThree((s) => s.get);
  const size = useThree((s) => s.size);
  const composer = useRef<EffectComposer | null>(null);
  useEffect(() => {
    const { gl, scene, camera } = get();
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));
    c.addPass(new ShaderPass(HorizontalTiltShiftShader));
    c.addPass(new ShaderPass(VerticalTiltShiftShader));
    c.addPass(new OutputPass());
    composer.current = c;
    return () => {
      c.dispose();
      composer.current = null;
    };
  }, [get]);
  useEffect(() => {
    const c = composer.current;
    if (!c) return;
    c.setPixelRatio(get().gl.getPixelRatio());
    c.setSize(size.width, size.height);
    const [, h, v] = c.passes as ShaderPass[];
    h!.uniforms.h!.value = 2.4 / size.width;
    v!.uniforms.v!.value = 2.4 / size.height;
    // Focus a little below the middle, where the map sits above the legend.
    h!.uniforms.r!.value = 0.48;
    v!.uniforms.r!.value = 0.48;
  }, [get, size]);
  useFrame(({ gl, scene, camera }) => {
    if (composer.current) composer.current.render();
    else gl.render(scene, camera);
  }, 1);
  return null;
}

// --- Scene --------------------------------------------------------------------

function Environment() {
  const get = useThree((s) => s.get);
  const { env: intensity } = WORLD_THEME;
  useEffect(() => {
    const { gl, scene } = get();
    const pmrem = new PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = intensity;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [get, intensity]);
  return null;
}

function Lights({ shadows }: { shadows: boolean }) {
  const { hemi, sun: s, rim } = WORLD_THEME;
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
    l.shadow.radius = 5;
  }, []);
  return (
    <>
      <hemisphereLight args={[hemi.sky, hemi.ground, hemi.intensity]} />
      <directionalLight ref={sun} position={s.position} intensity={s.intensity} color={s.color} castShadow={shadows} shadow-mapSize={[2048, 2048]} />
      <directionalLight position={rim.position} intensity={rim.intensity} color={rim.color} />
    </>
  );
}

function Scene({ states, selected, onSelect, quality, reducedMotion, labels, coreGrowth = 1, arrange = false, positions, onMove, careers, onSelectCareer, stations = 0, view }: WorldCanvasProps) {
  const theme = WORLD_THEME;
  const shadows = quality === 'high';
  const animate = !reducedMotion;
  const slots = useMemo(() => Object.fromEntries(Object.values(states).flatMap((s) => (s.slot !== undefined ? [[s.id, s.slot]] : []))) as Partial<Record<GroupId, number>>, [states]);
  const placements = useMemo(() => islandPlacements(positions, slots), [positions, slots]);
  const visiblePlacements = useMemo(() => placements.filter((p) => states[p.id].visible !== false), [placements, states]);
  const anchors = useMemo(() => labelAnchors(positions, slots), [positions, slots]);
  const visibleIds = useMemo(() => new Set(visiblePlacements.map((p) => p.id)), [visiblePlacements]);
  // While arranging, islets stay hidden (they follow their island once it's dropped).
  const islets = useMemo(() => (arrange ? [] : placeIslets(visiblePlacements, careers)), [arrange, visiblePlacements, careers]);
  const isletAnchors = useMemo(() => new Map(islets.map((i) => [i.id, new Vector3(i.pos[0], ISLAND_TOP + 0.1, i.pos[1] + ISLET_RADIUS + 0.25)])), [islets]);
  const stationAnchors = useMemo(() => stationSpots(stations).map(([x, z]) => new Vector3(x, ISLAND_TOP + 0.25, z)), [stations]);
  const extent = useMemo(
    () => Math.max(mapExtent(visiblePlacements), ...islets.map((i) => Math.hypot(i.pos[0], i.pos[1]) + ISLET_RADIUS + 1)),
    [visiblePlacements, islets],
  );

  const plants = useMemo(
    () =>
      growthSpots(
        visiblePlacements,
        Object.fromEntries(visiblePlacements.map((p) => [p.id, { growth: states[p.id].growth ?? 1, muted: states[p.id].relation === 'other' }])),
        coreGrowth,
      ),
    [states, coreGrowth, visiblePlacements],
  );

  // Where each island meets the water: the outer face of its bottom ring of boulders.
  const shores = useMemo(
    () => [
      { pos: [0, 0] as const, radius: CORE_RADIUS + 0.32 },
      ...visiblePlacements.map((p) => ({ pos: p.pos, radius: ISLAND_RADIUS + 0.32 })),
      ...islets.map((i) => ({ pos: i.pos, radius: ISLET_RADIUS + 0.2 })),
    ],
    [visiblePlacements, islets],
  );
  const muted = useMemo(() => Object.fromEntries(visiblePlacements.map((p) => [p.id, states[p.id].relation === 'other'])), [states, visiblePlacements]);
  return (
    <>
      <color attach="background" args={[theme.sky.horizon]} />
      <fog attach="fog" args={[new Color(theme.fog.color), theme.fog.near, theme.fog.far]} />
      <Environment />
      <Lights shadows={shadows} />
      <SkyDome />
      <Sea shadows={shadows} islands={shores} animate={animate} />
      <Clouds islands={visiblePlacements} density={theme.cloud.amount * (quality === 'high' ? 1 : 0.6)} animate={animate} />
      <CoreIsland shadows={shadows} selected={selected === 'core'} onSelect={() => onSelect('core')} animate={animate} />
      {visiblePlacements.map((p) => {
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
      {visiblePlacements.map((p) => (
        <Island
          key={p.id}
          placement={p}
          state={states[p.id]}
          selected={selected === p.id}
          onSelect={onSelect}
          animate={animate}
          shadows={shadows}
          arrange={arrange}
          onMove={(id, x, z) => {
            const [cx, cz] = clearSpot(id, x, z, visiblePlacements);
            onMove?.(id, cx, cz);
          }}
        />
      ))}
      {islets.map((i) => (
        <Bridge
          key={`ib-${i.id}`}
          from={i.from}
          fromRadius={ISLAND_RADIUS}
          to={i.pos}
          toRadius={ISLET_RADIUS}
          relation={i.state === 'selected' ? 'added' : i.state === 'available' ? 'neutral' : 'suggested'}
          mode="connected"
          done={i.state === 'available' ? 0 : i.state === 'building' ? 1 : 2}
          total={2}
          animate={animate}
          shadows={shadows}
        />
      ))}
      {islets.map((i) => (
        <Islet key={`i-${i.id}`} islet={i} shadows={shadows} animate={animate} onSelect={() => onSelectCareer?.(i.group, i.id)} />
      ))}
      <Garden spots={plants} shadows={shadows} animate={animate} />
      <Cliffs placements={visiblePlacements} muted={muted} quality={quality} shadows={shadows} />
      {quality === 'high' && <Motes placements={visiblePlacements} animate={animate} />}
      {visiblePlacements.filter((p) => states[p.id].checked).map((p) => (
        <Flag key={`f-${p.id}`} at={flagSpot(p)} animate={animate} />
      ))}
      <Rig focus={selected === 'core' || (selected && visibleIds.has(selected)) ? selected : null} animate={animate} arrange={arrange} placements={visiblePlacements} extent={extent} view={view} />
      {quality === 'high' && <TiltShift />}
      <LabelProjector labels={labels} anchors={anchors} visible={visibleIds} careers={isletAnchors} stations={stationAnchors} />
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
