'use client';

import { careers, clusters, pathById } from '@anabokra/content';
import { Bookmark, BookmarkCheck, Check, ChevronRight, List, Map as MapIcon, Search, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useRenderer } from '@/features/path/capabilities';
import { BridgeSwatch } from '@/features/world/bridge-swatch';
import { GROUP_ORDER, type GroupId, type IslandState, type Relation, type Selection } from '@/features/world/types';
import type { Quality } from '@/features/world/world-canvas';
import { Link, useRouter } from '@/i18n/navigation';
import type { JourneyData } from '@/lib/journey/journey';
import { islandStates } from '@/lib/journey/map-state';
import { setInList } from '@/lib/journey/verify';
import { cn } from '@/lib/utils';

import { AccountButton, AppShell } from './app-shell';
import { JourneyGate } from './journey-gate';
import { useJT } from './use-jt';

// The three.js stack stays behind this dynamic import: not in the first-load bundle, never SSR'd.
const WorldCanvas = dynamic(() => import('@/features/world/world-canvas'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-pulse bg-brand-lavender" />,
});

const RANK: Record<Relation, number> = { suggested: 0, added: 1, neutral: 2, other: 3 };

/** Explore (reference board 01/02): every path island on the map or in a list, with search and the island sheet. */
export function ExplorePage() {
  return <JourneyGate>{(data, reload) => <Explore data={data} onChanged={reload} />}</JourneyGate>;
}

function Explore({ data, onChanged }: { data: JourneyData; onChanged: () => void }) {
  const jt = useJT();
  const locale = useLocale() as 'ar' | 'en';
  const router = useRouter();
  const params = useSearchParams();
  const r = useRenderer();
  const [view, setView] = useState<'map' | 'list'>('map');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Selection | null>(() => {
    const id = params.get('island');
    return id && (GROUP_ORDER as readonly string[]).includes(id) ? (id as GroupId) : null;
  });
  const [toast, setToast] = useState<string | null>(null);
  const [labels] = useState(() => new Map<string, HTMLElement>());

  const states = useMemo(() => islandStates(data.preview, data.journey), [data.preview, data.journey]);
  const saved = data.journey.saved ?? [];
  const stage = data.preview.flat ? 'none' : data.preview.stage;

  const name = (id: GroupId) => clusters.find((c) => c.id === id)?.name[locale] ?? id;
  /** Map labels use the first part of the name ("الصحة والطب" → "الصحة"), as in the reference board. */
  const shortName = (id: GroupId) => name(id).split(/ و| & /)[0]!;
  const careersOf = (id: GroupId) => careers.filter((c) => c.cluster === id);

  useEffect(() => {
    if (!toast) return;
    const h = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(h);
  }, [toast]);

  const canMap = r.ready && r.webgl && r.reason !== 'error';
  const quality: Quality = r.reason === 'low-end' ? 'low' : 'high';
  const q = query.trim().toLowerCase();
  const showMap = canMap && view === 'map' && !q;

  const ordered = useMemo(() => [...GROUP_ORDER].sort((a, b) => RANK[states[a].relation] - RANK[states[b].relation]), [states]);
  const matches = useMemo(() => {
    if (!q) return null;
    const hit = (s: string) => s.toLowerCase().includes(q);
    const groups = GROUP_ORDER.filter((id) => {
      const c = clusters.find((x) => x.id === id);
      return c && (hit(c.name.ar) || hit(c.name.en));
    });
    const jobs = careers.filter((c) => hit(c.name.ar) || hit(c.name.en)).slice(0, 12);
    return { groups, jobs };
  }, [q]);

  const open = (id: Selection | null) => {
    if (id === 'core') return router.push('/journey');
    setSelected(id);
  };

  const setList = async (list: 'added' | 'saved', id: GroupId, on: boolean, message?: string) => {
    await setInList(data.rt.device.kv, data.rt.userId, list, id, on);
    if (message) setToast(message);
    onChanged();
  };

  const register = (key: string) => (el: HTMLElement | null) => {
    if (!el) return;
    labels.set(key, el);
    return () => {
      labels.delete(key);
    };
  };

  const group = selected && selected !== 'core' ? selected : null;

  return (
    <AppShell tab="explore" fill title={jt('explore.title')} subtitle={jt(`explore.hint.${stage}`)} action={<AccountButton />} testId="explore">
      <div className="flex h-full flex-col">
        {/* Search and view toggle */}
        <div className="flex items-center gap-2 px-4 pb-3">
          <label className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-2xl bg-card px-4 shadow-sm ring-1 ring-border/70 focus-within:ring-2 focus-within:ring-ring/50">
            <Search className="size-5 text-muted-foreground" aria-hidden />
            <input
              type="text"
              inputMode="search"
              enterKeyHint="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={jt('explore.search')}
              aria-label={jt('explore.search')}
              className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              data-testid="explore-search"
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label={jt('explore.clear')} className="-me-3 grid size-11 place-items-center rounded-full text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            )}
          </label>
          {!q && (
            <div className="flex shrink-0 rounded-full bg-card p-1 shadow-sm ring-1 ring-border/70" role="tablist" aria-label={jt('explore.viewLabel')}>
              {(
                [
                  ['map', MapIcon],
                  ['list', List],
                ] as const
              ).map(([v, Icon]) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  aria-label={jt(`explore.view.${v}`)}
                  title={jt(`explore.view.${v}`)}
                  disabled={v === 'map' && !canMap}
                  onClick={() => setView(v)}
                  className={cn(
                    'grid size-11 place-items-center rounded-full transition-colors disabled:opacity-40',
                    view === v ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground/70 hover:bg-secondary',
                  )}
                  data-testid={`view-${v}`}
                >
                  <Icon className="size-5" aria-hidden />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-t-3xl bg-brand-lavender">
          {showMap ? (
            <>
              <WorldCanvas states={states} selected={selected} onSelect={open} quality={quality} reducedMotion={r.reducedMotion} labels={labels} onError={r.reportFailure} />
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {GROUP_ORDER.map((id) => {
                  const s = states[id];
                  const isSel = selected === id;
                  return (
                    <button
                      key={id}
                      ref={register(`island:${id}`)}
                      onClick={() => open(id)}
                      style={{ visibility: 'hidden' }}
                      aria-label={name(id)}
                      aria-pressed={isSel}
                      data-testid={`map-island-${id}`}
                      className={cn(
                        'pointer-events-auto absolute left-0 top-0 whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-bold shadow-[0_4px_14px_rgba(41,17,55,0.16)] after:absolute after:-inset-x-1 after:-inset-y-3 after:content-[""] transition-colors',
                        isSel ? 'z-20 bg-primary text-white' : s.relation === 'suggested' ? 'z-10 bg-white text-brand-plum ring-2 ring-brand-violet-soft' : s.relation === 'other' ? 'bg-white/85 text-brand-plum/55' : 'bg-white text-brand-plum',
                      )}
                    >
                      {shortName(id)}
                    </button>
                  );
                })}
                <button
                  ref={register('core')}
                  onClick={() => open('core')}
                  style={{ visibility: 'hidden' }}
                  aria-label={jt('explore.me')}
                  className="pointer-events-auto absolute left-0 top-0 flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-3 py-1 text-[13px] after:absolute after:-inset-x-1 after:-inset-y-3 after:content-[''] border-brand-orange-soft bg-white font-bold text-brand-plum shadow-[0_4px_14px_rgba(41,17,55,0.16)]"
                >
                  <span className="size-2 rounded-full bg-brand-orange-soft" aria-hidden />
                  {jt('explore.me')}
                </button>
                {GROUP_ORDER.filter((id) => states[id].bridge === 'updating').map((id) => (
                  <span
                    key={`b-${id}`}
                    ref={register(`bridge:${id}`)}
                    style={{ visibility: 'hidden' }}
                    className="absolute left-0 top-0 flex items-center gap-1 whitespace-nowrap rounded-full border border-brand-violet-soft/40 bg-white/90 px-2 py-0.5 text-[11px] font-medium text-primary"
                  >
                    <span className="size-1.5 animate-pulse rounded-full bg-brand-violet-soft" />
                    {jt('explore.updating')}
                  </span>
                ))}
              </div>
            </>
          ) : matches ? (
            <div className="h-full overflow-y-auto p-4 pb-8" data-testid="explore-results">
              {matches.groups.length === 0 && matches.jobs.length === 0 && <p className="rounded-2xl bg-card p-4 text-sm">{jt('explore.noResults')}</p>}
              {matches.groups.length > 0 && (
                <ul className="space-y-2">
                  {matches.groups.map((id) => (
                    <IslandRow key={id} id={id} state={states[id]} name={name(id)} careers={careersOf(id).length} onOpen={() => open(id)} />
                  ))}
                </ul>
              )}
              {matches.jobs.length > 0 && (
                <>
                  <h2 className="mb-2 mt-4 text-sm font-semibold text-muted-foreground">{jt('explore.careersFound')}</h2>
                  <ul className="space-y-2">
                    {matches.jobs.map((c) => (
                      <li key={c.id}>
                        <Link href={`/careers/${c.id}`} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm hover:shadow-md">
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold">{c.name[locale]}</span>
                            <span className="block text-xs text-muted-foreground">{name(c.cluster as GroupId)}</span>
                          </span>
                          <ChevronRight className="size-4 text-primary rtl:rotate-180" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ) : (
            <ul className="h-full space-y-2 overflow-y-auto p-4 pb-40" data-testid="explore-list">
              {!canMap && r.ready && <li className="rounded-2xl bg-card/80 p-3 text-sm">{jt('explore.noMap')}</li>}
              {ordered.map((id) => (
                <IslandRow key={id} id={id} state={states[id]} name={name(id)} careers={careersOf(id).length} onOpen={() => open(id)} />
              ))}
            </ul>
          )}

          {toast && (
            <div role="status" className="absolute inset-x-0 top-3 z-30 mx-auto flex w-fit items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-medium shadow-lg">
              <span className="grid size-5 place-items-center rounded-full bg-brand-success text-white">
                <Check className="size-3.5" aria-hidden />
              </span>
              {toast}
            </div>
          )}

          {!group && !matches && <Legend stage={stage} />}

          {group && (
            <IslandSheet
              id={group}
              state={states[group]}
              data={data}
              name={name(group)}
              saved={saved.includes(group)}
              added={Boolean(data.journey.added?.includes(group))}
              onClose={() => setSelected(null)}
              onAdd={(on) => void setList('added', group, on, on ? jt('explore.toast.added') : undefined)}
              onSave={(on) => void setList('saved', group, on, on ? jt('explore.toast.saved') : undefined)}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}

function IslandRow({ id, state, name, careers: count, onOpen }: { id: GroupId; state: IslandState; name: string; careers: number; onOpen: () => void }) {
  const jt = useJT();
  return (
    <li>
      <button onClick={onOpen} className="flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-start shadow-sm transition-shadow hover:shadow-md" data-testid={`list-island-${id}`}>
        <BridgeSwatch relation={state.relation} broken={state.bridge !== 'connected'} />
        <span className="min-w-0 flex-1">
          <span className="block font-bold">{name}</span>
          <span className="block text-xs text-muted-foreground">
            {jt(`explore.status.${state.relation}`)} · {jt('explore.careers', { count })}
          </span>
        </span>
        {state.done > 0 && <span className="text-xs text-muted-foreground">{jt('explore.progress', { done: state.done, total: state.total })}</span>}
      </button>
    </li>
  );
}

function Legend({ stage }: { stage: 'none' | 'early' | 'suggested' }) {
  const jt = useJT();
  const items: readonly (readonly [Relation | 'updating', boolean])[] =
    stage === 'suggested'
      ? [
          ['suggested', false],
          ['other', true],
          ['added', false],
        ]
      : stage === 'early'
        ? [
            ['neutral', false],
            ['updating', true],
          ]
        : [['neutral', false]];
  return (
    <div className="absolute inset-x-3 bottom-3 z-20 rounded-2xl bg-card/90 p-3 shadow-lg backdrop-blur" data-testid="legend">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {items.map(([k, broken]) => (
          <div key={k} className="flex items-center gap-2">
            <BridgeSwatch relation={k === 'updating' ? 'neutral' : k} broken={broken} />
            <span className="text-xs font-bold">{jt(`explore.legend.${k}`)}</span>
          </div>
        ))}
      </div>
      {stage === 'suggested' && <p className="mt-2 border-t border-border pt-2 text-[11px] text-muted-foreground">{jt('explore.disclaimer')}</p>}
    </div>
  );
}

function IslandSheet({
  id,
  state,
  data,
  name,
  saved,
  added,
  onClose,
  onAdd,
  onSave,
}: {
  id: GroupId;
  state: IslandState;
  data: JourneyData;
  name: string;
  saved: boolean;
  added: boolean;
  onClose: () => void;
  onAdd: (on: boolean) => void;
  onSave: (on: boolean) => void;
}) {
  const jt = useJT();
  const locale = useLocale() as 'ar' | 'en';
  const list = careers.filter((c) => c.cluster === id);
  const hasPath = Boolean(pathById(id));
  const canVerify = hasPath && data.preview.stage === 'suggested';
  const color = state.relation === 'added' ? 'var(--brand-orange-soft)' : state.relation === 'suggested' ? 'var(--brand-violet)' : '#E2B66E';

  return (
    <section
      aria-label={name}
      className="absolute inset-x-0 bottom-0 z-30 max-h-[85%] overflow-y-auto rounded-t-3xl bg-card p-5 pb-6 shadow-[0_-12px_40px_rgba(41,17,55,0.18)]"
      data-testid="island-sheet"
    >
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-foreground/15" aria-hidden />
      <div className="flex items-start gap-3">
        <button
          onClick={() => onSave(!saved)}
          aria-pressed={saved}
          aria-label={jt(saved ? 'explore.actions.unsave' : 'explore.actions.save')}
          className={cn('grid size-12 shrink-0 place-items-center rounded-2xl transition-colors', saved ? 'bg-brand-orange-soft text-brand-plum' : 'bg-secondary text-primary')}
          data-testid="sheet-save"
        >
          {saved ? <BookmarkCheck className="size-5" /> : <Bookmark className="size-5" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-primary">{jt(`explore.status.${state.relation}`)}</p>
          <h2 className="text-2xl font-bold text-brand-ink dark:text-foreground">{name}</h2>
        </div>
        <button onClick={onClose} aria-label={jt('explore.close')} className="-me-2 grid size-11 place-items-center rounded-full hover:bg-secondary">
          <X className="size-5" />
        </button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{jt(`explore.sheet.${state.relation}`)}</p>

      {hasPath && state.relation !== 'other' && state.relation !== 'neutral' && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>{jt('explore.bridge')}</span>
            <span>{jt('explore.progress', { done: state.done, total: state.total })}</span>
          </div>
          <div className="flex gap-1" aria-hidden>
            {Array.from({ length: state.total }, (_, i) => (
              <span key={i} className="h-2 flex-1 rounded-full" style={{ background: i < state.done ? color : 'var(--brand-lilac)' }} />
            ))}
          </div>
        </div>
      )}

      {list.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold">{jt('explore.careers', { count: list.length })}</h3>
          <ul className="flex flex-wrap gap-2">
            {list.map((c) => (
              <li key={c.id}>
                <Link href={`/careers/${c.id}`} className="inline-flex min-h-11 items-center rounded-full border border-border bg-background px-4 text-sm font-medium hover:border-primary hover:text-primary">
                  {c.name[locale]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 grid gap-2">
        {(state.relation === 'other' || state.relation === 'neutral') && !added && (
          <Button variant="accent" size="lg" onClick={() => onAdd(true)} data-testid="sheet-add">
            {jt('explore.actions.add')}
          </Button>
        )}
        {canVerify ? (
          <Button asChild size="lg" data-testid="sheet-explore">
            <Link href={`/journey/${id}`}>
              {jt(state.done > 0 ? 'explore.actions.continue' : 'explore.actions.explore')}
              <ChevronRight className="size-5 rtl:rotate-180" aria-hidden />
            </Link>
          </Button>
        ) : (
          <p className="rounded-xl bg-secondary p-3 text-sm text-secondary-foreground" data-testid="sheet-not-ready">
            {hasPath ? jt('verify.notReady') : jt('reward.verifySoon')}
          </p>
        )}
        {added && (
          <button onClick={() => onAdd(false)} className="tap-link justify-center text-muted-foreground">
            {jt('explore.actions.remove')}
          </button>
        )}
        {data.hasResult && (
          <Link href="/assessment/result" className="tap-link justify-center">
            {jt('explore.actions.review')}
          </Link>
        )}
      </div>
    </section>
  );
}
