'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

import { useRenderer, type RendererKind } from './capabilities';
import { generateWorld, REGION_ORDER } from './generate-world';
import { PRESET_IDS, PRESETS, type PresetId } from './presets';
import { PathView, ViewPlaceholder } from './path-view';
import { activeTarget, LANDMARK_INDEX, stationState } from './scene-state';
import { STATION_KINDS, type WorldProfile } from './types';

type ProfileId = PresetId | 'random';

function randomProfile(): WorldProfile {
  const r = () => Math.round(Math.random() * 100) / 100;
  return { interests: { R: r(), I: r(), A: r(), S: r(), E: r(), C: r() } };
}

const chip = 'inline-flex min-h-9 items-center rounded-full border px-3 text-sm transition-colors';

export function DevPathClient() {
  const t = useTranslations('DevPath');
  const tr = useTranslations('Riasec');
  const locale = useLocale();
  const nf = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }), [locale]);

  const [profileId, setProfileId] = useState<ProfileId>('scientist');
  const [randomScores, setRandomScores] = useState<WorldProfile>(() => PRESETS.creative);
  const [progress, setProgress] = useState(1);
  const [focus, setFocus] = useState<number | null>(null);
  const r = useRenderer();

  const profile: WorldProfile = profileId === 'random' ? randomScores : PRESETS[profileId];
  const world = useMemo(() => generateWorld(profile), [profile]);

  // FPS probe: counts rendered 3D frames. With frameloop="demand" it reads 0 when the scene is idle.
  const frames = useRef(0);
  const countFrame = useCallback(() => {
    frames.current++;
  }, []);
  const [fps, setFps] = useState<number | null>(null);
  useEffect(() => {
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      setFps(Math.round((frames.current * 1000) / (now - last)));
      frames.current = 0;
      last = now;
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  const active = activeTarget(progress, focus);
  const activeName = active >= LANDMARK_INDEX ? t('landmark') : t(`stations.${STATION_KINDS[active]!}`);
  const activeState = active >= LANDMARK_INDEX ? (progress >= LANDMARK_INDEX ? 'done' : 'locked') : stationState(active, progress);

  const pick = (id: ProfileId) => {
    if (id === 'random') setRandomScores(randomProfile());
    setProfileId(id);
    setFocus(null);
  };
  const reasonText = r.reason ? t(`reason.${r.reason}`) : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
          {t('back')}
        </Link>
        <LocaleSwitcher />
      </header>
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('intro')}</p>
      </div>

      <section aria-label={t('profile')} className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">{t('profile')}</h2>
        <div className="flex flex-wrap gap-2">
          {[...PRESET_IDS, 'random' as const].map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={profileId === id}
              onClick={() => pick(id)}
              className={cn(chip, profileId === id ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-accent')}
            >
              {t(`presets.${id}`)}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="progress" className="flex items-center justify-between text-sm font-medium">
            <span>{t('progress')}</span>
            <span className="tabular-nums text-muted-foreground">
              {nf.format(progress)} / {nf.format(4)}
            </span>
          </label>
          <input
            id="progress"
            type="range"
            min={0}
            max={4}
            step={1}
            value={progress}
            onChange={(e) => {
              setProgress(Number(e.target.value));
              setFocus(null);
            }}
            className="w-full accent-primary"
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t('renderer')}</span>
          <div role="group" aria-label={t('renderer')} className="flex gap-2">
            {(['3d', '2d'] as RendererKind[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={r.renderer === k}
                disabled={!r.ready || (k === '3d' && !r.webgl)}
                onClick={() => r.choose(k)}
                className={cn(chip, 'min-w-14 justify-center disabled:opacity-50', r.renderer === k ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-accent')}
              >
                {k === '3d' ? '3D' : '2D'}
              </button>
            ))}
          </div>
          {reasonText && <p className="text-xs text-muted-foreground">{reasonText}</p>}
        </div>
      </section>

      <div className="relative h-[68dvh] min-h-[380px] overflow-hidden rounded-xl border bg-muted">
        {r.ready ? (
          <PathView
            world={world}
            progress={progress}
            focus={focus}
            onFocus={setFocus}
            renderer={r.renderer}
            label={t('sceneLabel')}
            reducedMotion={r.reducedMotion}
            onFailure={r.reportFailure}
            onFrame={countFrame}
          />
        ) : (
          <ViewPlaceholder />
        )}
        <div className="pointer-events-none absolute bottom-2 end-2 rounded-md bg-background/80 px-2 py-1 text-xs tabular-nums text-muted-foreground">
          {r.renderer === '3d' && fps !== null ? (fps === 0 ? t('idle') : `${nf.format(fps)} ${t('fps')}`) : t('fpsNa')}
        </div>
      </div>

      <section className="flex flex-col gap-2" aria-label={t('stationsLabel')}>
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[...STATION_KINDS, 'landmark' as const].map((kind, i) => {
            const st = i >= LANDMARK_INDEX ? (progress >= LANDMARK_INDEX ? 'done' : 'locked') : stationState(i, progress);
            return (
              <li key={kind}>
                <button
                  type="button"
                  aria-pressed={active === i}
                  onClick={() => setFocus(focus === i ? null : i)}
                  className={cn('flex w-full flex-col items-start gap-0.5 rounded-lg border p-2 text-start text-sm', active === i ? 'border-primary bg-accent' : 'bg-card hover:bg-accent')}
                >
                  <span className="font-medium">
                    {nf.format(i + 1)}. {kind === 'landmark' ? t('landmark') : t(`stations.${kind}`)}
                  </span>
                  <span className="text-xs text-muted-foreground">{t(`state.${st}`)}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t('focused')}: <span className="font-medium text-foreground">{activeName}</span> ({t(`state.${activeState}`)})
        </p>
      </section>

      <section className="flex flex-col gap-2" aria-label={t('regions')}>
        <h2 className="text-sm font-medium">{t('regions')}</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {REGION_ORDER.map((id) => {
            const reg = world.regions.find((x) => x.id === id)!;
            return (
              <li key={id} className="flex items-center gap-3 rounded-lg border bg-card p-2 text-sm">
                <span className="size-4 shrink-0 rounded-sm" style={{ background: `var(--path-region-${id.toLowerCase()})` }} aria-hidden="true" />
                <span className="flex-1">{tr(id)}</span>
                <span className="tabular-nums text-muted-foreground">
                  {nf.format(reg.weight * 100)}% · {nf.format(reg.cells)}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-foreground">{t('regionsHint')}</p>
      </section>
    </main>
  );
}
