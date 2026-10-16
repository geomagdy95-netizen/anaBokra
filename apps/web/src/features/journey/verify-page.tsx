'use client';

import { careerById, clusters, pathById, type PathContent } from '@anabokra/content';
import type { I18n } from '@anabokra/engine';
import { Bookmark, BookmarkCheck, ChevronRight, X } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { pathArt } from '@/features/art/task-art';
import { TaskArt } from '@/features/art/task-art-view';
import { ProgressBar, useNumberFormat } from '@/features/assessment/primitives';
import { useText } from '@/features/assessment/ui-context';
import { ValuesStation } from '@/features/assessment/values-station';
import type { ValuesPayload } from '@/features/assessment/types';
import { Link } from '@/i18n/navigation';
import { maybeFinalize, type JourneyData } from '@/lib/journey/journey';
import { beatDone, storyDone, storyPlan } from '@/lib/journey/story-plan';
import { readJourney, saveVerifyAnswer, saveVerifyResult, scoreVerify, setInList, VERIFY_BANDS, type VerifyResult } from '@/lib/journey/verify';
import { cn } from '@/lib/utils';
import { stationPayload } from '@/server/assessment/station-payload';

import { AppShell } from './app-shell';
import { BAND_ICON, BAND_TONE, HeroCard, HeroPills, HeroText, PromptCard } from './cards';
import { JourneyGate } from './journey-gate';
import { LocalLoading } from '@/features/local/local-states';
import { PathStory } from './path-story';
import { RatingCard } from './rating-card';
import { useJT } from './use-jt';
import { ValueBudget } from './value-budget';

/**
 * Verify a path (docs/product/discover-verify.md §5), in one go: "build your dream job" the first time
 * (values, asked once), then "a day in their shoes" (the path as a chat, path-story.tsx), then
 * "fits well / partly / worth rethinking" with reasons and the path's careers ranked.
 */
export function VerifyPage({ pathId }: { pathId: string }) {
  return <JourneyGate>{(data, reload) => <Verify data={data} pathId={pathId} onChanged={reload} />}</JourneyGate>;
}

type Running = 'values' | 'story' | null;

function Verify({ data, pathId, onChanged }: { data: JourneyData; pathId: string; onChanged: () => void }) {
  const jt = useJT();
  const tx = useText();
  const nf = useNumberFormat();
  const path = pathById(pathId);
  const group = clusters.find((c) => c.id === pathId);
  const rec = data.journey.paths[pathId];
  const answers = rec?.answers ?? {};
  const [running, setRunning] = useState<Running>(null);
  const [showResult, setShowResult] = useState(Boolean(rec?.result));
  // Values finished in this run, before the reload that would say so.
  const [valuesJustDone, setValuesJustDone] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [failed, setFailed] = useState(false);
  const finishingRef = useRef(false);
  const groupName = group ? tx(group.name) : pathId;

  const frame = (testId: string, children: ReactNode, extra?: Record<string, string>, subtitle = jt('verify.eyebrow')) => (
    <AppShell tab="explore" title={groupName} subtitle={subtitle} testId={testId}>
      <div className="flex flex-col gap-5" {...extra}>
        {children}
      </div>
    </AppShell>
  );

  if (!path || data.preview.stage !== 'suggested')
    return frame(
      'verify-unavailable',
      <>
        <p className="rounded-2xl bg-secondary p-4 text-sm">{!path ? jt('verify.noContent') : jt('verify.notReady')}</p>
        {path && (
          <Button asChild>
            <Link href="/journey/me">{jt('verify.toDiscover')}</Link>
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href="/journey">{jt('backToMap')}</Link>
        </Button>
      </>,
    );

  const beats = storyPlan(path);
  const valuesReady = data.valuesDone || valuesJustDone;
  const needsValues = !valuesReady && data.open;

  /** Scores the path and saves the result; `show` opens it, otherwise it just stays up to date. */
  const finish = async (given: Record<string, number>, show: boolean) => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    setFailed(false);
    try {
      const groupFit = data.preview.groups.find((g) => g.cluster === pathId)?.fit ?? 0;
      const result = scoreVerify(path, given, { groupFit, careerFits: data.preview.fits });
      await saveVerifyResult(data.rt.device.kv, data.rt.userId, result);
      await maybeFinalize(data);
      if (show) setShowResult(true);
    } catch {
      setFailed(true);
    } finally {
      finishingRef.current = false;
      setFinishing(false);
      onChanged();
    }
  };

  /**
   * After the story: once it's answered the result is made right away (shown when the story was just
   * finished, refreshed quietly when an answered path was changed). Answers are read fresh, since the
   * ones on screen are from before the story.
   */
  const afterStory = async (completed: boolean) => {
    setRunning(null);
    const fresh = (await readJourney(data.rt.device.kv, data.rt.userId).catch(() => null))?.paths[pathId]?.answers;
    const ready = fresh && valuesReady && storyDone(path, fresh);
    if (ready && (completed || rec?.result)) await finish(fresh, completed);
    else onChanged();
  };

  if (running === 'values') {
    const done = () => {
      setValuesJustDone(true);
      setRunning('story');
      onChanged();
    };
    const close = () => {
      setRunning(null);
      onChanged();
    };
    return data.formats.values === 'cards' ? <ValuesTask data={data} onDone={done} onClose={close} /> : <ValueBudget data={data} onDone={done} onClose={close} />;
  }
  if (running === 'story')
    return (
      <PathStory
        title={jt('day.title', { path: groupName })}
        pathId={pathId}
        beats={beats}
        initial={answers}
        onAnswer={async (itemId, value) => {
          try {
            await saveVerifyAnswer(data.rt.device.kv, data.rt.userId, pathId, itemId, value);
            return true;
          } catch {
            return false;
          }
        }}
        onDone={() => void afterStory(true)}
        onClose={() => void afterStory(false)}
      />
    );

  if (showResult && rec?.result)
    return frame(
      'verify-result-page',
      <Result
        path={path}
        result={rec.result}
        onAgain={() => {
          setShowResult(false);
          setRunning('story');
        }}
        rating={<RatingCard data={data} onChanged={onChanged} />}
        saved={Boolean(data.journey.saved?.includes(pathId))}
        onSave={async (on) => {
          await setInList(data.rt.device.kv, data.rt.userId, 'saved', pathId, on);
          onChanged();
        }}
      />,
      { 'data-band': rec.result.band },
      jt('verify.resultEyebrow'),
    );

  const answered = beats.filter((b) => beatDone(b, answers)).length;
  const allDone = valuesReady && answered === beats.length;

  return frame(
    'verify',
    <>
      <HeroCard art={<TaskArt chain={pathArt(pathId)} className="absolute inset-0" />} title={jt('day.title', { path: groupName })}>
          <HeroText>{jt('day.intro')}</HeroText>
          <HeroPills items={[`⏱️ ${jt('day.minutes', { min: nf.format(needsValues ? 4 : 3) })}`, `💬 ${jt('day.beats', { count: nf.format(beats.length) })}`, `✨ ${jt('day.noWrong')}`]} />
          {needsValues && (
            <p className="rounded-2xl bg-accent p-3 text-sm" data-testid="verify-values-first">
              🪙 {jt(data.formats.values === 'cards' ? 'day.valuesFirstCards' : 'day.valuesFirst')}
            </p>
          )}
          {answered > 0 && !allDone && (
            <div className="flex items-center gap-2">
              <ProgressBar value={answered} max={beats.length} label={jt('day.title', { path: groupName })} />
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{jt('day.progress', { done: nf.format(answered), total: nf.format(beats.length) })}</span>
            </div>
          )}
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {jt('verify.resultFailed')}
            </p>
          )}
          {allDone && !rec?.result ? (
            <Button size="lg" className="h-14 rounded-2xl text-base" onClick={() => void finish(answers, true)} disabled={finishing} data-testid="verify-result">
              {jt('verify.result')}
            </Button>
          ) : (
            <Button size="lg" className="h-14 rounded-2xl text-base" onClick={() => setRunning(needsValues ? 'values' : 'story')} data-testid="verify-start">
              {jt(answered > 0 && !allDone ? 'day.continue' : 'day.start')}
            </Button>
          )}
          {rec?.result && (
            <Button variant="outline" onClick={() => setShowResult(true)} data-testid="verify-last-result">
              {jt('day.lastResult')}
            </Button>
          )}
      </HeroCard>
    </>,
  );
}

/**
 * "What you need from work": the values card sort, asked once and reused for every path. Only for
 * sessions on the card format (started before the dream job budget).
 */
function ValuesTask({ data, onDone, onClose }: { data: JourneyData; onDone: () => void; onClose: () => void }) {
  const jt = useJT();
  const [state, setState] = useState<{ answers: Record<string, number>; ranking: string[] } | null>(null);
  useEffect(() => {
    let alive = true;
    void data.rt.service.getResume(data.rt.userId, { sessionId: data.sessionId }).then((r) => {
      if (!alive) return;
      setState({ answers: Object.fromEntries(r.responses.filter((x) => x.instrumentId === 'values').map((x) => [x.itemId, x.value])), ranking: r.valuesRanking });
    });
    return () => {
      alive = false;
    };
  }, [data]);
  if (!state) return <LocalLoading />;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-6" data-testid="values-task">
      <div className="relative -mx-4 -mt-6 h-52 shrink-0 overflow-hidden rounded-b-3xl">
        <TaskArt chain={['tasks/values/cover']} className="absolute inset-0" />
      </div>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{jt('verify.values')}</h1>
          <p className="text-xs text-muted-foreground">{jt('verify.valuesIntro')}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label={jt('back')}>
          <X className="size-5" />
        </Button>
      </header>
      <ValuesStation
        payload={stationPayload('values') as ValuesPayload}
        answers={state.answers}
        initialRanking={state.ranking}
        onAnswer={(cardId, weight, ms) => {
          // The card sort is controlled: it moves on only once its answers include this card.
          setState((s) => s && { ...s, answers: { ...s.answers, [cardId]: weight } });
          void data.rt.service.saveResponses(data.rt.userId, { sessionId: data.sessionId, station: 'values', responses: [{ itemId: cardId, value: weight, ms }] });
        }}
        onFinish={async (ranking) => {
          await data.rt.service.completeStation(data.rt.userId, { sessionId: data.sessionId, station: 'values', valuesRanking: ranking });
          onDone();
        }}
      />
    </main>
  );
}


/** A 0–1 part of the fit in three words-and-dots levels, cut where the bands are (no numbers shown). */
const levelOf = (x: number): 1 | 2 | 3 => (x >= VERIFY_BANDS.fitsWell ? 3 : x >= VERIFY_BANDS.fitsPartly ? 2 : 1);

/** How many careers are shown before "see all". */
const TOP_CAREERS = 3;

/**
 * The path result: the band and the three things behind it (Discover answers, what was enjoyed, the
 * trade-offs), the careers that suit best, then what you'd enjoy and what to keep in mind. Bands and
 * levels in words, never numbers (docs/product/guidance-rules.md §1).
 */
export function Result({
  path,
  result,
  onAgain,
  rating,
  saved = false,
  onSave,
}: {
  path: PathContent;
  result: VerifyResult;
  onAgain: () => void;
  rating: ReactNode;
  /** The path is in the user's Saved list; `onSave` adds or removes it. */
  saved?: boolean;
  onSave?: (on: boolean) => Promise<void>;
}) {
  const jt = useJT();
  const tx = useText();
  const nf = useNumberFormat();
  const locale = useLocale();
  const [allCareers, setAllCareers] = useState(false);
  const list = new Intl.ListFormat(locale, { style: 'narrow', type: 'conjunction' });
  const items = new Map(path.tasks.flatMap((t) => t.items.map((i) => [i.id, i] as const)));
  const story = (id: string) => tx((items.get(id) as { text: I18n }).text);
  const choice = (id: string) => items.get(id) as { a: I18n; b: I18n; path: 'a' | 'b'; careers?: string[] };
  const pathSide = (id: string) => {
    const c = choice(id);
    return tx(c.path === 'a' ? c.a : c.b);
  };
  const otherSide = (id: string) => {
    const c = choice(id);
    return tx(c.path === 'a' ? c.b : c.a);
  };
  const careerName = (id: string) => {
    const c = careerById(id);
    return c ? tx(c.name) : id;
  };
  const signals = (['profile', 'activities', 'realities'] as const).map((k) => ({ key: k, level: levelOf(result.components[k]) }));
  const careersShown = allCareers ? result.careers : result.careers.slice(0, TOP_CAREERS);
  const top = result.careers[0];
  const [saving, setSaving] = useState(false);

  return (
    <>
      <HeroCard tone={BAND_TONE[result.band]} icon={BAND_ICON[result.band]} title={jt(`verify.bands.${result.band}`)} titleTestId="verify-band">
        <HeroText>{jt(`verify.bandText.${result.band}`)}</HeroText>

        <h3 className="mt-2 text-sm font-semibold">{jt('verify.why')}</h3>
        <ul className="mt-2 flex flex-col gap-2" data-testid="verify-signals">
          {signals.map(({ key, level }) => (
            <li key={key} className="flex items-center gap-3 rounded-2xl bg-card/80 px-3 py-2.5" data-signal={key} data-level={level}>
              <span aria-hidden="true" className="text-xl">
                {key === 'profile' ? '🏝️' : key === 'activities' ? '😍' : '⚖️'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{jt(`verify.signal.${key}.name`)}</span>
                <span className="block text-xs text-muted-foreground">{jt(`verify.signal.${key}.${level}`)}</span>
              </span>
              <span className="flex shrink-0 gap-1" aria-hidden="true">
                {[1, 2, 3].map((d) => (
                  <span key={d} className={cn('size-2.5 rounded-full', d <= level ? 'bg-primary' : 'bg-primary/15')} />
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs opacity-70">{jt('verify.mix')}</p>
      </HeroCard>

      <section>
        <h3 className="text-base font-bold">{jt('verify.careers')}</h3>
        <ol className="mt-2 flex flex-col gap-2" data-testid="verify-careers">
          {careersShown.map((c, i) => {
            const level = levelOf(c.fit);
            return (
              <li key={c.careerId}>
                <Link
                  href={`/journey/${path.id}/${c.careerId}`}
                  className={cn('flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm ring-1 transition-shadow hover:shadow-md', i === 0 ? 'ring-primary/40' : 'ring-border/70')}
                  data-testid="verify-career"
                >
                  <span
                    className={cn(
                      'grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums',
                      i < TOP_CAREERS ? 'bg-primary text-primary-foreground' : 'bg-secondary text-primary',
                    )}
                  >
                    {nf.format(i + 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{careerName(c.careerId)}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1" data-level={level}>
                        <span className="flex gap-0.5" aria-hidden="true">
                          {[1, 2, 3].map((d) => (
                            <span key={d} className={cn('size-1.5 rounded-full', d <= level ? 'bg-primary' : 'bg-primary/20')} />
                          ))}
                        </span>
                        {jt(`verify.careerLevel.${level}`)}
                      </span>
                      {c.cautions.length > 0 && <span className="text-amber-700 dark:text-amber-300">{jt('verify.cautions', { count: c.cautions.length })}</span>}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-primary rtl:rotate-180" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ol>
        {result.careers.length > TOP_CAREERS && (
          <button type="button" className="tap-link mt-2 text-sm" onClick={() => setAllCareers((v) => !v)} data-testid="verify-all-careers">
            {allCareers ? jt('verify.fewerCareers') : jt('verify.allCareers', { count: nf.format(result.careers.length) })}
          </button>
        )}
      </section>

      {result.enjoyed.length > 0 && (
        <section>
          <h3 className="text-base font-bold">{jt('verify.enjoyed')}</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {result.enjoyed.map((id) => (
              <li key={id} className="flex gap-2 rounded-2xl bg-primary/5 p-3 text-sm">
                <span aria-hidden="true">😍</span>
                <span>{story(id)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.accepted.length > 0 && (
        <section>
          <h3 className="text-base font-bold">{jt('verify.accepted')}</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {result.accepted.map((id) => (
              <li key={id} className="rounded-full bg-secondary px-3 py-1.5 text-sm">
                ✓ {pathSide(id)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.turnedDown.length > 0 && (
        <section data-testid="verify-keep">
          <h3 className="text-base font-bold">{jt('verify.keep')}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{jt('verify.keepHint')}</p>
          <ul className="mt-2 flex flex-col gap-2">
            {result.turnedDown.map((id) => {
              const c = choice(id);
              return (
                <li key={id} className="rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border/70">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl bg-primary/10 p-2.5">
                      <p className="text-xs font-semibold text-primary">{jt('verify.youPrefer')}</p>
                      <p className="mt-0.5 font-semibold">{otherSide(id)}</p>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-2.5 dark:bg-amber-950/30">
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">{jt('verify.pathMeans')}</p>
                      <p className="mt-0.5">{pathSide(id)}</p>
                    </div>
                  </div>
                  {c.careers?.length ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {jt('verify.common', {
                        list: `${list.format(c.careers.slice(0, 3).map(careerName))}${c.careers.length > 3 ? ` ${jt('verify.more', { n: nf.format(c.careers.length - 3) })}` : ''}`,
                      })}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <PromptCard tone="lavender" icon="🧭" title={jt('verify.next.title')} testId="verify-next">
        <div className="flex flex-col gap-2">
          {top && (
            <Button asChild size="lg" className="h-12 justify-between rounded-2xl">
              <Link href={`/journey/${path.id}/${top.careerId}`} data-testid="verify-visit-career">
                {jt('verify.next.visit', { career: careerName(top.careerId) })}
                <ChevronRight className="size-5 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </Button>
          )}
          {onSave && (
            <Button
              size="lg"
              variant="outline"
              className="h-12 justify-between rounded-2xl bg-card"
              aria-pressed={saved}
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onSave(!saved);
                } finally {
                  setSaving(false);
                }
              }}
              data-testid="verify-save"
            >
              {saved ? jt('verify.next.saved') : jt('verify.next.save')}
              {saved ? <BookmarkCheck className="size-5" aria-hidden="true" /> : <Bookmark className="size-5" aria-hidden="true" />}
            </Button>
          )}
          <Button asChild size="lg" variant="outline" className="h-12 justify-between rounded-2xl bg-card">
            <Link href="/journey">
              {jt('verify.other')}
              <ChevronRight className="size-5 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </PromptCard>

      {rating}

      <p className="text-xs text-muted-foreground">{jt('verify.disclaimer')}</p>
      <button type="button" className="tap-link self-start text-sm" onClick={onAgain} data-testid="verify-again">
        {jt('verify.again')}
      </button>
    </>
  );
}
