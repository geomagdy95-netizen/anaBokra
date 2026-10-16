'use client';

import { careers, clusters, pathById } from '@anabokra/content';
import { Bookmark, BookmarkCheck, Check, ChevronRight, Hand, List, LocateFixed, Lock, Map as MapIcon, Minus, Move, Plus, Search, Sparkles, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { LogoMark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { ProgressBar, useNumberFormat } from '@/features/assessment/primitives';
import { useRenderer } from '@/features/path/capabilities';
import { BridgeSwatch } from '@/features/world/bridge-swatch';
import { IslandArtwork } from '@/features/world/island-artwork';
import { GROUP_ORDER, type CareerIslet, type GroupId, type IslandState, type Relation, type Selection } from '@/features/world/types';
import type { CameraCommand, Quality } from '@/features/world/world-canvas';
import { Link, useRouter } from '@/i18n/navigation';
import { careerIslets, careerState } from '@/lib/journey/career-quest';
import { discoverPlan } from '@/lib/journey/discover-plan';
import type { JourneyData } from '@/lib/journey/journey';
import { coreGrowth, islandStates } from '@/lib/journey/map-state';
import { nextStep, nextStepHref, type NextStep } from '@/lib/journey/next-step';
import { setInList, setIslandPosition, setOnMap } from '@/lib/journey/verify';
import { track } from '@/lib/local/usage';
import { cn } from '@/lib/utils';

import { AccountButton, ScreenTracker } from './app-shell';
import { FieldDetails, FieldIntro } from './field-about';
import { JourneyGate } from './journey-gate';
import { useJT } from './use-jt';

// The three.js stack stays behind this dynamic import: not in the first-load bundle, never SSR'd.
const WorldCanvas = dynamic(() => import('@/features/world/world-canvas'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-pulse bg-brand-lavender" />,
});

const RANK: Record<Relation, number> = { suggested: 0, added: 1, neutral: 2, other: 3 };
const HINT_KEY = 'anabokra.mapHint';

/**
 * Home is the map (docs/product/world-spec.md): the whole world full screen, with glass controls over
 * it and no tab bar. My island carries the Discover stations; tapping an island opens its glass sheet,
 * whose button opens the island's full page. A pill at the bottom always shows the next step. Where 3D
 * doesn't run, or on request, the same world is a list.
 */
export function MapHome() {
  return <JourneyGate>{(data, reload) => <World data={data} onChanged={reload} />}</JourneyGate>;
}

function World({ data, onChanged }: { data: JourneyData; onChanged: () => void }) {
  const jt = useJT();
  const locale = useLocale() as 'ar' | 'en';
  const router = useRouter();
  const params = useSearchParams();
  const r = useRenderer();
  const [view, setView] = useState<'map' | 'list'>(() => (params.get('view') === 'list' ? 'list' : 'map'));
  const [searching, setSearching] = useState(false);
  const [arrange, setArrange] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Selection | null>(() => {
    const id = params.get('island');
    if (id === 'me') return 'core';
    return id && (GROUP_ORDER as readonly string[]).includes(id) ? (id as GroupId) : null;
  });
  const [toast, setToast] = useState<string | null>(null);
  const [labels] = useState(() => new Map<string, HTMLElement>());
  const [camera, setCamera] = useState<CameraCommand | undefined>(undefined);
  const press = (kind: CameraCommand['kind']) => {
    track('map_zoom');
    setCamera((c) => ({ kind, n: (c?.n ?? 0) + 1 }));
  };
  // "Tap any island": shown until the first island is opened or the hint is closed (per device).
  const [hint, setHint] = useState(() => {
    try {
      return window.localStorage.getItem(HINT_KEY) !== 'done';
    } catch {
      return false;
    }
  });
  const dismissHint = () => {
    if (hint) track('map_hint_closed');
    setHint(false);
    try {
      window.localStorage.setItem(HINT_KEY, 'done');
    } catch {
      /* private mode: the hint just comes back next time */
    }
  };
  const select = (id: Selection | null) => {
    if (id) {
      dismissHint();
      track(id === 'core' ? 'map_core' : 'map_island');
    }
    setSelected(id);
  };

  const states = useMemo(() => islandStates(data.preview, data.journey), [data.preview, data.journey]);
  const step = useMemo(() => nextStep(data, states), [data, states]);
  // L2: the career islets of every checked group on the map.
  const islets = useMemo(
    () =>
      Object.fromEntries(
        GROUP_ORDER.filter((id) => states[id].visible !== false).map((id) => [id, careerIslets(data.journey, id).map((c) => ({ id: c, state: careerState(data.journey, c) }))]),
      ) as Partial<Record<GroupId, CareerIslet[]>>,
    [states, data.journey],
  );
  const plan = discoverPlan();
  const saved = data.journey.saved ?? [];
  const stage = data.preview.flat ? 'none' : data.preview.stage;

  const name = (id: GroupId) => clusters.find((c) => c.id === id)?.name[locale] ?? id;
  /** Map labels use the first part of the name ("الصحة والطب" → "الصحة"), as in the reference board. */
  const shortName = (id: GroupId) => name(id).split(/ و|, | & /)[0]!;
  const careersOf = (id: GroupId) => careers.filter((c) => c.cluster === id);

  useEffect(() => {
    if (!toast) return;
    const h = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(h);
  }, [toast]);

  const canMap = r.ready && r.webgl && r.reason !== 'error';
  const lite = r.reason === 'low-end';
  const quality: Quality = lite ? 'low' : 'high';
  const q = query.trim().toLowerCase();
  const showMap = canMap && view === 'map' && !q;

  const ordered = useMemo(() => [...GROUP_ORDER].sort((a, b) => RANK[states[a].relation] - RANK[states[b].relation]), [states]);
  const onMapIds = useMemo(() => GROUP_ORDER.filter((id) => states[id].visible !== false).sort((a, b) => (states[a].slot ?? 0) - (states[b].slot ?? 0)), [states]);
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

  const setList = async (list: 'added' | 'saved', id: GroupId, on: boolean, message?: string) => {
    await setInList(data.rt.device.kv, data.rt.userId, list, id, on);
    if (message) setToast(message);
    onChanged();
  };

  const toggleOnMap = async (id: GroupId, on: boolean) => {
    await setOnMap(data.rt.device.kv, data.rt.userId, id, on);
    setToast(jt(on ? 'explore.toast.added' : 'explore.toast.removed'));
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
  const sheetOpen = selected !== null;
  // The list fills the space under the header; without 3D it is the only view.
  const listMode = !q && (!canMap || view === 'list');

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-brand-lavender" data-glass={lite ? 'lite' : undefined} data-testid="map-home">
      <ScreenTracker />
      <h1 className="sr-only">{jt('map.title')}</h1>

      {/* The world */}
      {showMap && (
        <>
          <WorldCanvas
            states={states}
            coreGrowth={coreGrowth(data.discover.doneCount)}
            careers={islets}
            onSelectCareer={(g, career) => {
              track('map_career');
              router.push(`/journey/${g}/${career}`);
            }}
            selected={selected}
            onSelect={select}
            view={camera}
            quality={quality}
            reducedMotion={r.reducedMotion}
            labels={labels}
            positions={data.journey.positions as Partial<Record<GroupId, readonly [number, number]>>}
            arrange={arrange}
            stations={plan.length}
            onMove={(id, x, z) => {
              void setIslandPosition(data.rt.device.kv, data.rt.userId, id, x, z).then(onChanged);
            }}
            onError={r.reportFailure}
          />
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {GROUP_ORDER.filter((id) => states[id].visible !== false).map((id) => {
              const s = states[id];
              const isSel = selected === id;
              return (
                <button
                  key={id}
                  ref={register(`island:${id}`)}
                  onClick={() => select(id)}
                  style={{ visibility: 'hidden' }}
                  aria-label={name(id)}
                  aria-pressed={isSel}
                  data-testid={`map-island-${id}`}
                  className={cn(
                    'glass pointer-events-auto absolute left-0 top-0 whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-bold after:absolute after:-inset-x-1 after:-inset-y-3 after:content-[""] transition-colors',
                    isSel ? 'z-20 !border-primary !bg-primary text-white' : s.relation === 'suggested' ? 'z-10 ring-2 ring-brand-violet-soft' : s.relation === 'other' && 'opacity-70',
                  )}
                >
                  {shortName(id)}
                </button>
              );
            })}
            {!arrange &&
              Object.entries(islets).flatMap(([g, list]) =>
                (list ?? []).map((c) => {
                  const career = careers.find((x) => x.id === c.id);
                  return (
                    <Link
                      key={`c-${c.id}`}
                      ref={register(`career:${c.id}`)}
                      href={`/journey/${g}/${c.id}`}
                      style={{ visibility: 'hidden' }}
                      data-testid={`map-career-${c.id}`}
                      className={cn(
                        'glass pointer-events-auto absolute left-0 top-0 max-w-28 truncate whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        c.state === 'selected' ? '!bg-brand-orange-soft' : c.state === 'reached' ? 'text-primary' : 'opacity-90',
                      )}
                    >
                      {c.state === 'selected' ? '⭐ ' : c.state === 'reached' ? '✓ ' : ''}
                      {career ? career.name[locale].split(/ \(| \/ /)[0] : c.id}
                    </Link>
                  );
                }),
              )}
            {!arrange && <NextStation data={data} register={register} />}
            <button
              ref={register('core')}
              onClick={() => select('core')}
              style={{ visibility: 'hidden' }}
              aria-label={jt('map.myIsland')}
              aria-pressed={selected === 'core'}
              data-testid="map-core"
              className={cn(
                'glass pointer-events-auto absolute left-0 top-0 z-20 flex items-center gap-1.5 whitespace-nowrap rounded-full !border-2 px-3 py-1 text-[13px] font-bold after:absolute after:-inset-x-1 after:-inset-y-3 after:content-[""]',
                selected === 'core' ? '!border-primary !bg-primary text-white' : '!border-brand-orange-soft',
              )}
            >
              <span className="size-2 rounded-full bg-brand-orange-soft" aria-hidden />
              {data.rt.profile.displayName || jt('explore.me')}
            </button>
            {GROUP_ORDER.filter((id) => states[id].visible !== false && states[id].bridge === 'updating').map((id) => (
              <span
                key={`b-${id}`}
                ref={register(`bridge:${id}`)}
                style={{ visibility: 'hidden' }}
                className="glass absolute left-0 top-0 flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium text-primary"
              >
                <span className="size-1.5 animate-pulse rounded-full bg-brand-violet-soft" />
                {jt('explore.updating')}
              </span>
            ))}
          </div>
        </>
      )}

      {/* Glass header: logo, then search, map/list, saved and profile */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 mx-auto flex max-w-3xl flex-col gap-2 px-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <div className="flex items-center gap-2">
          <Link href="/journey" aria-label={jt('map.title')} className="glass pointer-events-auto flex h-12 items-center gap-2 rounded-full ps-2 pe-4" onClick={() => setSelected(null)}>
            <LogoMark className="h-9" />
            <span className="text-base font-bold">{jt('map.brand')}</span>
          </Link>
          <div className="flex-1" />
          <div className="glass pointer-events-auto flex items-center gap-0.5 rounded-full p-1">
            <GlassIcon
              label={jt('explore.search')}
              pressed={searching}
              onClick={() => {
                if (!searching) track('map_search');
                setSearching((v) => !v);
                setQuery('');
                setArrange(false);
              }}
              testId="map-search"
            >
              <Search className="size-5" aria-hidden />
            </GlassIcon>
            {canMap && (
              <GlassIcon
                label={jt(view === 'map' ? 'explore.view.list' : 'explore.view.map')}
                onClick={() => {
                  if (view === 'map') track('map_list');
                  setView((v) => (v === 'map' ? 'list' : 'map'));
                  setArrange(false);
                }}
                testId={view === 'map' ? 'view-list' : 'view-map'}
              >
                {view === 'map' ? <List className="size-5" aria-hidden /> : <MapIcon className="size-5" aria-hidden />}
              </GlassIcon>
            )}
            <Link href="/journey/saved" aria-label={jt('nav.saved')} title={jt('nav.saved')} className="grid size-10 place-items-center rounded-full hover:bg-white/60" data-testid="map-saved">
              <Bookmark className="size-5" aria-hidden />
            </Link>
            <AccountButton glass />
          </div>
        </div>

        {searching && (
          <label className="glass pointer-events-auto flex h-12 items-center gap-2 rounded-2xl px-4 focus-within:ring-2 focus-within:ring-ring/50">
            <Search className="size-5 opacity-60" aria-hidden />
            <input
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={jt('explore.search')}
              aria-label={jt('explore.search')}
              className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-brand-ink/50"
              data-testid="explore-search"
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label={jt('explore.clear')} className="-me-3 grid size-11 place-items-center rounded-full opacity-70 hover:opacity-100">
                <X className="size-4" />
              </button>
            )}
          </label>
        )}

        {showMap && !searching && !sheetOpen && <Legend stage={stage} arrange={arrange} />}
        {showMap && hint && !searching && !sheetOpen && !arrange && (
          <div className="glass pointer-events-auto flex items-center gap-2 self-center rounded-full py-1.5 ps-3 pe-1 text-sm font-medium" role="note" data-testid="map-hint">
            <Hand className="size-4 shrink-0 text-primary" aria-hidden />
            {jt('map.hint')}
            <button type="button" onClick={dismissHint} aria-label={jt('map.hintClose')} className="grid size-8 place-items-center rounded-full hover:bg-white/60">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        )}
      </header>

      {/* Search results and the list view: a glass panel under the header */}
      {(matches || listMode) && (
        <div className={cn('absolute inset-x-0 bottom-0 z-20 mx-auto max-w-3xl px-3', searching ? 'top-[calc(max(env(safe-area-inset-top),0.75rem)+7.25rem)]' : 'top-[calc(max(env(safe-area-inset-top),0.75rem)+4rem)]')}>
          <div className="glass-strong h-full overflow-y-auto rounded-t-3xl p-4 pb-48" data-testid={matches ? 'explore-results' : 'explore-list'}>
            {matches ? (
              <>
                {matches.groups.length === 0 && matches.jobs.length === 0 && <p className="rounded-2xl bg-card/70 p-4 text-sm">{jt('explore.noResults')}</p>}
                {matches.groups.length > 0 && (
                  <ul className="space-y-2">
                    {matches.groups.map((id) => (
                      <IslandRow key={id} id={id} state={states[id]} name={name(id)} careers={careersOf(id).length} onOpen={() => (setSearching(false), setQuery(''), setSelected(id))} />
                    ))}
                  </ul>
                )}
                {matches.jobs.length > 0 && (
                  <>
                    <h2 className="mb-2 mt-4 text-sm font-semibold opacity-70">{jt('explore.careersFound')}</h2>
                    <ul className="space-y-2">
                      {matches.jobs.map((c) => (
                        <li key={c.id}>
                          <Link href={`/careers/${c.id}`} className="flex items-center gap-3 rounded-2xl bg-card/80 p-3 shadow-sm hover:shadow-md">
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
              </>
            ) : (
              <>
                {!canMap && r.ready && <p className="mb-3 rounded-2xl bg-card/70 p-3 text-sm">{jt('explore.noMap')}</p>}
                <ul className="mb-5 space-y-2">
                  <MyIslandRow data={data} onOpen={() => setSelected('core')} />
                </ul>
                {onMapIds.length > 0 && (
                  <>
                    <h2 className="mb-2 text-sm font-semibold opacity-70">{jt('explore.onMap')}</h2>
                    <ul className="mb-5 space-y-2">
                      {onMapIds.map((id) => (
                        <IslandRow key={id} id={id} state={states[id]} name={name(id)} careers={careersOf(id).length} onOpen={() => setSelected(id)} />
                      ))}
                    </ul>
                  </>
                )}
                <h2 className="mb-2 text-sm font-semibold opacity-70">{jt(stage === 'none' && !onMapIds.length ? 'explore.allFields' : 'explore.moreFields')}</h2>
                <ul className="space-y-2">
                  {ordered
                    .filter((id) => states[id].visible === false)
                    .map((id) => (
                      <IslandRow key={id} id={id} state={states[id]} name={name(id)} careers={careersOf(id).length} onOpen={() => setSelected(id)} />
                    ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div role="status" className="glass absolute inset-x-0 top-[calc(max(env(safe-area-inset-top),0.75rem)+4.5rem)] z-40 mx-auto flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-medium">
          <span className="grid size-5 place-items-center rounded-full bg-brand-success text-white">
            <Check className="size-3.5" aria-hidden />
          </span>
          {toast}
        </div>
      )}

      {/* Camera and arrange controls, on the map only */}
      {showMap && !sheetOpen && (
        <div className="pointer-events-none absolute bottom-[calc(max(env(safe-area-inset-bottom),1rem)+8.5rem)] end-3 z-30 flex flex-col gap-2" data-testid="map-controls">
          <div className="glass pointer-events-auto flex flex-col rounded-full p-1">
            <GlassIcon label={jt('map.controls.in')} onClick={() => press('in')} testId="zoom-in">
              <Plus className="size-5" aria-hidden />
            </GlassIcon>
            <GlassIcon label={jt('map.controls.out')} onClick={() => press('out')} testId="zoom-out">
              <Minus className="size-5" aria-hidden />
            </GlassIcon>
            <GlassIcon
              label={jt('map.controls.home')}
              onClick={() => {
                setSelected(null);
                press('home');
              }}
              testId="zoom-home"
            >
              <LocateFixed className="size-5" aria-hidden />
            </GlassIcon>
          </div>
          {onMapIds.length > 0 && (
            <div className="glass pointer-events-auto rounded-full p-1">
              <GlassIcon label={jt(arrange ? 'explore.arrangeDone' : 'explore.arrange')} pressed={arrange} onClick={() => (arrange || track('map_arrange'), setArrange((v) => !v))} testId="arrange-map">
                <Move className="size-5" aria-hidden />
              </GlassIcon>
            </div>
          )}
        </div>
      )}

      {/* Everything else one tap away: my island, results, my careers, all fields */}
      {!sheetOpen && !arrange && !matches && (
        <QuickDock
          data={data}
          listMode={listMode}
          onIsland={() => select('core')}
          onFields={() => {
            setView(listMode && canMap ? 'map' : 'list');
            setSearching(false);
          }}
        />
      )}

      {/* The next step, always one tap away */}
      {!sheetOpen && !arrange && !matches && (
        <NextStepPill
          step={step}
          plan={plan}
          name={name}
          onExplore={() => {
            setView(canMap ? 'list' : view);
            setSearching(false);
          }}
        />
      )}

      {selected === 'core' && <CoreSheet data={data} onClose={() => setSelected(null)} />}
      {group && (
        <IslandSheet
          id={group}
          state={states[group]}
          data={data}
          name={name(group)}
          saved={saved.includes(group)}
          onMap={states[group].visible !== false}
          canAdd={data.preview.stage !== 'none'}
          onClose={() => setSelected(null)}
          onToggle={(on) => void toggleOnMap(group, on)}
          onSave={(on) => void setList('saved', group, on, on ? jt('explore.toast.saved') : undefined)}
        />
      )}
    </div>
  );
}

function GlassIcon({ label, onClick, pressed, testId, children }: { label: string; onClick: () => void; pressed?: boolean; testId?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn('grid size-10 place-items-center rounded-full outline-none hover:bg-white/60 focus-visible:ring-[3px] focus-visible:ring-ring/50', pressed && 'bg-primary text-white hover:bg-primary')}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

/**
 * The next Discover task as one labelled pin on my island's rim (finished tasks already show as the
 * island growing, so they need no marks). Nothing once Discover is done.
 */
function NextStation({ data, register }: { data: JourneyData; register: (key: string) => (el: HTMLElement | null) => void }) {
  const jt = useJT();
  const nf = useNumberFormat();
  const status = data.discover;
  const n = data.open ? (status.next ?? status.optional.findIndex((o, i) => o && !status.done[i]) + 1) : 0;
  if (!n) return null;
  return (
    <Link
      ref={register(`station:${n}`)}
      href={`/journey/me?task=${n}`}
      style={{ visibility: 'hidden' }}
      aria-label={`${jt('task', { n: nf.format(n) })} · ${jt(`taskTitles.${n}`)}`}
      data-testid={`station-${n}`}
      className="pointer-events-auto absolute left-0 top-0 z-10 isolate flex items-center gap-1.5 whitespace-nowrap rounded-full bg-brand-orange-soft py-1 ps-1 pe-3 text-xs font-bold text-brand-plum shadow-[0_4px_14px_rgba(41,17,55,0.25)] ring-4 ring-white/70 after:absolute after:-inset-2 after:content-['']"
    >
      {/* A soft halo pulses behind the pin; the label itself stays solid and readable. */}
      <span aria-hidden className="absolute inset-0 -z-10 rounded-full bg-brand-orange-soft/70 motion-safe:animate-ping" />
      <span className="grid size-6 place-items-center rounded-full bg-white text-[11px] tabular-nums">{nf.format(n)}</span>
      {jt(`taskTitles.${n}`)}
    </Link>
  );
}

/** The map's shortcuts: my island, my results, my careers, and all fields (list or map). */
function QuickDock({ data, listMode, onIsland, onFields }: { data: JourneyData; listMode: boolean; onIsland: () => void; onFields: () => void }) {
  const jt = useJT();
  const mine = (data.journey.selectedCareers?.length ?? 0) + Object.values(data.journey.careers ?? {}).filter((c) => c.result).length;
  const chip = 'glass pointer-events-auto flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';
  return (
    <nav aria-label={jt('map.dock.label')} className="pointer-events-none absolute inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),1rem)+4.5rem)] z-30 mx-auto max-w-md px-4" data-testid="map-dock">
      <ul className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        <li>
          <button type="button" onClick={() => (track('dock_island'), onIsland())} className={chip} data-testid="dock-island">
            🏝️ {jt('map.dock.island')}
          </button>
        </li>
        {data.hasResult && (
          <li>
            <Link href="/assessment/result" onClick={() => track('dock_results')} className={chip} data-testid="dock-results">
              📊 {jt('map.dock.results')}
            </Link>
          </li>
        )}
        {mine > 0 && (
          <li>
            <Link href="/journey/me#my-careers" onClick={() => track('dock_careers')} className={chip} data-testid="dock-careers">
              ⭐ {jt('map.dock.careers')}
            </Link>
          </li>
        )}
        <li>
          <button type="button" onClick={() => (track('dock_fields'), onFields())} className={chip} data-testid="dock-fields">
            {listMode ? '🗺️' : '🧭'} {jt(listMode ? 'map.dock.map' : 'map.dock.fields')}
          </button>
        </li>
      </ul>
    </nav>
  );
}

function NextStepPill({ step, plan, name, onExplore }: { step: NextStep; plan: ReturnType<typeof discoverPlan>; name: (id: GroupId) => string; onExplore: () => void }) {
  const jt = useJT();
  const nf = useNumberFormat();
  const locale = useLocale() as 'ar' | 'en';
  const href = nextStepHref(step);
  let eyebrow: string;
  let text: string;
  switch (step.kind) {
    case 'task': {
      const task = plan[step.n - 1];
      eyebrow = jt(step.first ? 'map.next.start' : 'map.next.continue');
      text = `${jt('task', { n: nf.format(step.n) })} · ${task ? jt(`taskTitles.${task.n}`) : ''}`;
      break;
    }
    case 'field':
      eyebrow = jt(step.started ? 'map.next.continue' : 'map.next.check');
      text = jt('map.next.field', { field: name(step.id) });
      break;
    case 'career':
      eyebrow = jt(step.started ? 'map.next.continue' : 'map.next.try');
      text = careers.find((c) => c.id === step.id)?.name[locale] ?? step.id;
      break;
    default:
      eyebrow = jt('map.next.more');
      text = jt('map.next.explore');
  }
  const body = (
    <>
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-white shadow-md shadow-primary/30">
        <Sparkles className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-start">
        <span className="block text-xs font-semibold text-primary">{eyebrow}</span>
        <span className="block truncate font-bold">{text}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-primary rtl:rotate-180" aria-hidden />
    </>
  );
  const cls = 'glass pointer-events-auto flex w-full items-center gap-3 rounded-full p-2 pe-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 mx-auto max-w-md px-4 pb-[max(env(safe-area-inset-bottom),1rem)]" data-testid="next-step" data-kind={step.kind}>
      {href ? (
        <Link href={href} onClick={() => track('next_pill')} className={cls}>
          {body}
        </Link>
      ) : (
        <button type="button" onClick={() => (track('next_pill'), onExplore())} className={cls}>
          {body}
        </button>
      )}
    </div>
  );
}

function Sheet({ label, onClose, testId, children }: { label: string; onClose: () => void; testId: string; children: ReactNode }) {
  const jt = useJT();
  return (
    <section aria-label={label} className="glass-strong absolute inset-x-0 bottom-0 z-30 mx-auto max-h-[78%] max-w-2xl overflow-y-auto rounded-t-[2rem] p-5 pb-[max(env(safe-area-inset-bottom),1.5rem)]" data-testid={testId}>
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-brand-ink/15" aria-hidden />
      <button onClick={onClose} aria-label={jt('explore.close')} className="absolute end-3 top-3 grid size-11 place-items-center rounded-full hover:bg-white/60">
        <X className="size-5" />
      </button>
      {children}
    </section>
  );
}

/** My island's sheet: Discover progress, the next station and the way into the full page. */
function CoreSheet({ data, onClose }: { data: JourneyData; onClose: () => void }) {
  const jt = useJT();
  const nf = useNumberFormat();
  const status = data.discover;
  const next = data.open ? status.next : null;
  const title = data.rt.profile.displayName ? jt('home.hello', { name: data.rt.profile.displayName }) : jt('title');
  return (
    <Sheet label={jt('map.myIsland')} onClose={onClose} testId="core-sheet">
      {data.rt.profile.displayName && <p className="text-xs font-semibold text-primary">{jt('map.myIsland')}</p>}
      <h2 className="pe-10 text-2xl font-bold">{title}</h2>
      <p className="mt-1 text-sm opacity-75">{jt('map.coreIntro')}</p>
      <div className="mt-4 space-y-1">
        <ProgressBar value={status.doneCount} max={status.required} label={jt('home.discoverTitle')} />
        <p className="text-xs tabular-nums opacity-75">{jt('progress', { done: nf.format(status.doneCount), total: nf.format(status.required) })}</p>
      </div>
      <div className="mt-5 grid gap-2">
        {next !== null && (
          <Button asChild size="lg" data-testid="core-continue">
            <Link href={`/journey/me?task=${next}`}>
              {jt(status.doneCount === 0 ? 'map.next.start' : 'map.next.continue')}: {jt('task', { n: nf.format(next) })} · {jt(`taskTitles.${next}`)}
              <ChevronRight className="size-5 rtl:rotate-180" aria-hidden />
            </Link>
          </Button>
        )}
        <Button asChild size="lg" variant={next !== null ? 'outline' : 'default'} data-testid="core-open">
          <Link href="/journey/me">{jt('map.openMyIsland')}</Link>
        </Button>
        {data.hasResult && (
          <Link href="/assessment/result" className="tap-link justify-center">
            {jt('myProfile')}
          </Link>
        )}
      </div>
    </Sheet>
  );
}

function MyIslandRow({ data, onOpen }: { data: JourneyData; onOpen: () => void }) {
  const jt = useJT();
  const nf = useNumberFormat();
  return (
    <li>
      <button onClick={onOpen} className="flex w-full items-center gap-3 rounded-2xl border-2 border-brand-orange-soft bg-card/85 p-4 text-start shadow-sm transition-shadow hover:shadow-md" data-testid="list-core">
        <LogoMark className="h-8 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block font-bold">{jt('map.myIsland')}</span>
          <span className="block text-xs text-muted-foreground">{jt('progress', { done: nf.format(data.discover.doneCount), total: nf.format(data.discover.required) })}</span>
        </span>
        <ChevronRight className="size-4 text-primary rtl:rotate-180" aria-hidden />
      </button>
    </li>
  );
}

function IslandRow({ id, state, name, careers: count, onOpen }: { id: GroupId; state: IslandState; name: string; careers: number; onOpen: () => void }) {
  const jt = useJT();
  return (
    <li>
      <button onClick={onOpen} className="flex w-full items-center gap-3 rounded-2xl bg-card/85 p-4 text-start shadow-sm transition-shadow hover:shadow-md" data-testid={`list-island-${id}`}>
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

function Legend({ stage, arrange }: { stage: 'none' | 'early' | 'suggested'; arrange: boolean }) {
  const jt = useJT();
  // Only fields on the map are drawn, so there are no broken bridges to explain.
  const items: readonly (readonly [Relation | 'updating', boolean])[] =
    stage === 'suggested'
      ? [
          ['suggested', false],
          ['added', false],
        ]
      : stage === 'early'
        ? [['updating', true]]
        : [];
  if (!items.length && !arrange && stage !== 'none') return null;
  return (
    <div className="glass pointer-events-auto max-w-[75%] rounded-2xl px-3 py-2" data-testid="legend">
      {stage === 'none' && !arrange && <p className="text-xs font-medium">{jt('explore.onlyMe')}</p>}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {items.map(([k, broken]) => (
            <div key={k} className="flex items-center gap-2">
              <BridgeSwatch relation={k === 'updating' ? 'neutral' : k} broken={broken} />
              <span className="text-xs font-bold">{jt(`explore.legend.${k}`)}</span>
            </div>
          ))}
        </div>
      )}
      {arrange && <p className="text-xs font-medium text-primary">{jt('explore.arrangeHint')}</p>}
    </div>
  );
}

function IslandSheet({
  id,
  state,
  data,
  name,
  saved,
  onMap,
  canAdd,
  onClose,
  onToggle,
  onSave,
}: {
  id: GroupId;
  state: IslandState;
  data: JourneyData;
  name: string;
  saved: boolean;
  /** On the user's map (a suggestion, added or started). */
  onMap: boolean;
  /** Fields can be added once the first suggestions exist. */
  canAdd: boolean;
  onClose: () => void;
  onToggle: (on: boolean) => void;
  onSave: (on: boolean) => void;
}) {
  const jt = useJT();
  const locale = useLocale() as 'ar' | 'en';
  const list = careers.filter((c) => c.cluster === id);
  const hasPath = Boolean(pathById(id));
  const checked = Boolean(data.journey.paths[id]?.result);
  const canVerify = hasPath && data.preview.stage === 'suggested';
  const color = state.relation === 'added' ? 'var(--brand-orange-soft)' : state.relation === 'suggested' ? 'var(--brand-violet)' : '#E2B66E';

  return (
    <Sheet label={name} onClose={onClose} testId="island-sheet">
      <div className="flex items-start gap-3 pe-10">
        <IslandArtwork id={id} className="size-20 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-primary">{jt(`explore.status.${state.relation}`)}</p>
          <h2 className="text-2xl font-bold">{name}</h2>
          <p className="mt-1 text-sm opacity-75">{jt(`explore.sheet.${state.relation}`)}</p>
        </div>
      </div>

      {hasPath && state.relation !== 'other' && state.relation !== 'neutral' && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs opacity-75">
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

      <div className="mt-5 grid gap-2">
        {canVerify ? (
          <Button asChild size="lg" data-testid="sheet-explore">
            <Link href={`/journey/${id}`}>
              {jt(checked ? 'map.openIsland' : state.done > 0 ? 'explore.actions.continue' : 'explore.actions.explore')}
              <ChevronRight className="size-5 rtl:rotate-180" aria-hidden />
            </Link>
          </Button>
        ) : (
          <p className="flex gap-2 rounded-xl bg-secondary/80 p-3 text-sm text-secondary-foreground" data-testid="sheet-not-ready">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            {hasPath ? jt('verify.notReady') : jt('reward.verifySoon')}
          </p>
        )}
        <div className="flex gap-2">
          {!onMap && canAdd && (
            <Button variant="accent" className="flex-1" onClick={() => onToggle(true)} data-testid="sheet-add">
              {jt('explore.actions.add')}
            </Button>
          )}
          <Button variant="outline" className="flex-1" onClick={() => onSave(!saved)} aria-pressed={saved} data-testid="sheet-save">
            {saved ? <BookmarkCheck className="size-5" aria-hidden /> : <Bookmark className="size-5" aria-hidden />}
            {jt(saved ? 'explore.actions.unsave' : 'explore.actions.save')}
          </Button>
        </div>
      </div>

      {list.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-semibold">{jt('explore.careers', { count: list.length })}</h3>
          {checked && <p className="-mt-1 mb-2 text-xs opacity-75">{jt('explore.careersOpen')}</p>}
          <ul className="flex flex-wrap gap-2">
            {list.map((c) => (
              <li key={c.id}>
                {/* Once the path is checked, each career opens its own island (L2). */}
                <Link
                  href={checked ? `/journey/${id}/${c.id}` : `/careers/${c.id}`}
                  className={cn(
                    'inline-flex min-h-11 items-center gap-1.5 rounded-full border bg-white/70 px-4 text-sm font-medium hover:border-primary hover:text-primary',
                    checked && careerState(data.journey, c.id) === 'selected' ? 'border-brand-orange-soft' : 'border-white/80',
                  )}
                  data-testid="sheet-career"
                >
                  {checked && careerState(data.journey, c.id) === 'selected' ? '⭐' : checked && careerState(data.journey, c.id) === 'reached' ? '✓' : null}
                  {c.name[locale]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 space-y-4">
        <FieldIntro id={id} />
        <FieldDetails id={id} />
      </div>
      {onMap && (
        <button onClick={() => onToggle(false)} className="tap-link mt-3 w-full justify-center opacity-70" data-testid="sheet-remove">
          {jt('explore.actions.remove')}
        </button>
      )}
    </Sheet>
  );
}
