'use client';

import { clusters } from '@anabokra/content';
import dynamic from 'next/dynamic';
import { useLocale } from 'next-intl';
import { useMemo, useState } from 'react';

import { useRenderer } from '@/features/path/capabilities';
import { GROUP_ORDER, type GroupId } from '@/features/world/types';
import type { Quality } from '@/features/world/world-canvas';
import { Link } from '@/i18n/navigation';
import type { JourneyData } from '@/lib/journey/journey';
import { coreGrowth, islandStates } from '@/lib/journey/map-state';
import { cn } from '@/lib/utils';

import { useJT } from './use-jt';

// The three.js stack stays behind this dynamic import: not in the first-load bundle, never SSR'd.
const WorldCanvas = dynamic(() => import('@/features/world/world-canvas'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-pulse bg-[#EFE9FB]" />,
});

/**
 * The map preview on Home, from real progress: suggested paths glow, added ones are orange, checked
 * ones carry their bridge progress. It is a preview, not a control: only the user's own paths are
 * labelled (every path before there are any), and tapping anywhere opens Explore, where the full map
 * and the island sheets live. Shown only where 3D runs well.
 */
export function JourneyMap({ data }: { data: JourneyData }) {
  const jt = useJT();
  const locale = useLocale() as 'ar' | 'en';
  const r = useRenderer();
  const [labels] = useState(() => new Map<string, HTMLElement>());
  const states = useMemo(() => islandStates(data.preview, data.journey), [data.preview, data.journey]);

  if (!(r.ready && r.webgl && r.renderer === '3d')) return null;
  const quality: Quality = r.reason === 'low-end' ? 'low' : 'high';
  const name = (id: GroupId) => clusters.find((c) => c.id === id)?.name[locale] ?? id;
  const shortName = (id: GroupId) => name(id).split(/ و| & /)[0]!;
  const mine = GROUP_ORDER.filter((id) => states[id].relation === 'suggested' || states[id].relation === 'added');
  const shown = mine.length ? mine : GROUP_ORDER;

  const register = (key: string) => (el: HTMLElement | null) => {
    if (!el) return;
    labels.set(key, el);
    return () => {
      labels.delete(key);
    };
  };

  return (
    <section className="relative h-[34dvh] min-h-[220px] overflow-hidden bg-brand-lavender" data-testid="journey-map">
      <WorldCanvas
        states={states}
        coreGrowth={coreGrowth(data.discover.doneCount)}
        selected={null}
        onSelect={() => {}}
        quality={quality}
        reducedMotion={r.reducedMotion}
        labels={labels}
        onError={r.reportFailure}
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {shown.map((id) => (
          <span
            key={id}
            ref={register(`island:${id}`)}
            style={{ visibility: 'hidden' }}
            data-testid={`map-island-${id}`}
            className={cn(
              'absolute left-0 top-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold shadow-[0_4px_14px_rgba(41,17,55,0.16)]',
              states[id].relation === 'suggested' ? 'z-10 bg-primary text-white' : states[id].relation === 'added' ? 'z-10 bg-brand-orange-soft text-brand-plum' : 'bg-white/90 text-brand-plum',
            )}
          >
            {shortName(id)}
          </span>
        ))}
        <span
          ref={register('core')}
          style={{ visibility: 'hidden' }}
          className="absolute left-0 top-0 flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-brand-orange-soft bg-white px-2.5 py-0.5 text-xs font-bold text-brand-plum shadow-[0_4px_14px_rgba(41,17,55,0.16)]"
        >
          <span className="size-2 rounded-full bg-brand-orange-soft" />
          {jt('explore.me')}
        </span>
      </div>
      {/* The whole preview opens Explore (dragging the small map isn't useful on a phone). */}
      <Link href="/journey/map" aria-label={jt('home.openMap')} className="absolute inset-0 z-20 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset" />
    </section>
  );
}
