import { mulberry32, type Rng } from '../path/rng';

/**
 * Turn the shape (spatial ability, a 2D mental-rotation task): a shape made of squares, and four
 * turned shapes. Exactly one is the same shape turned; the other three are its mirror image turned,
 * so they can't be matched by turning. Shapes are random with no symmetry at all (every turn looks
 * different, none matches the mirror) and grow from 4 to 7 squares. No clock.
 */

export type Cell = readonly [number, number];
export type Shape = Cell[];

export interface RotationItem {
  level: number;
  target: Shape;
  options: Shape[];
  answer: number;
}

/** Shift so the smallest x and y are 0, and sort, so equal shapes compare equal. */
export function normalize(shape: Shape): Shape {
  const mx = Math.min(...shape.map((c) => c[0]));
  const my = Math.min(...shape.map((c) => c[1]));
  return shape.map(([x, y]) => [x - mx, y - my] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

export const key = (shape: Shape) => JSON.stringify(normalize(shape));
export const turn = (shape: Shape, quarter: number): Shape => {
  let s = shape;
  for (let i = 0; i < ((quarter % 4) + 4) % 4; i++) s = s.map(([x, y]) => [-y, x] as const);
  return normalize(s);
};
export const mirror = (shape: Shape): Shape => normalize(shape.map(([x, y]) => [-x, y] as const));

/**
 * True when the shape is fully lopsided: its four turns all look different (so the right answer is
 * never the same view and no two options repeat) and its mirror can't be reached by turning (so the
 * mirror options are always wrong).
 */
export const lopsided = (shape: Shape) =>
  new Set([0, 1, 2, 3].map((q) => key(turn(shape, q)))).size === 4 && [0, 1, 2, 3].every((q) => key(turn(shape, q)) !== key(mirror(shape)));

function grow(rng: Rng, n: number): Shape {
  const cells: Cell[] = [[0, 0]];
  while (cells.length < n) {
    const [x, y] = cells[Math.floor(rng() * cells.length)]!;
    const [dx, dy] = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)[Math.floor(rng() * 4)]!;
    const next: Cell = [x + dx, y + dy];
    if (!cells.some((c) => c[0] === next[0] && c[1] === next[1])) cells.push(next);
  }
  return normalize(cells);
}

const SIZES: Record<number, number> = { 1: 4, 2: 5, 3: 6, 4: 7 };

const shuffle = <T,>(rng: Rng, xs: T[]): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

export function rotationItem(level: number, seed: number): RotationItem {
  const rng = mulberry32(seed);
  const n = SIZES[level] ?? 7;
  let target = grow(rng, n);
  while (!lopsided(target)) target = grow(rng, n);
  // The right one is always actually turned (a quarter, half or three quarters), never the same view.
  const right = turn(target, 1 + Math.floor(rng() * 3));
  const wrong = shuffle(rng, [0, 1, 2, 3])
    .slice(0, 3)
    .map((q) => turn(mirror(target), q));
  const options = shuffle(rng, [right, ...wrong]);
  return { level, target, options, answer: options.findIndex((o) => key(o) === key(right)) };
}

export const ROTATION_LEVELS = [1, 1, 2, 2, 3, 3, 4, 4] as const;

export function rotationRun(seed: number): { practice: RotationItem; items: RotationItem[] } {
  return { practice: rotationItem(1, seed ^ 0x1b873593), items: ROTATION_LEVELS.map((level, i) => rotationItem(level, seed + i * 15485863)) };
}
