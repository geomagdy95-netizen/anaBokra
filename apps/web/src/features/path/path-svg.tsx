'use client';

import { useLocale } from 'next-intl';
import { useMemo } from 'react';

import { nodeColor, nodeShade, propColor, rgbToHex } from './palette';
import { activeTarget, doneT, LANDMARK_INDEX, stationState, type PathSceneProps } from './scene-state';
import type { PropKind, WorldProp } from './types';

/** Tiny top-down glyph per prop kind, as an SVG path fragment centred on (x, z). */
function glyph(kind: PropKind, x: number, z: number, s: number): string {
  const f = (v: number) => v.toFixed(1);
  switch (kind) {
    case 'crystal':
      return `M${f(x)} ${f(z - 1.6 * s)}L${f(x + 0.9 * s)} ${f(z + 0.9 * s)}L${f(x - 0.9 * s)} ${f(z + 0.9 * s)}Z`;
    case 'tree':
      return `M${f(x)} ${f(z - 1.2 * s)}L${f(x + 0.9 * s)} ${f(z + 0.8 * s)}L${f(x - 0.9 * s)} ${f(z + 0.8 * s)}Z`;
    case 'orb':
    case 'lamp':
      return `M${f(x - 0.8 * s)} ${f(z)}a${f(0.8 * s)} ${f(0.8 * s)} 0 1 0 ${f(1.6 * s)} 0a${f(0.8 * s)} ${f(0.8 * s)} 0 1 0 ${f(-1.6 * s)} 0Z`;
    case 'tower':
      return `M${f(x - 0.7 * s)} ${f(z - 0.7 * s)}h${f(1.4 * s)}v${f(1.4 * s)}h${f(-1.4 * s)}Z`;
    case 'slab':
      return `M${f(x - 1.4 * s)} ${f(z)}l${f(0.7 * s)} ${f(-1.2 * s)}h${f(1.4 * s)}l${f(0.7 * s)} ${f(1.2 * s)}l${f(-0.7 * s)} ${f(1.2 * s)}h${f(-1.4 * s)}Z`;
    default: // rock, shed, house
      return `M${f(x - 1.1 * s)} ${f(z - 0.8 * s)}h${f(2.2 * s)}v${f(1.6 * s)}h${f(-2.2 * s)}Z`;
  }
}

/**
 * Top-down SVG rendering of a generated world. Same data and palette as the 3D scene.
 * x maps to x, z maps to y, so the journey climbs from the bottom (start) to the top (end).
 */
export function PathSvg({ world, progress, focus, onFocus, palette, label }: PathSceneProps & { label: string }) {
  const locale = useLocale();
  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const half = world.size / 2;
  const active = activeTarget(progress, focus);

  const terrain = useMemo(() => {
    const N = world.grid;
    const groups = new Map<string, string[]>();
    for (let j = 0; j < N - 1; j++) {
      for (let i = 0; i < N - 1; i++) {
        const a = j * N + i;
        const ids = [a, a + 1, a + N, a + N + 1];
        const cols = ids.map((n, q) => nodeColor(world, n, palette, nodeShade(world, i + (q & 1), j + (q >> 1))));
        const c = [0, 1, 2].map((ch) => cols.reduce((s, col) => s + col[ch]!, 0) / 4) as [number, number, number];
        // 5 bits per channel keeps the number of <path> groups small
        const q = (v: number) => Math.round(v * 31) / 31;
        const hex = rgbToHex([q(c[0]), q(c[1]), q(c[2])]);
        const x = -half + i * world.cell;
        const z = -half + j * world.cell;
        const rect = `M${x.toFixed(2)} ${z.toFixed(2)}h${(world.cell + 0.04).toFixed(2)}v${(world.cell + 0.04).toFixed(2)}h${(-world.cell - 0.04).toFixed(2)}Z`;
        const list = groups.get(hex);
        if (list) list.push(rect);
        else groups.set(hex, [rect]);
      }
    }
    return [...groups.entries()].map(([hex, rects]) => ({ hex, d: rects.join('') }));
  }, [world, palette, half]);

  const props = useMemo(() => {
    const byKind = new Map<PropKind, WorldProp[]>();
    for (const p of world.props) byKind.set(p.kind, [...(byKind.get(p.kind) ?? []), p]);
    return [...byKind.entries()].map(([kind, list]) => ({
      kind,
      d: list.map((p) => glyph(kind, p.pos[0], p.pos[2], p.scale * (kind === 'tree' ? 1 : 1.1))).join(''),
      fill: rgbToHex(propColor(list[Math.floor(list.length / 2)]!, palette)),
    }));
  }, [world, palette]);

  const pts = world.path.points;
  const line = (list: typeof pts) => list.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.z.toFixed(2)}`).join('');
  const dt = doneT(world, progress);
  const donePts = pts.filter((p) => p.t <= dt);

  const activate = (target: number) => onFocus(focus === target ? null : target);

  return (
    <svg
      viewBox={`${-half} ${-half} ${world.size} ${world.size}`}
      role="img"
      aria-label={label}
      className="size-full touch-manipulation select-none"
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="crispEdges"
    >
      <rect x={-half} y={-half} width={world.size} height={world.size} fill={palette.sky} />
      <g>
        {terrain.map((g) => (
          <path key={g.hex} d={g.d} fill={g.hex} />
        ))}
      </g>
      <g shapeRendering="geometricPrecision">
        {props.map((g) => (
          <path key={g.kind} d={g.d} fill={g.fill} opacity={0.9} />
        ))}
        {world.slots.map((s) => (
          <path
            key={s.rank}
            d={`M${s.pos[0]} ${s.pos[2] - 2.2}L${s.pos[0] + 2.2} ${s.pos[2]}L${s.pos[0]} ${s.pos[2] + 2.2}L${s.pos[0] - 2.2} ${s.pos[2]}Z`}
            fill={palette.regions[s.region]}
            stroke="#fff"
            strokeWidth={0.5}
            opacity={0.95}
          />
        ))}
        <path d={line(pts)} fill="none" stroke="#00000022" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
        <path d={line(pts)} fill="none" stroke={palette.road} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
        {donePts.length > 1 && (
          <path d={line(donePts)} fill="none" stroke={palette.roadDone} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
        )}

        <g
          role="button"
          tabIndex={0}
          aria-pressed={active === LANDMARK_INDEX}
          aria-label={nf.format(LANDMARK_INDEX + 1)}
          className="cursor-pointer outline-none"
          onClick={() => activate(LANDMARK_INDEX)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && activate(LANDMARK_INDEX)}
        >
          <circle cx={world.landmark.pos[0]} cy={world.landmark.pos[2]} r={world.landmark.radius} fill={progress >= LANDMARK_INDEX ? palette.station.current : palette.station.locked} opacity={0.35} />
          <path
            d={`M${world.landmark.pos[0]} ${world.landmark.pos[2] - 3.2}l0.9 2.2l2.3 0.2l-1.8 1.5l0.6 2.3l-2-1.3l-2 1.3l0.6 -2.3l-1.8-1.5l2.3-0.2Z`}
            fill={progress >= LANDMARK_INDEX ? palette.station.current : palette.station.locked}
            stroke="#fff"
            strokeWidth={0.4}
          />
          {active === LANDMARK_INDEX && (
            <circle cx={world.landmark.pos[0]} cy={world.landmark.pos[2]} r={world.landmark.radius + 1} fill="none" stroke="#fff" strokeWidth={0.8} strokeDasharray="1.6 1.2" />
          )}
        </g>

        {world.stations.map((s) => {
          const st = stationState(s.index, progress);
          return (
            <g
              key={s.index}
              role="button"
              tabIndex={0}
              aria-pressed={active === s.index}
              aria-label={nf.format(s.index + 1)}
              className="cursor-pointer outline-none"
              onClick={() => activate(s.index)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && activate(s.index)}
            >
              <circle cx={s.pos[0]} cy={s.pos[2]} r={5} fill="transparent" />
              <circle cx={s.pos[0]} cy={s.pos[2]} r={st === 'current' ? 3.4 : 2.7} fill={palette.station[st]} stroke="#fff" strokeWidth={0.7} />
              <text x={s.pos[0]} y={s.pos[2] + 1.15} textAnchor="middle" fontSize={3.2} fontWeight={700} fill="#fff" style={{ pointerEvents: 'none' }}>
                {nf.format(s.index + 1)}
              </text>
              {active === s.index && (
                <circle cx={s.pos[0]} cy={s.pos[2]} r={4.8} fill="none" stroke="#fff" strokeWidth={0.8} strokeDasharray="1.6 1.2" />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
