'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { assessmentApi } from './api';
import { GOVERNORATES } from './governorates';
import { choiceBase, choiceIdle, choiceOn, SaveIndicator, useNumberFormat } from './primitives';
import { SaveQueue, SaveFailure, type SaveStatus } from './save-queue';
import { useAT } from './ui-context';

export const CURRICULA = ['thanaweya', 'igcse', 'american', 'ib', 'other'] as const;
export const TRACKS = ['science', 'math', 'literary', 'other'] as const;
export const BUDGETS = ['low', 'medium', 'high'] as const;

export interface ContextValues {
  curriculum?: string | null;
  track?: string | null;
  expectedScorePct?: number | null;
  budget?: string | null;
  governorate?: string | null;
}

type Field = keyof ContextValues;
interface FieldChange {
  field: Field;
  value: string | number | null;
}

const field = 'h-11 w-full rounded-lg border border-input bg-background px-3 text-base text-start outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/**
 * D7: a short, friendly form (curriculum, track, expected score, budget, governorate). Every
 * question is optional and saved as you go; "Finish" waits for the save, then completes the station.
 */
export function ContextForm({ sessionId, initial, onFinish }: { sessionId: string; initial: ContextValues; onFinish: () => void }) {
  const at = useAT();
  const nf = useNumberFormat();
  const ids = { curriculum: useId(), track: useId(), score: useId(), governorate: useId(), scoreErr: useId() };
  const [values, setValues] = useState<ContextValues>(initial);
  const [scoreText, setScoreText] = useState(initial.expectedScorePct != null ? String(initial.expectedScorePct) : '');
  const [scoreError, setScoreError] = useState(false);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const queue = useRef<SaveQueue<FieldChange> | null>(null);

  useEffect(() => {
    const q = new SaveQueue<FieldChange>({
      keyOf: (c) => c.field,
      send: async (changes) => {
        const ctx: Record<string, unknown> = {};
        let governorate: { value: string | null } | null = null;
        for (const c of changes) {
          if (c.field === 'governorate') governorate = { value: c.value as string | null };
          else ctx[c.field] = c.value;
        }
        if (Object.keys(ctx).length) await assessmentApi.saveContext(sessionId, ctx);
        if (governorate) await assessmentApi.saveGovernorate(governorate.value);
      },
      isOnline: () => navigator.onLine,
      onStatus: setStatus,
      onFatal: (e: SaveFailure) => setFailed(Boolean(e)),
    });
    queue.current = q;
    const online = () => q.notifyOnline();
    window.addEventListener('online', online);
    return () => {
      window.removeEventListener('online', online);
      q.dispose();
    };
  }, [sessionId]);

  const set = (f: Field, value: string | number | null) => {
    setValues((v) => ({ ...v, [f]: value }));
    setTouched(true);
    queue.current?.add({ field: f, value });
  };

  const onCurriculum = (value: string) => {
    set('curriculum', value || null);
    // The track question only makes sense for Thanaweya; clear a stale answer.
    if (value !== 'thanaweya' && values.track) set('track', null);
  };

  const onScore = (raw: string) => {
    setScoreText(raw);
    const trimmed = raw.trim();
    if (trimmed === '') {
      setScoreError(false);
      set('expectedScorePct', null);
      return;
    }
    const n = Number(trimmed.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setScoreError(true);
      return;
    }
    setScoreError(false);
    set('expectedScorePct', Math.round(n * 100) / 100);
  };

  const finish = async () => {
    if (scoreError) return;
    setBusy(true);
    setFailed(false);
    try {
      await queue.current?.flush();
      onFinish();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const tracksVisible = values.curriculum === 'thanaweya';

  return (
    <form
      className="flex flex-col gap-6"
      data-testid="context-form"
      onSubmit={(e) => {
        e.preventDefault();
        void finish();
      }}
    >
      <p className="text-base">{at('context.lead')}</p>

      <div className="flex flex-col gap-2">
        <label htmlFor={ids.curriculum} className="text-base font-medium">
          {at('context.curriculum.q')}
        </label>
        <select id={ids.curriculum} className={field} value={values.curriculum ?? ''} onChange={(e) => onCurriculum(e.target.value)}>
          <option value="">{at('context.choose')}</option>
          {CURRICULA.map((c) => (
            <option key={c} value={c}>
              {at(`context.curriculum.${c}`)}
            </option>
          ))}
        </select>
      </div>

      {tracksVisible && (
        <div className="flex flex-col gap-2">
          <label htmlFor={ids.track} className="text-base font-medium">
            {at('context.track.q')}
          </label>
          <select id={ids.track} className={field} value={values.track ?? ''} onChange={(e) => set('track', e.target.value || null)}>
            <option value="">{at('context.choose')}</option>
            {TRACKS.map((t) => (
              <option key={t} value={t}>
                {at(`context.track.${t}`)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor={ids.score} className="text-base font-medium">
          {at('context.score.q')}
        </label>
        <div className="flex items-center gap-2">
          <input
            id={ids.score}
            type="text"
            inputMode="decimal"
            dir="ltr"
            autoComplete="off"
            className={cn(field, 'max-w-32 text-center tabular-nums', scoreError && 'border-destructive')}
            value={scoreText}
            aria-invalid={scoreError}
            aria-describedby={scoreError ? ids.scoreErr : undefined}
            onChange={(e) => onScore(e.target.value)}
          />
          <span aria-hidden="true">%</span>
        </div>
        <p id={ids.scoreErr} role={scoreError ? 'alert' : undefined} className={cn('text-sm text-destructive', !scoreError && 'hidden')}>
          {at('context.score.error', { min: nf.format(0), max: nf.format(100) })}
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-base font-medium">{at('context.budget.q')}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {BUDGETS.map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={values.budget === b}
              onClick={() => set('budget', values.budget === b ? null : b)}
              className={cn(choiceBase, 'flex-col py-3', values.budget === b ? choiceOn : choiceIdle)}
            >
              <span className="font-semibold">{at(`context.budget.${b}`)}</span>
              <span className="text-xs font-normal">{at(`context.budget.${b}Hint`)}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor={ids.governorate} className="text-base font-medium">
          {at('context.governorate.q')}
        </label>
        <select id={ids.governorate} className={field} value={values.governorate ?? ''} onChange={(e) => set('governorate', e.target.value || null)}>
          <option value="">{at('context.choose')}</option>
          {GOVERNORATES.map((g) => (
            <option key={g} value={g}>
              {at(`governorates.${g}`)}
            </option>
          ))}
        </select>
      </div>

      <p className="text-sm text-muted-foreground">{at('context.optional')}</p>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {at('context.failed')}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <SaveIndicator status={status} hadActivity={touched} />
        <Button type="submit" size="lg" disabled={busy || scoreError}>
          {busy ? at('context.saving') : touched ? at('context.finish') : at('context.skip')}
        </Button>
      </div>
    </form>
  );
}
