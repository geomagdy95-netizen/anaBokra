'use client';

import { STAGES, STUDY_FIELDS } from '@anabokra/engine';
import { useLocale } from 'next-intl';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

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
/** Year of study: 1–6, and 7 for "7 or later" (medicine runs longer). */
export const YEARS = [1, 2, 3, 4, 5, 6, 7] as const;
/** Graduation years offered: this year and the 8 before (the app is for 18–25). */
export const gradYears = (now = new Date()) => Array.from({ length: 9 }, (_, i) => now.getFullYear() - i);

/** Answers that belong to one stage only; picking another stage clears them. */
const STAGE_ONLY = {
  school: ['curriculum', 'track', 'expectedScorePct'],
  university: ['field', 'year'],
  graduate: ['field', 'gradYear'],
} as const satisfies Record<(typeof STAGES)[number], readonly Field[]>;

export interface ContextValues {
  stage?: string | null;
  field?: string | null;
  year?: number | null;
  gradYear?: number | null;
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

const fieldCls = 'h-11 w-full rounded-lg border border-input bg-background px-3 text-base text-start outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/**
 * D7: a short, friendly form. First the stage (school, university, graduate); then school questions
 * (curriculum, track, expected score) or study questions (field, year of study or of graduation);
 * then budget and governorate. Every question is optional and saved as you go; "Finish" waits for
 * the save, then completes the station.
 */
export function ContextForm({ sessionId, initial, onFinish }: { sessionId: string; initial: ContextValues; onFinish: () => void }) {
  const at = useAT();
  const nf = useNumberFormat();
  const locale = useLocale();
  // Years read as "2025", not "2,025".
  const yf = useMemo(() => new Intl.NumberFormat(locale, { useGrouping: false }), [locale]);
  const ids = {
    field: useId(),
    year: useId(),
    curriculum: useId(),
    track: useId(),
    score: useId(),
    governorate: useId(),
    scoreErr: useId(),
  };
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

  const onStage = (value: (typeof STAGES)[number]) => {
    const next = values.stage === value ? null : value;
    set('stage', next);
    // Clear answers that belong to another stage (or to any stage, when unselecting).
    const keep = new Set<Field>(next ? STAGE_ONLY[next] : []);
    for (const f of new Set(Object.values(STAGE_ONLY).flat())) {
      if (!keep.has(f) && values[f] != null) set(f, null);
    }
    if (!keep.has('expectedScorePct')) {
      setScoreText('');
      setScoreError(false);
    }
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

  const stage = values.stage;
  const studying = stage === 'university' || stage === 'graduate';
  const tracksVisible = stage === 'school' && values.curriculum === 'thanaweya';
  const budgetKey = studying ? 'budgetMore' : 'budget';

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

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-base font-medium">{at('context.stage.q')}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {STAGES.map((st) => (
            <button
              key={st}
              type="button"
              aria-pressed={stage === st}
              onClick={() => onStage(st)}
              className={cn(choiceBase, 'py-3', stage === st ? choiceOn : choiceIdle)}
              data-testid={`stage-${st}`}
            >
              {at(`context.stage.${st}`)}
            </button>
          ))}
        </div>
      </fieldset>

      {studying && (
        <>
          <div className="flex flex-col gap-2">
            <label htmlFor={ids.field} className="text-base font-medium">
              {at(stage === 'graduate' ? 'context.field.qPast' : 'context.field.q')}
            </label>
            <select
              id={ids.field}
              className={fieldCls}
              value={values.field ?? ''}
              onChange={(e) => set('field', e.target.value || null)}
              data-testid="study-field"
            >
              <option value="">{at('context.choose')}</option>
              {STUDY_FIELDS.map((f) => (
                <option key={f} value={f}>
                  {at(`context.field.${f}`)}
                </option>
              ))}
            </select>
          </div>

          {stage === 'university' ? (
            <div className="flex flex-col gap-2">
              <label htmlFor={ids.year} className="text-base font-medium">
                {at('context.year.q')}
              </label>
              <select
                id={ids.year}
                className={fieldCls}
                value={values.year ?? ''}
                onChange={(e) => set('year', e.target.value ? Number(e.target.value) : null)}
                data-testid="study-year"
              >
                <option value="">{at('context.choose')}</option>
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {at(y === 7 ? 'context.year.later' : 'context.year.n', {
                      n: nf.format(y),
                    })}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label htmlFor={ids.year} className="text-base font-medium">
                {at('context.gradYear.q')}
              </label>
              <select
                id={ids.year}
                className={fieldCls}
                value={values.gradYear ?? ''}
                onChange={(e) => set('gradYear', e.target.value ? Number(e.target.value) : null)}
                data-testid="grad-year"
              >
                <option value="">{at('context.choose')}</option>
                {gradYears().map((y) => (
                  <option key={y} value={y}>
                    {yf.format(y)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {stage === 'school' && (
        <>
          <div className="flex flex-col gap-2">
            <label htmlFor={ids.curriculum} className="text-base font-medium">
              {at('context.curriculum.q')}
            </label>
            <select id={ids.curriculum} className={fieldCls} value={values.curriculum ?? ''} onChange={(e) => onCurriculum(e.target.value)}>
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
              <select id={ids.track} className={fieldCls} value={values.track ?? ''} onChange={(e) => set('track', e.target.value || null)}>
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
                className={cn(fieldCls, 'max-w-32 text-center tabular-nums', scoreError && 'border-destructive')}
                value={scoreText}
                aria-invalid={scoreError}
                aria-describedby={scoreError ? ids.scoreErr : undefined}
                onChange={(e) => onScore(e.target.value)}
              />
              <span aria-hidden="true">%</span>
            </div>
            <p id={ids.scoreErr} role={scoreError ? 'alert' : undefined} className={cn('text-sm text-destructive', !scoreError && 'hidden')}>
              {at('context.score.error', {
                min: nf.format(0),
                max: nf.format(100),
              })}
            </p>
          </div>
        </>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-base font-medium">{at(`context.${budgetKey}.q`)}</legend>
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
              <span className="text-xs font-normal">{at(`context.${budgetKey}.${b}Hint`)}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor={ids.governorate} className="text-base font-medium">
          {at('context.governorate.q')}
        </label>
        <select id={ids.governorate} className={fieldCls} value={values.governorate ?? ''} onChange={(e) => set('governorate', e.target.value || null)}>
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
