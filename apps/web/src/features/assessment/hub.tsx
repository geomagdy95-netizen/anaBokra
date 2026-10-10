'use client';

import { Check, Lock } from 'lucide-react';
import { useMemo, useState } from 'react';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

import { useRenderer } from '@/features/path/capabilities';
import { generateWorld } from '@/features/path/generate-world';
import { PathView, ViewPlaceholder } from '@/features/path/path-view';
import { LANDMARK_INDEX } from '@/features/path/scene-state';
import type { WorldProfile } from '@/features/path/types';

import { Card, FOCUS, ProgressBar, useNumberFormat } from './primitives';
import { estimateMinutes, mapProgress, STATION_UI } from './stations';
import { useAT } from './ui-context';

export interface HubStation {
  id: string;
  answered: number;
  expected: number;
  done: boolean;
}

export interface HubProps {
  stations: HubStation[];
  currentStation: string | null;
  overall: { answered: number; expected: number };
  hasResult: boolean;
}

/** The map is neutral while the test runs: no scores are revealed mid-test. */
const NEUTRAL_WORLD: WorldProfile = { interests: { R: 0.55, I: 0.5, A: 0.45, S: 0.5, E: 0.45, C: 0.5 } };

type State = 'locked' | 'current' | 'done';

/** Station map hub (/assessment): the 3D / 2D path from MX-18 plus the per-station preview cards (C3). */
export function AssessmentHub({ stations, currentStation, overall, hasResult }: HubProps) {
  const at = useAT();
  const nf = useNumberFormat();
  const r = useRenderer();
  const world = useMemo(() => generateWorld(NEUTRAL_WORLD), []);
  const [focus, setFocus] = useState<number | null>(null);

  const doneIds = stations.filter((s) => s.done).map((s) => s.id);
  const progress = mapProgress(doneIds);
  const requiredDone = progress === 4;

  const stateOf = (id: string): State => {
    const s = stations.find((x) => x.id === id)!;
    if (s.done) return 'done';
    return id === currentStation ? 'current' : 'locked';
  };

  const focusStation = focus !== null && focus < LANDMARK_INDEX ? STATION_UI.find((s) => s.mapIndex === focus) : undefined;
  const current = currentStation ? stations.find((s) => s.id === currentStation) : undefined;
  const reasonText = r.reason ? at(`map.reason.${r.reason}`) : null;
  const ctaTarget = hasResult || !currentStation ? '/assessment/result' : `/assessment/${currentStation}`;
  const ctaLabel = hasResult
    ? at('hub.seeResults')
    : !currentStation
      ? at('hub.seeResults')
      : current && current.answered > 0
        ? at('hub.continue', { name: at(`stations.${currentStation}.title`) })
        : at('hub.start', { name: at(`stations.${currentStation}.title`) });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" className={cn('rounded-sm text-sm text-primary underline-offset-4 hover:underline', FOCUS)}>
          {at('hub.home')}
        </Link>
        <LocaleSwitcher />
      </header>

      <div>
        <h1 className="text-3xl font-semibold">{at('hub.title')}</h1>
        <p className="mt-1 text-muted-foreground">{at('hub.subtitle')}</p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm tabular-nums" data-testid="overall">
          {at('hub.overall', { answered: nf.format(overall.answered), total: nf.format(overall.expected) })}
        </p>
        <ProgressBar value={overall.answered} max={overall.expected} label={at('hub.overallLabel')} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button asChild size="lg" data-testid="hub-cta">
          <Link href={ctaTarget}>{ctaLabel}</Link>
        </Button>
        {requiredDone && !hasResult && currentStation && (
          <Button asChild size="lg" variant="outline" data-testid="hub-skip-to-results">
            <Link href="/assessment/result">{at('hub.skipToResults')}</Link>
          </Button>
        )}
      </div>

      <div className="relative h-[42dvh] min-h-[300px] overflow-hidden rounded-xl border bg-muted" data-testid="path-map">
        {r.ready ? (
          <PathView
            world={world}
            progress={progress}
            focus={focus}
            onFocus={setFocus}
            renderer={r.renderer}
            label={at('map.label')}
            reducedMotion={r.reducedMotion}
            onFailure={r.reportFailure}
          />
        ) : (
          <ViewPlaceholder />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{reasonText}</span>
        {r.ready && (
          <span role="group" aria-label={at('map.view')} className="flex gap-2">
            {(['3d', '2d'] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={r.renderer === k}
                disabled={k === '3d' && !r.webgl}
                onClick={() => r.choose(k)}
                className={cn(
                  'inline-flex min-h-9 min-w-14 items-center justify-center rounded-full border px-3 text-sm disabled:opacity-60',
                  FOCUS,
                  r.renderer === k ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-card-foreground hover:bg-accent',
                )}
              >
                {k === '3d' ? '3D' : '2D'}
              </button>
            ))}
          </span>
        )}
      </div>

      {focus === LANDMARK_INDEX && (
        <p className="text-sm" aria-live="polite">
          {at('map.landmark')}
        </p>
      )}
      {focusStation && (
        <p className="text-sm" aria-live="polite">
          {at('map.focused', { name: at(`stations.${focusStation.id}.title`), state: at(`hub.state.${stateOf(focusStation.id)}`) })}
        </p>
      )}

      <section aria-label={at('hub.stationsLabel')}>
        <ol className="flex flex-col gap-3">
          {STATION_UI.map((ui) => {
            const s = stations.find((x) => x.id === ui.id);
            if (!s) return null;
            const state = stateOf(ui.id);
            const highlighted = focusStation?.id === ui.id || (focus === null && state === 'current');
            const mins = estimateMinutes(ui, s.expected);
            const actionable = state !== 'locked';
            return (
              <li key={ui.id} aria-current={state === 'current' ? 'step' : undefined}>
                <Card className={cn('flex flex-col gap-3', highlighted && 'border-primary')} data-station={ui.id} data-state={state}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold">
                        <span className="tabular-nums">{nf.format(ui.order + 1)}.</span> {at(`stations.${ui.id}.title`)}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">{at(`stations.${ui.id}.blurb`)}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium">
                      {state === 'done' && <Check className="size-3.5" aria-hidden="true" />}
                      {state === 'locked' && <Lock className="size-3.5" aria-hidden="true" />}
                      {at(`hub.state.${state}`)}
                    </span>
                  </div>
                  <ul className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <li className="rounded-full border px-2 py-0.5">{at('hub.items', { n: nf.format(s.expected) })}</li>
                    <li className="rounded-full border px-2 py-0.5">{at('hub.minutes', { n: nf.format(mins) })}</li>
                    {ui.optional && <li className="rounded-full border px-2 py-0.5">{at('hub.optional')}</li>}
                  </ul>
                  {s.answered > 0 && !s.done && (
                    <ProgressBar value={s.answered} max={s.expected} label={at('hub.stationProgressLabel', { name: at(`stations.${ui.id}.title`) })} />
                  )}
                  <div className="flex items-center gap-2">
                    {actionable ? (
                      <Button asChild variant={state === 'current' ? 'default' : 'outline'} size="sm">
                        <Link href={`/assessment/${ui.id}`} aria-label={`${at(`hub.action.${state === 'done' ? 'review' : s.answered > 0 ? 'continue' : 'start'}`)}: ${at(`stations.${ui.id}.title`)}`}>
                          {at(`hub.action.${state === 'done' ? 'review' : s.answered > 0 ? 'continue' : 'start'}`)}
                        </Link>
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">{at('hub.lockedHint')}</span>
                    )}
                    {ui.mapIndex !== null && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setFocus(focus === ui.mapIndex ? null : ui.mapIndex)} aria-pressed={focus === ui.mapIndex}>
                        {at('hub.showOnMap')}
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
