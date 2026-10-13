'use client';

import type { I18n } from '@anabokra/engine';
import { Frown, Meh, Smile } from 'lucide-react';

import { choiceBase, choiceIdle, choiceOn, useNumberFormat } from '@/features/assessment/primitives';
import { SwipeCard } from '@/features/assessment/swipe-card';
import { SWIPE_VALUE } from '@/features/assessment/swipe';
import { useAT, useText } from '@/features/assessment/ui-context';
import { cn } from '@/lib/utils';

import type { Scale } from './steps';
import { useJT } from './use-jt';

/**
 * The question formats of Discover and Verify (docs/product/discover-verify.md §3). Validated
 * questions keep their 1–5 scale and only change how they look; the path formats are our own.
 */

const card = 'rounded-3xl bg-card p-5 text-card-foreground shadow-sm ring-1 ring-border/70';
const big = 'text-xl font-semibold leading-snug sm:text-2xl';

interface Answerable {
  value?: number;
  onAnswer: (value: number) => void;
  disabled?: boolean;
}

/** Interests: swipe the card (left 2, right 4, up 5) or tap 1–5. */
export function SwipeQuestion({ text, scale, value, onAnswer, disabled }: Answerable & { text: I18n; scale: Scale }) {
  const at = useAT();
  const tx = useText();
  const labels = scale.labels.map(tx);
  const nf = useNumberFormat();
  return (
    <div className="flex flex-col gap-4" data-testid="q-swipe">
      <p className="text-sm text-muted-foreground">{at('prompts.interests')}</p>
      <SwipeCard ariaLabel={tx(text)} hintFor={(v) => labels[v - scale.min] ?? ''} onSwipe={(v) => onAnswer(v)} disabled={disabled}>
        {tx(text)}
      </SwipeCard>
      <p className="text-xs text-muted-foreground">
        {at('swipe.help', { left: labels[SWIPE_VALUE.left - scale.min]!, right: labels[SWIPE_VALUE.right - scale.min]!, up: labels[SWIPE_VALUE.up - scale.min]! })}
      </p>
      <div className="grid grid-cols-5 gap-1.5" role="group" aria-label={at('swipe.buttonsLabel')}>
        {labels.map((label, i) => {
          const v = scale.min + i;
          return (
            <button
              key={v}
              type="button"
              disabled={disabled}
              aria-pressed={value === v}
              onClick={() => onAnswer(v)}
              className={cn(choiceBase, 'h-full min-h-16 flex-col gap-0.5 px-1 text-center text-xs leading-tight', value === v ? choiceOn : choiceIdle)}
            >
              <span className="text-base font-semibold tabular-nums">{nf.format(v)}</span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const FACES = ['😣', '🙁', '😐', '🙂', '😄'];

/** Personality: five faces from "not me at all" to "so me". */
export function FacesQuestion({ text, scale, value, onAnswer, disabled, prompt }: Answerable & { text: I18n; scale: Scale; prompt?: string }) {
  const at = useAT();
  const tx = useText();
  return (
    <fieldset className="flex flex-col gap-4" data-testid="q-faces" disabled={disabled}>
      <legend className="mb-2 text-sm text-muted-foreground">{prompt ?? at('prompts.personality')}</legend>
      <p className={cn(card, big)}>{tx(text)}</p>
      <div className="grid grid-cols-5 gap-1.5">
        {scale.labels.map((label, i) => {
          const v = scale.min + i;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={value === v}
              onClick={() => onAnswer(v)}
              className={cn(choiceBase, 'h-full min-h-20 flex-col gap-1 px-1 text-center text-xs leading-tight', value === v ? choiceOn : choiceIdle)}
            >
              <span aria-hidden="true" className="text-2xl">
                {FACES[i] ?? '•'}
              </span>
              <span>{tx(label)}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Strengths: a five-step bar, filled up to the chosen step. */
export function SliderQuestion({ text, scale, value, onAnswer, disabled }: Answerable & { text: I18n; scale: Scale }) {
  const at = useAT();
  const tx = useText();
  const steps = scale.labels.map((_, i) => scale.min + i);
  return (
    <fieldset className="flex flex-col gap-4" data-testid="q-slider" disabled={disabled}>
      <legend className="mb-2 text-sm text-muted-foreground">{at('prompts.abilities')}</legend>
      <p className={cn(card, big)}>{tx(text)}</p>
      <div className="flex gap-1">
        {steps.map((v, i) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            aria-label={tx(scale.labels[i]!)}
            onClick={() => onAnswer(v)}
            className={cn(
              'h-12 flex-1 rounded-md border transition-colors first:rounded-s-xl last:rounded-e-xl',
              value !== undefined && v <= value ? 'border-primary bg-primary' : 'bg-muted hover:bg-accent',
            )}
          />
        ))}
      </div>
      <div className="flex justify-between gap-4 text-xs text-muted-foreground">
        <span className="max-w-[45%] text-start">
          {tx(scale.labels[0]!)}
        </span>
        <span className="max-w-[45%] text-end">
          {tx(scale.labels[scale.labels.length - 1]!)}
        </span>
      </div>
      <p className="min-h-5 text-center text-sm font-medium" aria-live="polite">
        {value !== undefined ? tx(scale.labels[value - scale.min]!) : ''}
      </p>
    </fieldset>
  );
}

const row = 'flex min-h-14 w-full items-center gap-4 rounded-2xl px-4 py-3 text-start text-base font-semibold transition-colors active:scale-[0.99] disabled:opacity-60';
const TONE = {
  violet: 'bg-secondary text-foreground hover:bg-primary/15',
  lilac: 'bg-secondary/55 text-foreground hover:bg-primary/15',
  orange: 'bg-brand-orange-soft/20 text-foreground hover:bg-brand-orange-soft/35',
};
const ON = 'bg-primary text-primary-foreground shadow-md shadow-primary/25';

/** Empty or filled answer circle, as in a radio list. */
function Dot({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true" className={cn('flex size-7 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-current' : 'border-foreground/45')}>
      {on && <span className="size-3 rounded-full bg-current" />}
    </span>
  );
}

/** Three answers as rows, the warmest first, each with a face. Values are 1 (low) to 3 (high). */
function ThreeWay({ prompt, keys, value, onAnswer, disabled, testId }: Answerable & { prompt: string; keys: string; testId: string }) {
  const jt = useJT();
  const rows = [
    { v: 3, Icon: Smile, tone: TONE.violet },
    { v: 2, Icon: Meh, tone: TONE.lilac },
    { v: 1, Icon: Frown, tone: TONE.orange },
  ];
  return (
    <fieldset className="flex flex-col gap-2.5" data-testid={testId} disabled={disabled}>
      <legend className="mb-3 text-base font-bold text-foreground">{prompt}</legend>
      {rows.map(({ v, Icon, tone }) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onAnswer(v)} className={cn(row, value === v ? ON : tone)}>
          <Icon aria-hidden="true" className="size-7 shrink-0" strokeWidth={1.6} />
          <span>{jt(`${keys}.${v}`)}</span>
        </button>
      ))}
    </fieldset>
  );
}

/** The scene or situation under the heading: the main line without an item title, a lead-in with one. */
function Body({ text, titled }: { text: I18n; titled?: boolean }) {
  const tx = useText();
  return <p className={titled ? 'text-lg leading-relaxed text-muted-foreground' : 'text-xl font-semibold leading-snug text-foreground'}>{tx(text)}</p>;
}

/** "A day as…": a moment from the path; not for me / OK / sounds great. */
export function StoryQuestion({ text, titled, ...rest }: Answerable & { text: I18n; titled?: boolean }) {
  const jt = useJT();
  return (
    <div className="flex flex-col gap-5">
      <Body text={text} titled={titled} />
      <ThreeWay {...rest} prompt={jt('story.prompt')} keys="story" testId="q-story" />
    </div>
  );
}

/** "Did you enjoy that?" after each "Try it" item. */
export function EnjoyQuestion(props: Answerable) {
  const jt = useJT();
  return <ThreeWay {...props} prompt={jt('enjoy.prompt')} keys="enjoy" testId="q-enjoy" />;
}

/** "The real deal": this or that (0 = a, 1 = b), side by side. */
export function ChoiceQuestion({ a, b, value, onAnswer, disabled }: Answerable & { a: I18n; b: I18n }) {
  const jt = useJT();
  const tx = useText();
  const option = (v: 0 | 1, text: I18n, tone: string) => (
    <button
      type="button"
      aria-pressed={value === v}
      onClick={() => onAnswer(v)}
      className={cn('flex min-h-44 flex-col items-center justify-between gap-4 rounded-2xl p-4 text-center text-base font-semibold leading-snug transition-colors active:scale-[0.99]', value === v ? ON : tone)}
    >
      <span className="flex flex-1 items-center">{tx(text)}</span>
      <Dot on={value === v} />
    </button>
  );
  return (
    <fieldset className="flex flex-col" data-testid="q-choice" disabled={disabled}>
      <legend className="mb-3 text-base font-bold text-foreground">{jt('choice.prompt')}</legend>
      <div className="grid grid-cols-2 gap-3">
        {option(0, a, TONE.violet)}
        {option(1, b, TONE.orange)}
      </div>
    </fieldset>
  );
}

/** "Try it": a work situation with ways to respond. */
export function ScenarioQuestion({ text, titled, options, value, onAnswer, disabled }: Answerable & { text: I18n; titled?: boolean; options: I18n[] }) {
  const jt = useJT();
  const tx = useText();
  return (
    <div className="flex flex-col gap-5">
      <Body text={text} titled={titled} />
      <fieldset className="flex flex-col gap-2.5" data-testid="q-scenario" disabled={disabled}>
        <legend className="mb-3 text-base font-bold text-foreground">{jt('scenario.prompt')}</legend>
        {options.map((o, i) => (
          <button key={i} type="button" aria-pressed={value === i} onClick={() => onAnswer(i)} className={cn(row, 'justify-between', value === i ? ON : TONE.violet)}>
            <span>{tx(o)}</span>
            <Dot on={value === i} />
          </button>
        ))}
      </fieldset>
    </div>
  );
}

/** "Try it": a small puzzle. After an answer it shows the right one and why; there is no mark. */
export function PuzzleQuestion({
  text,
  options,
  answer,
  explain,
  titled,
  value,
  onAnswer,
}: Answerable & { text: I18n; titled?: boolean; options: I18n[]; answer: number; explain: I18n }) {
  const jt = useJT();
  const tx = useText();
  const revealed = value !== undefined;
  return (
    <div className="flex flex-col gap-4" data-testid="q-puzzle">
      <Body text={text} titled={titled} />
      <div className="grid grid-cols-2 gap-2.5">
        {options.map((o, i) => (
          <button
            key={i}
            type="button"
            disabled={revealed}
            aria-pressed={value === i}
            onClick={() => onAnswer(i)}
            className={cn(
              'min-h-14 rounded-2xl px-3 py-3 text-base font-semibold transition-colors',
              revealed && i === answer ? ON : revealed && value === i ? 'bg-muted text-muted-foreground line-through' : revealed ? 'bg-muted/60 text-muted-foreground' : TONE.violet,
            )}
          >
            {tx(o)}
          </button>
        ))}
      </div>
      {revealed && (
        <div role="status" className="rounded-2xl bg-brand-orange-soft/20 p-4 text-sm text-foreground" data-testid="puzzle-feedback">
          <p className="font-semibold">{value === answer ? jt('puzzle.right') : jt('puzzle.wrong', { answer: tx(options[answer]!) })}</p>
          <p className="mt-1">{tx(explain)}</p>
        </div>
      )}
    </div>
  );
}
