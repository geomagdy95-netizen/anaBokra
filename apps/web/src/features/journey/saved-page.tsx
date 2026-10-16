'use client';

import { careers, clusters } from '@anabokra/content';
import { Bookmark, BookmarkX, ChevronRight } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { BridgeSwatch } from '@/features/world/bridge-swatch';
import type { GroupId } from '@/features/world/types';
import { Link } from '@/i18n/navigation';
import type { JourneyData } from '@/lib/journey/journey';
import { islandStates } from '@/lib/journey/map-state';
import { setInList } from '@/lib/journey/verify';

import { AppShell } from './app-shell';
import { HeroCard, HeroText } from './cards';
import { JourneyGate } from './journey-gate';
import { useJT } from './use-jt';

/** Saved: the paths the user bookmarked from the island sheet. Kept on the phone with the journey. */
export function SavedPage() {
  return <JourneyGate>{(data, reload) => <Saved data={data} onChanged={reload} />}</JourneyGate>;
}

function Saved({ data, onChanged }: { data: JourneyData; onChanged: () => void }) {
  const jt = useJT();
  const locale = useLocale() as 'ar' | 'en';
  const states = useMemo(() => islandStates(data.preview, data.journey), [data.preview, data.journey]);
  const saved = (data.journey.saved ?? []).filter((id): id is GroupId => id in states);

  const remove = async (id: string) => {
    await setInList(data.rt.device.kv, data.rt.userId, 'saved', id, false);
    onChanged();
  };

  return (
    <AppShell tab="saved" title={jt('saved.title')} subtitle={jt('saved.subtitle')} testId="saved">
      {saved.length === 0 ? (
        <HeroCard className="mt-4" eyebrow={jt('saved.title')} icon={<Bookmark className="size-9 text-primary" />} title={jt('saved.emptyTitle')} testId="saved-empty">
          <HeroText>{jt('saved.emptyBody')}</HeroText>
          <Button asChild size="lg" className="self-start">
            <Link href="/journey?view=list">{jt('saved.goExplore')}</Link>
          </Button>
        </HeroCard>
      ) : (
        <ul className="space-y-3" data-testid="saved-list">
          {saved.map((id) => {
            const s = states[id];
            const group = clusters.find((c) => c.id === id);
            const count = careers.filter((c) => c.cluster === id).length;
            return (
              <li key={id} className="surface flex items-center gap-3 py-2 pe-2">
                <BridgeSwatch relation={s.relation} broken={s.bridge !== 'connected'} />
                <Link href={`/journey?island=${id}`} className="min-h-12 min-w-0 flex-1 py-2">
                  <span className="block font-bold">{group?.name[locale] ?? id}</span>
                  <span className="block text-xs text-muted-foreground">
                    {jt(`explore.status.${s.relation}`)} · {jt('explore.careers', { count })}
                  </span>
                </Link>
                <button onClick={() => void remove(id)} aria-label={jt('explore.actions.unsave')} className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground">
                  <BookmarkX className="size-5" />
                </button>
                <Link href={`/journey?island=${id}`} aria-label={jt('saved.open')} className="grid size-11 shrink-0 place-items-center rounded-full text-primary hover:bg-secondary">
                  <ChevronRight className="size-5 rtl:rotate-180" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
