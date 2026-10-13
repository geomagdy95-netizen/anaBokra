'use client';

import { useLocale, useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

import { useRenderer } from '../path/capabilities';
import { BridgeSwatch } from './bridge-swatch';
import { ProfileSheet } from './profile-sheet';
import { addToMap, profileFor, scenarioCoreGrowth, scenarioStates } from './scenarios';
import { GROUP_ORDER, SCENARIOS, type GroupId, type GroupInfo, type IslandState, type Relation, type Scenario, type Selection } from './types';
import type { Quality } from './world-canvas';

// The three.js stack stays behind this dynamic import: not in the first-load bundle, never SSR'd.
const WorldCanvas = dynamic(() => import('./world-canvas'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-pulse bg-[#EFE9FB]" />,
});

const VIOLET = '#7025B5';
const PLUM = '#291137';

function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="120 66 362 460" className={className} aria-hidden>
      <path
        fill="#360847"
        d="M164.724 77.0248L445.123 126.645C462.926 130.462 471.828 141.913 471.828 160.998V464.446C471.828 479.714 464.198 487.348 448.938 487.348C436.221 487.348 429.863 479.714 429.863 464.446V185.808C429.863 170.54 421.597 164.815 405.066 168.632L246.745 210.618C226.399 215.708 216.226 226.522 216.226 243.062V378.565C216.226 397.649 226.399 409.736 246.745 414.826L394 464.446L164.724 512.158C141.834 518.52 130.389 508.977 130.389 483.531V109.469C130.389 84.0225 141.834 73.2078 164.724 77.0248Z"
      />
      <path fill="#FB9D5D" d="M408 208C253.333 208 253.333 429 408 429V208Z" />
    </svg>
  );
}

export function DevWorldClient({ groups }: { groups: GroupInfo[] }) {
  const t = useTranslations('DevWorld');
  const locale = useLocale() as 'ar' | 'en';
  const r = useRenderer();

  const [scenario, setScenario] = useState<Scenario>('after');
  const [states, setStates] = useState<Record<GroupId, IslandState>>(() => scenarioStates('after'));
  const [selected, setSelected] = useState<Selection | null>(null);
  const [view, setView] = useState<'map' | 'list'>('map');
  const [quality, setQuality] = useState<Quality | null>(null);
  const [toast, setToast] = useState(false);
  // DOM labels by anchor key; the canvas moves them every frame to follow their islands.
  const [labels] = useState(() => new Map<string, HTMLElement>());

  const byId = useMemo(() => Object.fromEntries(groups.map((g) => [g.id, g])) as Record<GroupId, GroupInfo>, [groups]);
  const name = useCallback((id: GroupId) => byId[id]?.name[locale] ?? id, [byId, locale]);
  /** Map labels use the first part of the name ("الصحة والطب" → "الصحة"), as in the reference board. */
  const shortName = useCallback((id: GroupId) => name(id).split(/ و| & /)[0]!, [name]);

  const pickScenario = (s: Scenario) => {
    setScenario(s);
    setStates(scenarioStates(s));
    setSelected(null);
  };

  const add = (id: GroupId) => {
    setStates((prev) => ({ ...prev, [id]: addToMap(prev[id]) }));
    setToast(true);
  };
  useEffect(() => {
    if (!toast) return;
    const h = window.setTimeout(() => setToast(false), 2600);
    return () => window.clearTimeout(h);
  }, [toast]);

  const canMap = r.ready && r.webgl && r.reason !== 'error';
  const effectiveQuality: Quality = quality ?? (r.reason === 'low-end' ? 'low' : 'high');
  const showMap = canMap && view === 'map';
  const results = scenario === 'after' || scenario === 'added';
  const group = selected && selected !== 'core' ? selected : null;
  const sel = group ? states[group] : null;
  const profile = useMemo(() => profileFor(scenario), [scenario]);

  const register = (key: string) => (el: HTMLElement | null) => {
    if (!el) return;
    labels.set(key, el);
    return () => {
      labels.delete(key);
    };
  };

  const ordered = useMemo(() => {
    const rank: Record<Relation, number> = { suggested: 0, added: 1, neutral: 2, other: 3 };
    return [...GROUP_ORDER].sort((a, b) => rank[states[a].relation] - rank[states[b].relation]);
  }, [states]);

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-[#EFE9FB] text-[#291137]">
      {/* Header */}
      <header className="z-20 flex flex-wrap items-center gap-3 border-b border-white/60 bg-white/80 px-4 py-3 backdrop-blur">
        <LogoMark className="h-9 w-auto" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{t(`title.${scenario}`)}</h1>
          <p className="truncate text-xs text-[#291137]/70">{t(`hint.${scenario}`)}</p>
        </div>
        <div className="flex rounded-full bg-[#F1EBFA] p-1 text-sm" role="tablist" aria-label={t('viewLabel')}>
          {(['map', 'list'] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              disabled={v === 'map' && !canMap}
              onClick={() => setView(v)}
              className={cn('min-h-9 rounded-full px-4 font-medium transition-colors', view === v ? 'bg-[#7025B5] text-white' : 'text-[#291137]/80')}
            >
              {t(`view.${v}`)}
            </button>
          ))}
        </div>
      </header>

      {/* Dev controls */}
      <div className="z-20 flex flex-wrap items-center gap-2 bg-white/60 px-4 py-2 text-sm backdrop-blur">
        <span className="text-xs font-medium text-[#291137]/60">{t('scenario')}</span>
        {SCENARIOS.map((s) => (
          <button
            key={s}
            onClick={() => pickScenario(s)}
            aria-pressed={scenario === s}
            className={cn(
              'min-h-8 rounded-full border px-3 transition-colors',
              scenario === s ? 'border-[#7025B5] bg-[#7025B5] text-white' : 'border-[#7025B5]/25 bg-white text-[#291137]',
            )}
          >
            {t(`scenarios.${s}`)}
          </button>
        ))}
        <span className="ms-auto text-xs text-[#291137]/60">{t('quality')}</span>
        {(['high', 'low'] as const).map((q) => (
          <button
            key={q}
            onClick={() => setQuality(q)}
            aria-pressed={effectiveQuality === q}
            className={cn('min-h-8 rounded-full border px-3', effectiveQuality === q ? 'border-[#291137] bg-[#291137] text-white' : 'border-[#291137]/20 bg-white')}
          >
            {t(`qualities.${q}`)}
          </button>
        ))}
      </div>

      {/* Map / list */}
      <div className="relative min-h-0 flex-1">
        {showMap ? (
          <>
            <WorldCanvas
              states={states}
              coreGrowth={scenarioCoreGrowth(scenario)}
              selected={selected}
              onSelect={setSelected}
              quality={effectiveQuality}
              reducedMotion={r.reducedMotion}
              labels={labels}
              onError={r.reportFailure}
            />
            <div className="pointer-events-none absolute inset-0 overflow-hidden" dir="auto">
              {GROUP_ORDER.map((id) => {
                const s = states[id];
                const isSel = selected === id;
                return (
                  <button
                    key={id}
                    ref={register(`island:${id}`)}
                    onClick={() => setSelected(id)}
                    style={{ visibility: 'hidden' }}
                    className={cn(
                      'pointer-events-auto absolute left-0 top-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold sm:px-3 sm:py-1 sm:text-[13px] shadow-[0_4px_14px_rgba(41,17,55,0.16)] transition-colors',
                      isSel ? 'bg-[#7025B5] text-white' : s.relation === 'other' ? 'bg-white/85 text-[#291137]/55' : 'bg-white text-[#291137]',
                    )}
                    aria-pressed={isSel}
                    aria-label={name(id)}
                  >
                    {shortName(id)}
                  </button>
                );
              })}
              <button
                ref={register('core')}
                onClick={() => setSelected('core')}
                style={{ visibility: 'hidden' }}
                aria-pressed={selected === 'core'}
                aria-label={t('profile.open')}
                className={cn(
                  'pointer-events-auto absolute left-0 top-0 flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-2.5 py-0.5 text-xs font-bold shadow-[0_4px_14px_rgba(41,17,55,0.16)] sm:px-3 sm:py-1 sm:text-[13px]',
                  selected === 'core' ? 'border-[#FFA366] bg-[#FFA366] text-[#291137]' : 'border-[#FFA366] bg-white text-[#291137]',
                )}
              >
                <span className="size-2 rounded-full bg-[#FFA366]" aria-hidden />
                {t('profile.label')}
              </button>
              {GROUP_ORDER.filter((id) => states[id].bridge === 'updating').map((id) => (
                <span
                  key={`b-${id}`}
                  ref={register(`bridge:${id}`)}
                  style={{ visibility: 'hidden' }}
                  className="absolute left-0 top-0 flex items-center gap-1 whitespace-nowrap rounded-full border border-[#9D73DB]/40 bg-white/90 px-2 py-0.5 text-[11px] font-medium text-[#7025B5]"
                >
                  <span className="size-1.5 animate-pulse rounded-full bg-[#9D73DB]" />
                  {t('updating')}
                </span>
              ))}
            </div>
          </>
        ) : (
          <ul className="h-full space-y-2 overflow-y-auto p-4 pb-36 sm:pb-40">
            {!canMap && r.ready && <li className="rounded-xl bg-white/70 p-3 text-sm">{t('noMap')}</li>}
            {ordered.map((id) => {
              const s = states[id];
              return (
                <li key={id}>
                  <button
                    onClick={() => setSelected(id)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-start shadow-sm transition-shadow hover:shadow-md"
                  >
                    <BridgeSwatch relation={s.relation} broken={s.bridge !== 'connected'} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{name(id)}</span>
                      <span className="block text-xs text-[#291137]/65">
                        {t(`status.${s.relation}`)} · {t('careers', { count: byId[id]?.careers ?? 0 })}
                      </span>
                    </span>
                    <span className="text-xs text-[#291137]/60">{t('progress', { done: s.done, total: s.total })}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Toast */}
        {toast && (
          <div role="status" className="absolute inset-x-0 top-3 z-30 mx-auto flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium shadow-lg">
            <span className="grid size-5 place-items-center rounded-full bg-[#3F9F7A] text-xs text-white">✓</span>
            {t('added')}
          </div>
        )}

        {/* Legend */}
        {!sel && (
          <div className="absolute inset-x-3 bottom-3 z-20 rounded-2xl bg-white/90 p-2.5 shadow-lg backdrop-blur sm:p-3">
            <div className="flex flex-wrap items-start gap-x-4 gap-y-1.5 sm:gap-x-6 sm:gap-y-2">
              {(results
                ? ([
                    ['suggested', false],
                    ['other', true],
                    ['added', false],
                  ] as const)
                : ([
                    ['neutral', false],
                    ['updating', true],
                  ] as const)
              ).map(([k, broken]) => (
                <div key={k} className="flex items-center gap-2 sm:min-w-[12rem] sm:flex-1 sm:gap-3">
                  <BridgeSwatch relation={k === 'updating' ? 'neutral' : k} broken={broken} />
                  <div>
                    <p className="text-xs font-bold sm:text-sm">{t(`legend.${k}.title`)}</p>
                    <p className="hidden text-xs text-[#291137]/65 sm:block">{t(`legend.${k}.text`)}</p>
                  </div>
                </div>
              ))}
            </div>
            {results && (
              <p className="mt-2 border-t border-[#291137]/10 pt-2 text-[11px] text-[#291137]/70 sm:text-xs">
                <span className="font-bold text-[#291137]">{t('disclaimer.title')}</span>{' '}
                <span className="hidden sm:inline">{t('disclaimer.text')}</span>
              </p>
            )}
          </div>
        )}

        {/* Island sheet */}
        {sel && group && (
          <section
            aria-label={name(group)}
            className="absolute inset-x-0 bottom-0 z-30 mx-auto max-w-xl rounded-t-3xl bg-white p-5 pb-6 shadow-[0_-12px_40px_rgba(41,17,55,0.18)]"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#291137]/15" aria-hidden />
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-2xl font-bold" style={{ color: PLUM }}>
                  {name(group)}
                </h2>
                <p className="mt-1 text-sm text-[#291137]/75">{t(`sheet.${sel.relation}`)}</p>
                <p className="mt-1 text-xs text-[#291137]/55">{t('careers', { count: byId[group]?.careers ?? 0 })}</p>
              </div>
              <button onClick={() => setSelected(null)} aria-label={t('close')} className="grid size-9 place-items-center rounded-full text-xl hover:bg-[#291137]/5">
                ×
              </button>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-[#291137]/65">
                <span>{t('bridge')}</span>
                <span>{t('progress', { done: sel.done, total: sel.total })}</span>
              </div>
              <div className="flex gap-1" aria-hidden>
                {Array.from({ length: sel.total }, (_, i) => (
                  <span
                    key={i}
                    className="h-2 flex-1 rounded-full"
                    style={{
                      background:
                        i < sel.done ? (sel.relation === 'added' ? '#FF9A55' : sel.relation === 'suggested' ? VIOLET : '#E2B66E') : '#EEE7F7',
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="mt-5 grid gap-2">
              {sel.relation === 'other' && (
                <button onClick={() => add(group)} className="min-h-12 rounded-2xl bg-[#FFA366] font-bold text-[#291137] shadow-sm hover:brightness-105">
                  {t('actions.add')}
                </button>
              )}
              <button className="min-h-12 rounded-2xl border-2 border-[#7025B5] font-bold text-[#7025B5] hover:bg-[#7025B5]/5">{t('actions.explore')}</button>
              {results && <button className="min-h-10 text-sm font-medium text-[#7025B5] underline-offset-4 hover:underline">{t('actions.review')}</button>}
            </div>
          </section>
        )}

        {/* Profile sheet (core island) */}
        {selected === 'core' && (
          <ProfileSheet
            profile={profile}
            states={states}
            shortName={shortName}
            onClose={() => setSelected(null)}
            onPick={(id) => setSelected(id)}
          />
        )}
      </div>
    </main>
  );
}
