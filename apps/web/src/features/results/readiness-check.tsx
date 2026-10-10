'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { assessmentApi } from '@/features/assessment/api';
import { useText } from '@/features/assessment/ui-context';
import type { I18n } from '@/features/assessment/types';

import { card, h2, mutedP } from './ui';
import { useRT } from './use-rt';

export interface ReadinessInstrument {
  items: { id: string; text: I18n }[];
  labels: I18n[];
  min: number;
}

/** E2: the same six statements as at the start. Taken once per result; the server ignores repeats. */
export function ReadinessCheck({
  sessionId,
  instrument,
  onDone,
  onSkip,
  save = assessmentApi.saveReadiness,
}: {
  sessionId: string;
  instrument: ReadinessInstrument;
  onDone: () => void;
  onSkip: () => void;
  save?: (sessionId: string, answers: Record<string, number>) => Promise<unknown>;
}) {
  const rt = useRT();
  const text = useText();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [state, setState] = useState<'idle' | 'saving' | 'error' | 'incomplete'>('idle');
  const complete = instrument.items.every((i) => answers[i.id] !== undefined);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complete) return setState('incomplete');
    setState('saving');
    try {
      await save(sessionId, answers);
      onDone();
    } catch {
      setState('error');
    }
  };

  return (
    <form onSubmit={submit} className={`${card} flex flex-col gap-5`} aria-labelledby="rd-h" data-testid="readiness">
      <div>
        <h2 id="rd-h" className={h2}>
          {rt('readiness.title')}
        </h2>
        <p className={mutedP}>{rt('readiness.intro')}</p>
      </div>
      {instrument.items.map((item) => (
        <fieldset key={item.id} className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">{text(item.text)}</legend>
          <div className="grid grid-cols-5 gap-1.5" role="presentation">
            {instrument.labels.map((label, i) => {
              const value = instrument.min + i;
              const checked = answers[item.id] === value;
              return (
                <label
                  key={value}
                  className={`flex min-h-12 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-center text-[0.7rem] leading-tight has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50 ${checked ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'}`}
                >
                  <input
                    type="radio"
                    name={item.id}
                    value={value}
                    checked={checked}
                    onChange={() => setAnswers((a) => ({ ...a, [item.id]: value }))}
                    className="sr-only"
                  />
                  <span className="text-base font-semibold tabular-nums" aria-hidden="true">
                    {value}
                  </span>
                  <span>{text(label)}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
      <div aria-live="polite" className="min-h-5 text-sm text-destructive" role={state === 'error' || state === 'incomplete' ? 'alert' : undefined}>
        {state === 'error' ? rt('readiness.error') : state === 'incomplete' ? rt('readiness.incomplete') : ''}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={state === 'saving'}>
          {state === 'saving' ? rt('readiness.saving') : rt('readiness.submit')}
        </Button>
        <Button type="button" variant="ghost" onClick={onSkip}>
          {rt('readiness.skip')}
        </Button>
      </div>
    </form>
  );
}
