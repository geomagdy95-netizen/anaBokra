import { nodeColor, nodeShade, rgbToHex, type ScenePalette } from '@/features/path/palette';
import type { World } from '@/features/path/types';

/** Terrain as a few filled paths grouped by quantized colour (same technique as the interactive 2D view). */
export function terrainPaths(world: World, palette: ScenePalette): { hex: string; d: string }[] {
  const N = world.grid;
  const half = world.size / 2;
  const groups = new Map<string, string[]>();
  for (let j = 0; j < N - 1; j++) {
    for (let i = 0; i < N - 1; i++) {
      const a = j * N + i;
      const ids = [a, a + 1, a + N, a + N + 1];
      const cols = ids.map((n, q) => nodeColor(world, n, palette, nodeShade(world, i + (q & 1), j + (q >> 1))));
      const c = [0, 1, 2].map((ch) => cols.reduce((s, col) => s + col[ch]!, 0) / 4) as [number, number, number];
      const q = (v: number) => Math.round(v * 31) / 31;
      const hex = rgbToHex([q(c[0]), q(c[1]), q(c[2])]);
      const x = (-half + i * world.cell).toFixed(2);
      const z = (-half + j * world.cell).toFixed(2);
      const w = (world.cell + 0.04).toFixed(2);
      (groups.get(hex) ?? groups.set(hex, []).get(hex)!).push(`M${x} ${z}h${w}v${w}h-${w}Z`);
    }
  }
  return [...groups.entries()].map(([hex, rects]) => ({ hex, d: rects.join('') }));
}

/** Static top-down render of a generated world, for the share image (no hooks, no interactivity). */
export function WorldMapSvg({ world, palette, size }: { world: World; palette: ScenePalette; size: number }) {
  const half = world.size / 2;
  const pts = world.path.points;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.z.toFixed(2)}`).join('');
  return (
    <svg width={size} height={size} viewBox={`${-half} ${-half} ${world.size} ${world.size}`} xmlns="http://www.w3.org/2000/svg">
      <rect x={-half} y={-half} width={world.size} height={world.size} fill={palette.sky} />
      {terrainPaths(world, palette).map((g) => (
        <path key={g.hex} d={g.d} fill={g.hex} />
      ))}
      <path d={line} fill="none" stroke="#00000022" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
      <path d={line} fill="none" stroke={palette.roadDone} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
      {world.slots.map((s) => (
        <path
          key={s.rank}
          d={`M${s.pos[0]} ${s.pos[2] - 2.2}L${s.pos[0] + 2.2} ${s.pos[2]}L${s.pos[0]} ${s.pos[2] + 2.2}L${s.pos[0] - 2.2} ${s.pos[2]}Z`}
          fill={palette.regions[s.region]}
          stroke="#ffffff"
          strokeWidth={0.5}
        />
      ))}
      <circle cx={world.landmark.pos[0]} cy={world.landmark.pos[2]} r={3} fill={palette.station.current} stroke="#ffffff" strokeWidth={0.7} />
    </svg>
  );
}
