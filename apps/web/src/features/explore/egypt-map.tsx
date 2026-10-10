'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';

import { useGovName, useNumber } from './common';
import { MAP_TILES } from './governorates';

const SIZE = 64;
const GAP = 4;

/**
 * Schematic Egypt map: one tile per governorate in rough geographic position, shaded by university count.
 * Pure inline SVG (no tiles, fonts or network). Each tile is a link into the filtered search.
 */
export function EgyptMap({ counts }: { counts: Record<string, number> }) {
  const t = useTranslations('Explore.map');
  const gov = useGovName();
  const n = useNumber();
  const entries = Object.entries(MAP_TILES);
  const max = Math.max(1, ...Object.values(counts));
  const cols = Math.max(...entries.map(([, [c]]) => c)) + 1;
  const rows = Math.max(...entries.map(([, [, r]]) => r)) + 1;
  const w = cols * (SIZE + GAP);
  const h = rows * (SIZE + GAP);
  return (
    <figure className="space-y-2">
      <svg viewBox={`0 0 ${w} ${h}`} role="group" aria-label={t('label')} className="mx-auto h-auto w-full max-w-md">
        {entries.map(([id, [c, r]]) => {
          const count = counts[id] ?? 0;
          const x = c * (SIZE + GAP);
          const y = r * (SIZE + GAP);
          const name = gov(id);
          return (
            <Link key={id} href={`/explore/search?kind=universities&gov=${id}`} aria-label={t('tile', { name, count })} className="outline-none [&:focus-visible>rect]:stroke-ring [&:focus-visible>rect]:stroke-[3]">
              <rect x={x} y={y} width={SIZE} height={SIZE} rx={8} className="fill-primary stroke-border" fillOpacity={count === 0 ? 0.05 : 0.15 + 0.7 * (count / max)} />
              <text x={x + SIZE / 2} y={y + 26} textAnchor="middle" className="fill-foreground text-[10px]">
                {name}
              </text>
              <text x={x + SIZE / 2} y={y + 48} textAnchor="middle" className="fill-foreground text-[16px] font-bold">
                {n(count)}
              </text>
            </Link>
          );
        })}
      </svg>
      <figcaption className="text-center text-sm text-muted-foreground">{t('caption')}</figcaption>
    </figure>
  );
}
