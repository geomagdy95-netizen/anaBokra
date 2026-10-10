import { BufferAttribute, BufferGeometry, Color, LatheGeometry, Path, Shape, Vector2, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

import { ISLAND_TOP } from './layout';

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A thick cream disc with a rounded top edge: the body of every island. Vertex colours: light top, warmer sides. */
export function islandGeometry(radius: number, top = ISLAND_TOP, depth = 0.95, bevel = 0.24, segments = 72): BufferGeometry {
  const bottom = top - depth;
  // Bottom to top so the lathe faces point outward.
  const pts: Vector2[] = [new Vector2(0, bottom), new Vector2(radius * 0.93, bottom), new Vector2(radius, bottom + depth * 0.3)];
  pts.push(new Vector2(radius, top - bevel));
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    pts.push(new Vector2(radius - bevel + Math.cos(a) * bevel, top - bevel + Math.sin(a) * bevel));
  }
  pts.push(new Vector2(radius * 0.55, top + 0.015), new Vector2(0, top + 0.02));
  const g = new LatheGeometry(pts, segments);

  const topC = new Color('#FBF4E8');
  const sideC = new Color('#E6D5BA');
  const pos = g.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const t = smooth(top - bevel * 1.4, top - 0.02, pos.getY(i));
    c.copy(sideC).lerp(topC, t);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  return g;
}

const boxCache = new Map<string, BufferGeometry>();

/** Shared rounded box geometry. */
export function roundedBox(w: number, h: number, d: number, r = 0.06): BufferGeometry {
  const key = `${w}|${h}|${d}|${r}`;
  let g = boxCache.get(key);
  if (!g) {
    g = new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2));
    boxCache.set(key, g);
  }
  return g;
}

export function roundedRectShape(w: number, h: number, r: number): Shape {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Speech bubble outline (rounded rectangle with a tail at the bottom left). */
export function bubbleShape(w: number, h: number, r: number): Shape {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w * 0.38, y);
  s.lineTo(x + w * 0.2, y - h * 0.32);
  s.lineTo(x + w * 0.5, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** U-shaped arch ("window of possibility"), open at the bottom. */
export function archShape(w: number, h: number, wall: number): Shape {
  const r = w / 2;
  const ir = r - wall;
  const s = new Shape();
  s.moveTo(-r, 0);
  s.lineTo(-r, h - r);
  s.absarc(0, h - r, r, Math.PI, 0, true);
  s.lineTo(r, 0);
  s.lineTo(ir, 0);
  s.lineTo(ir, h - r);
  s.absarc(0, h - r, ir, 0, Math.PI, false);
  s.lineTo(-ir, 0);
  s.lineTo(-r, 0);
  return s;
}

/** Half disc whose flat side faces left: the apricot sun inside the logo window. */
export function halfDiscShape(r: number): Shape {
  const s = new Shape();
  s.moveTo(0, -r);
  s.absarc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(0, -r);
  return s;
}

/** Right-angle set square with a triangular cut-out. */
export function setSquareShape(w: number, h: number, inset: number): Shape {
  const s = new Shape();
  s.moveTo(0, 0);
  s.lineTo(w, 0);
  s.lineTo(0, h);
  s.lineTo(0, 0);
  const k = inset * 2.3;
  const hole = new Path();
  hole.moveTo(inset, inset);
  hole.lineTo(inset, h - k * (h / w));
  hole.lineTo(w - k, inset);
  hole.lineTo(inset, inset);
  s.holes.push(hole);
  return s;
}

export function gearShape(teeth: number, outer: number, root: number, hole: number): Shape {
  const s = new Shape();
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts: [number, number][] = [
      [root, a],
      [outer, a + step * 0.12],
      [outer, a + step * 0.45],
      [root, a + step * 0.57],
    ];
    pts.forEach(([r, ang], j) => {
      const x = Math.cos(ang) * r;
      const y = Math.sin(ang) * r;
      if (i === 0 && j === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    });
  }
  s.closePath();
  const h = new Path();
  h.absarc(0, 0, hole, 0, Math.PI * 2, true);
  s.holes.push(h);
  return s;
}

/** Open-end wrench standing on its handle: handle width 2·hw, head radius r, notch width 2·nw. */
export function wrenchShape(length: number, hw: number, r: number, nw: number): Shape {
  const s = new Shape();
  const d = Math.asin(hw / r);
  const e = Math.asin(nw / r);
  s.moveTo(-hw, 0);
  s.lineTo(-hw, length - Math.cos(d) * r);
  s.absarc(0, length, r, -Math.PI / 2 - d, Math.PI / 2 + e, true);
  s.lineTo(-nw, length + r * 0.15);
  s.lineTo(nw, length + r * 0.15);
  s.lineTo(nw, length + Math.cos(e) * r);
  s.absarc(0, length, r, Math.PI / 2 - e, -Math.PI / 2 + d, true);
  s.lineTo(hw, 0);
  s.lineTo(-hw, 0);
  return s;
}

/** Pen nib outline, tip up. */
export function nibShape(w: number, h: number): Shape {
  const s = new Shape();
  s.moveTo(0, h);
  s.quadraticCurveTo(w * 0.55, h * 0.55, w * 0.5, h * 0.22);
  s.lineTo(w * 0.42, 0);
  s.lineTo(-w * 0.42, 0);
  s.lineTo(-w * 0.5, h * 0.22);
  s.quadraticCurveTo(-w * 0.55, h * 0.55, 0, h);
  return s;
}

export interface BridgeEnds {
  start: Vector3;
  end: Vector3;
  arch: number;
}

/** Point on a bridge at t in 0..1 (a gentle arch between the two decks). */
export function bridgePoint(b: BridgeEnds, t: number, out = new Vector3()): Vector3 {
  out.copy(b.start).lerp(b.end, t);
  out.y += Math.sin(Math.PI * t) * b.arch;
  return out;
}

/** Flat strip under a bridge, used for the soft glow of suggested and added bridges. */
export function stripGeometry(b: BridgeEnds, width: number, from: number, to: number, segments = 24): BufferGeometry {
  const dir = new Vector3().subVectors(b.end, b.start).setY(0).normalize();
  const side = new Vector3(-dir.z, 0, dir.x).multiplyScalar(width / 2);
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  const p = new Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = from + ((to - from) * i) / segments;
    bridgePoint(b, t, p);
    positions.push(p.x - side.x, p.y - 0.12, p.z - side.z, p.x + side.x, p.y - 0.12, p.z + side.z);
    uvs.push(0, i / segments, 1, i / segments);
    if (i < segments) {
      const k = i * 2;
      index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}
