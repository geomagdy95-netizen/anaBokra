'use client';

import { ArrowRight, Check, Lock, LockOpen, PauseCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

import { Card, ProgressBar, useNumberFormat } from './primitives';
import type { SaveStatus } from './save-queue';
import { estimateMinutes, stationUi } from './stations';
import { useAT } from './ui-context';

/** D1: short framing for one station. First-timers also get "how it works". */
export function StationIntro({
  station,
  items,
  firstTime,
  resuming,
  onStart,
}: {
  station: string;
  items: number;
  firstTime: boolean;
  resuming: boolean;
  onStart: () => void;
}) {
  const at = useAT();
  const nf = useNumberFormat();
  const ui = stationUi(station)!;
  const mins = estimateMinutes(ui, items);
  const how = ['1', '2', '3'];
  return (
    <div className="flex flex-col gap-5" data-testid="station-intro">
      <Card className="flex flex-col gap-3">
        <p className="text-sm font-medium text-primary">{at(`stations.${station}.eyebrow`)}</p>
        <h2 className="text-2xl font-semibold">{at(`stations.${station}.title`)}</h2>
        <p className="text-base">{at(`stations.${station}.intro`)}</p>
        <ul className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <li className="rounded-full border px-3 py-1">{at('hub.items', { n: nf.format(items) })}</li>
          <li className="rounded-full border px-3 py-1">{at('hub.minutes', { n: nf.format(mins) })}</li>
          {ui.optional && <li className="rounded-full border px-3 py-1">{at('hub.optional')}</li>}
        </ul>
        <p className="text-sm">{at(`stations.${station}.how`)}</p>
      </Card>

      {firstTime ? (
        <Card className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold">{at('intro.howTitle')}</h3>
          <ol className="flex list-decimal flex-col gap-2 ps-5 text-sm">
            {how.map((n) => (
              <li key={n}>{at(`intro.how.${n}`)}</li>
            ))}
          </ol>
        </Card>
      ) : (
        <details className="rounded-xl border bg-card p-4 text-sm">
          <summary className="cursor-pointer font-medium">{at('intro.howTitle')}</summary>
          <ol className="mt-3 flex list-decimal flex-col gap-2 ps-5">
            {how.map((n) => (
              <li key={n}>{at(`intro.how.${n}`)}</li>
            ))}
          </ol>
        </details>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={onStart} data-testid="start-station">
          {resuming ? at('intro.resume') : at('intro.start')}
        </Button>
        <Button asChild variant="ghost" size="lg">
          <Link href="/assessment">{at('intro.backToMap')}</Link>
        </Button>
      </div>
    </div>
  );
}

/** D9: "come back later". Only shown after the answers have been saved (or kept on the device while offline). */
export function PausePanel({
  answered,
  total,
  overall,
  status,
  onContinue,
}: {
  answered: number;
  total: number;
  overall: { answered: number; expected: number };
  status: SaveStatus;
  onContinue: () => void;
}) {
  const at = useAT();
  const nf = useNumberFormat();
  return (
    <Card className="flex flex-col gap-4" data-testid="pause-panel">
      <div className="flex items-center gap-3">
        <PauseCircle className="size-8 text-primary" aria-hidden="true" />
        <h2 className="text-2xl font-semibold">{at('pause.title')}</h2>
      </div>
      <p role="status" data-testid="pause-status">
        {status === 'idle'
          ? at('pause.saved')
          : status === 'offline' || status === 'retrying'
            ? at('pause.savedOffline')
            : status === 'error'
              ? at('pause.error')
              : at('save.saving')}
      </p>
      <div className="flex flex-col gap-2">
        <p className="text-sm tabular-nums">{at('pause.stationProgress', { answered: nf.format(answered), total: nf.format(total) })}</p>
        <ProgressBar value={answered} max={total} label={at('pause.stationProgressLabel')} />
        <p className="text-sm tabular-nums text-muted-foreground">{at('pause.overall', { answered: nf.format(overall.answered), total: nf.format(overall.expected) })}</p>
      </div>
      <p className="text-sm text-muted-foreground">{at('pause.resumeHint')}</p>
      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg" data-testid="pause-leave">
          <Link href="/assessment">{at('pause.leave')}</Link>
        </Button>
        <Button variant="outline" size="lg" onClick={onContinue}>
          {at('pause.keepGoing')}
        </Button>
      </div>
    </Card>
  );
}

/** D10: station complete. The unlock animation is a placeholder (CSS only, off under reduced motion). */
export function StationComplete({
  station,
  next,
  onReview,
}: {
  station: string;
  next: string | null;
  /** Review answers (only offered for stations that have items to review). */
  onReview?: () => void;
}) {
  const at = useAT();
  return (
    <Card className="flex flex-col items-center gap-5 py-8 text-center" data-testid="station-complete">
      <div className="mx-auto grid size-24 place-items-center rounded-full bg-accent text-accent-foreground" aria-hidden="true" data-testid="unlock-placeholder">
        <span className="mx-unlock-lock col-start-1 row-start-1">
          <Lock className="size-10" />
        </span>
        <span className="mx-unlock-open col-start-1 row-start-1">
          <LockOpen className="size-10" />
        </span>
      </div>
      <h2 className="text-2xl font-semibold" role="status">
        <Check className="me-2 inline size-6 text-primary" aria-hidden="true" />
        {at(`stations.${station}.doneTitle`)}
      </h2>
      <p className="max-w-prose">{next ? at('complete.unlocked', { name: at(`stations.${next}.title`) }) : at('complete.all')}</p>
      <div className="flex flex-wrap justify-center gap-3">
        {next ? (
          <Button asChild size="lg" data-testid="next-station">
            <Link href={`/assessment/${next}`}>
              {at('complete.next', { name: at(`stations.${next}.title`) })}
              <ArrowRight className="rtl:rotate-180" aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <Button asChild size="lg" data-testid="see-results">
            <Link href="/assessment/result">{at('complete.results')}</Link>
          </Button>
        )}
        <Button asChild variant="outline" size="lg">
          <Link href="/assessment">{at('intro.backToMap')}</Link>
        </Button>
        {onReview && (
          <Button variant="ghost" size="lg" onClick={onReview}>
            {at('complete.review')}
          </Button>
        )}
      </div>
    </Card>
  );
}

export function FinishingPanel({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  const at = useAT();
  return (
    <Card className={cn('flex flex-col items-center gap-4 py-8 text-center')} data-testid="finishing">
      {error ? (
        <>
          <p role="alert" className="text-destructive">
            {error === 'network' ? at('finishing.offline') : at('finishing.failed')}
          </p>
          <Button onClick={onRetry}>{at('finishing.retry')}</Button>
        </>
      ) : (
        <p role="status">{at('finishing.saving')}</p>
      )}
    </Card>
  );
}
