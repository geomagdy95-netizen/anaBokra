'use client';

import { clusters, pathById } from '@anabokra/content';
import dynamic from 'next/dynamic';
import { useLocale } from 'next-intl';
import { useMemo, useState } from 'react';

import { useRenderer } from '@/features/path/capabilities';
import { GROUP_ORDER, type GroupId, type Selection } from '@/features/world/types';
import type { Quality } from '@/features/world/world-canvas';
import { useRouter } from '@/i18n/navigation';
import type { JourneyData } from '@/lib/journey/journey';
import { islandStates } from '@/lib/journey/map-state';
import { cn } from '@/lib/utils';

import { useJT } from './use-jt';

// The three.js stack stays behind this dynamic import: not in the first-load bundle, never SSR'd.
const WorldCanvas = dynamic(() => import('@/features/world/world-canvas'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-pulse bg-[#EFE9FB]" />,
});

/**
 * The island map on my island, from real progress: suggested paths glow, checked ones carry their
 * bridge progress. Tapping a path with Verify content opens it. Shown only where 3D runs well; the
 * lists below the map hold the same information for everyone else.
 */
export function JourneyMap({ data }: { data: JourneyData }) {
  const jt = useJT();
  const locale = useLocale() as 'ar' | 'en';
  const router = useRouter();
  const r = useRenderer();
  const [selected, setSelected] = useState<Selection | null>(null);
  const [soon, setSoon] = useState<GroupId | null>(null);
  const [labels] = useState(() => new Map<string, HTMLElement>());
  const states = useMemo(() => islandStates(data.preview, data.journey), [data.preview, data.journey]);

  if (!(r.ready && r.webgl && r.renderer === '3d')) return null;
  const quality: Quality = r.reason === 'low-end' ? 'low' : 'high';
  const name = (id: GroupId) => clusters.find((c) => c.id === id)?.name[locale] ?? id;
  const shortName = (id: GroupId) => name(id).split(/ و| & /)[0]!;

  const open = (id: Selection | null) => {
    setSelected(id);
    setSoon(null);
    if (!id || id === 'core') return;
    if (pathById(id) && data.preview.stage === 'suggested') router.push(`/journey/${id}`);
    else setSoon(id);
  };

  const register = (key: string) => (el: HTMLElement | null) => {
    if (!el) return;
    labels.set(key, el);
    return () => {
      labels.delete(key);
    };
  };

  return (
    <section className="relative -mx-4 h-[44dvh] min-h-[280px] overflow-hidden bg-[#EFE9FB]" aria-label={jt('title')} data-testid="journey-map">
      <WorldCanvas states={states} selected={selected} onSelect={open} quality={quality} reducedMotion={r.reducedMotion} labels={labels} onError={r.reportFailure} />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {GROUP_ORDER.map((id) => (
          <button
            key={id}
            ref={register(`island:${id}`)}
            onClick={() => open(id)}
            style={{ visibility: 'hidden' }}
            aria-label={name(id)}
            data-testid={`map-island-${id}`}
            className={cn(
              'pointer-events-auto absolute left-0 top-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold shadow-[0_4px_14px_rgba(41,17,55,0.16)]',
              // Suggested paths sit on top when labels overlap.
              states[id].relation === 'suggested' ? 'z-10 bg-[#7025B5] text-white' : states[id].relation === 'other' ? 'bg-white/85 text-[#291137]/55' : 'bg-white text-[#291137]',
            )}
          >
            {shortName(id)}
          </button>
        ))}
        <button
          ref={register('core')}
          onClick={() => open('core')}
          style={{ visibility: 'hidden' }}
          className="pointer-events-auto absolute left-0 top-0 flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-[#FFA366] bg-white px-2.5 py-0.5 text-xs font-bold text-[#291137] shadow-[0_4px_14px_rgba(41,17,55,0.16)]"
        >
          <span className="size-2 rounded-full bg-[#FFA366]" aria-hidden />
          {jt('title')}
        </button>
      </div>
      {soon && (
        <p role="status" className="absolute inset-x-3 bottom-3 rounded-xl bg-white/95 p-3 text-sm text-[#291137] shadow-lg">
          <span className="font-semibold">{name(soon)}</span> · {data.preview.stage === 'suggested' ? jt('reward.verifySoon') : jt('verify.notReady')}
        </p>
      )}
    </section>
  );
}
