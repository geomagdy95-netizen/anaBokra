'use client';

import type { I18n } from '@anabokra/engine';
import { Check, Frown, Info, Meh, Smile } from 'lucide-react';
import { useState } from 'react';

import { choiceBase, choiceIdle, choiceOn, useNumberFormat } from '@/features/assessment/primitives';
import { SwipeCard } from '@/features/assessment/swipe-card';
import { SWIPE_VALUE } from '@/features/assessment/swipe';
import { useAT, useText } from '@/features/assessment/ui-context';
import { cn } from '@/lib/utils';

import { CHECKLIST_VALUE } from '@/server/assessment/config';

import { MoodFace } from './mood-face';
import type { ItemStep, Scale } from './steps';
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

/** "What does this mean?" under an interest card that assumes some knowledge; the wording stays as it is. */
function CardHint({ hint }: { hint: I18n }) {
  const at = useAT();
  const tx = useText();
  const [open, setOpen] = useState(false);
  return (
    <div className="-mt-1 flex flex-col items-start gap-1.5">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary" data-testid="card-hint-toggle">
        <Info className="size-4" aria-hidden />
        {at('cardHint')}
      </button>
      {open && (
        <p className="rounded-2xl bg-secondary/70 px-4 py-3 text-sm text-foreground" data-testid="card-hint">
          {tx(hint)}
        </p>
      )}
    </div>
  );
}

/** Interests: swipe the card (left 2, right 4, up 5) or tap 1–5. */
export function SwipeQuestion({ text, hint, scale, value, onAnswer, disabled }: Answerable & { text: I18n; hint?: I18n; scale: Scale }) {
  const at = useAT();
  const tx = useText();
  const labels = scale.labels.map(tx);
  const nf = useNumberFormat();
  return (
    <div className="flex flex-col gap-4" data-testid="q-swipe">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{at('prompts.interests')}</p>
        <p className="text-xs text-muted-foreground">{at('prompts.interestsImagine')}</p>
      </div>
      <SwipeCard ariaLabel={tx(text)} hintFor={(v) => labels[v - scale.min] ?? ''} onSwipe={(v) => onAnswer(v)} disabled={disabled}>
        {tx(text)}
      </SwipeCard>
      {hint && <CardHint key={tx(text)} hint={hint} />}
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

/**
 * Personality and readiness: an agreement scale drawn as a character whose face reacts, a five-stop
 * track under it and the chosen answer in words. Hovering a stop previews the face; tapping answers.
 */
export function FacesQuestion({ text, scale, value, onAnswer, disabled, prompt }: Answerable & { text: I18n; scale: Scale; prompt?: string }) {
  const at = useAT();
  const tx = useText();
  const [hover, setHover] = useState<number | undefined>();
  const steps = scale.labels.map((_, i) => scale.min + i);
  const shown = hover ?? value;
  const level = shown === undefined ? undefined : 1 + Math.round(((shown - scale.min) / (scale.max - scale.min)) * 4);
  const fill = value === undefined ? 0 : (value - scale.min) / (scale.max - scale.min);
  return (
    <fieldset className="flex flex-col gap-3" data-testid="q-faces" disabled={disabled}>
      <legend className="mb-3 text-base font-bold text-foreground">{prompt ?? at('prompts.personality')}</legend>
      <p className="text-xl font-semibold leading-snug text-foreground">{tx(text)}</p>
      <div className="flex flex-col items-center">
        <MoodFace key={level ?? 0} level={level} className="size-24 motion-safe:animate-in motion-safe:zoom-in-90 motion-safe:duration-200" />
        <p className="min-h-7 text-center text-lg font-bold text-primary" aria-live="polite">
          {shown !== undefined ? tx(scale.labels[shown - scale.min]!) : ''}
        </p>
      </div>
      <div className="relative px-1" onPointerLeave={() => setHover(undefined)}>
        <div aria-hidden="true" className="absolute inset-x-[10%] top-1/2 h-2 -translate-y-1/2 rounded-full bg-primary/15">
          <div className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-[width] duration-300 rtl:bg-gradient-to-l" style={{ width: `${fill * 100}%` }} />
        </div>
        <div className="relative grid grid-cols-5">
          {steps.map((v, i) => (
            <button
              key={v}
              type="button"
              aria-pressed={value === v}
              aria-label={tx(scale.labels[i]!)}
              onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(v)}
              onFocus={() => setHover(v)}
              onBlur={() => setHover(undefined)}
              onClick={() => onAnswer(v)}
              className="group flex h-14 items-center justify-center rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className={cn(
                  'block rounded-full border-4 transition-all duration-200',
                  value === v
                    ? 'size-9 border-primary bg-background shadow-lg shadow-primary/30'
                    : value !== undefined && v < value
                      ? 'size-5 border-primary bg-primary'
                      : 'size-5 border-primary/30 bg-card group-hover:size-7 group-hover:border-primary/60',
                )}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="-mt-1 flex justify-between gap-6 px-1 text-xs font-medium text-muted-foreground">
        <span className="max-w-[40%] text-start">{tx(scale.labels[0]!)}</span>
        <span className="max-w-[40%] text-end">{tx(scale.labels[scale.labels.length - 1]!)}</span>
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

/**
 * Interests as a checklist: the task's activity cards on one screen, tap the ones you'd enjoy.
 * "Done" saves every card at once (tapped = strongly like, left alone = strongly dislike). The
 * attention check is a card that asks to be tapped.
 */
export function GridQuestion({
  parts,
  checkId,
  answers,
  onSubmit,
  disabled,
}: {
  parts: ItemStep[];
  checkId?: string;
  answers: Readonly<Record<string, number>>;
  onSubmit: (values: Record<string, number>) => void;
  disabled?: boolean;
}) {
  const at = useAT();
  const jt = useJT();
  const tx = useText();
  const nf = useNumberFormat();
  const [on, setOn] = useState(() => new Set(parts.filter((p) => answers[p.id] === CHECKLIST_VALUE.on).map((p) => p.id)));
  const toggle = (id: string) =>
    setOn((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const count = parts.filter((p) => p.id !== checkId && on.has(p.id)).length;
  // Cards whose "what does this mean?" is open.
  const [explained, setExplained] = useState<Set<string>>(() => new Set());
  return (
    <fieldset className="flex flex-col gap-4" data-testid="q-grid" disabled={disabled}>
      <legend className="mb-1 text-base font-bold text-foreground">{jt('grid.prompt')}</legend>
      <p className="-mt-2 text-sm text-muted-foreground">{jt('grid.hint')}</p>
      <div className="grid grid-cols-2 gap-2.5">
        {parts.map((p) => {
          const picked = on.has(p.id);
          const hintOpen = explained.has(p.id);
          return (
            <div key={p.id} className="relative">
              <button
                type="button"
                aria-pressed={picked}
                onClick={() => toggle(p.id)}
                data-testid="grid-card"
                className={cn(
                  'relative flex size-full min-h-24 flex-col justify-center rounded-2xl p-3 pe-8 text-start text-sm font-semibold leading-snug transition-all active:scale-[0.97]',
                  picked ? ON : p.id === checkId ? TONE.orange : TONE.violet,
                )}
              >
                {p.id === checkId ? jt('grid.check') : tx(p.text)}
                {p.hint && hintOpen && (
                  <span className="mt-1.5 block text-xs font-normal leading-snug opacity-85" data-testid="card-hint">
                    {tx(p.hint)}
                  </span>
                )}
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute end-2 top-2 grid size-5 place-items-center rounded-full border-2 transition-colors',
                    picked ? 'border-current bg-primary-foreground text-primary' : 'border-foreground/30',
                  )}
                >
                  {picked && <Check className="size-3.5" strokeWidth={3} />}
                </span>
              </button>
              {/* A sibling, not inside the card: a button can't hold another button. */}
              {p.hint && (
                <button
                  type="button"
                  aria-expanded={hintOpen}
                  aria-label={`${at('cardHint')} ${tx(p.text)}`}
                  onClick={() => setExplained((prev) => (prev.has(p.id) ? new Set([...prev].filter((x) => x !== p.id)) : new Set(prev).add(p.id)))}
                  className={cn('absolute bottom-0.5 end-0.5 grid size-9 place-items-center rounded-full', picked ? 'text-primary-foreground' : 'text-primary')}
                  data-testid="card-hint-toggle"
                >
                  <Info className="size-4" aria-hidden />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onSubmit(Object.fromEntries(parts.map((p) => [p.id, on.has(p.id) ? CHECKLIST_VALUE.on : CHECKLIST_VALUE.off])))}
        className="h-14 rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-md shadow-primary/25 transition-transform active:scale-[0.99] disabled:opacity-60"
        data-testid="grid-done"
      >
        {count ? jt('grid.done', { count: nf.format(count) }) : jt('grid.none')}
      </button>
    </fieldset>
  );
}

/**
 * Several statements on one screen (personality, or strengths), each with its own compact 1–5 row:
 * five small faces for personality, a five-step bar for strengths. Each answer is saved as it's given.
 */
export function StackQuestion({
  parts,
  answers,
  onAnswer,
  disabled,
}: {
  parts: ItemStep[];
  answers: Readonly<Record<string, number>>;
  onAnswer: (part: ItemStep, value: number) => void;
  disabled?: boolean;
}) {
  const at = useAT();
  const tx = useText();
  const kind = parts[0]?.kind;
  return (
    <fieldset className="flex flex-col gap-3" data-testid="q-stack" disabled={disabled}>
      <legend className="mb-1 text-base font-bold text-foreground">{at(kind === 'slider' ? 'prompts.abilities' : 'prompts.personality')}</legend>
      {parts.map((p) => {
        const value = answers[p.id];
        const steps = p.scale.labels.map((_, i) => p.scale.min + i);
        return (
          <div key={p.id} className={cn(card, 'flex flex-col gap-2 p-4')} data-testid="stack-part" data-answered={value !== undefined}>
            <p className="font-semibold leading-snug">{tx(p.text)}</p>
            <div className={cn('grid grid-cols-5', p.kind === 'slider' ? 'gap-1' : 'gap-0.5')} role="group" aria-label={tx(p.text)}>
              {steps.map((v, i) =>
                p.kind === 'slider' ? (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={value === v}
                    aria-label={tx(p.scale.labels[i]!)}
                    onClick={() => onAnswer(p, v)}
                    className={cn(
                      'h-10 rounded-md border transition-colors first:rounded-s-xl last:rounded-e-xl',
                      value !== undefined && v <= value ? 'border-primary bg-primary' : 'bg-muted hover:bg-accent',
                    )}
                  />
                ) : (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={value === v}
                    aria-label={tx(p.scale.labels[i]!)}
                    onClick={() => onAnswer(p, v)}
                    className={cn(
                      'grid place-items-center rounded-xl py-1 transition-all',
                      value === v ? 'bg-primary/15 ring-2 ring-primary' : value !== undefined ? 'opacity-45 hover:opacity-80' : 'hover:bg-secondary',
                    )}
                  >
                    <MoodFace level={1 + Math.round(((v - p.scale.min) / (p.scale.max - p.scale.min)) * 4)} className="size-10" />
                  </button>
                ),
              )}
            </div>
            <div className="flex justify-between gap-4 text-xs text-muted-foreground">
              <span className="max-w-[45%] text-start">{tx(p.scale.labels[0]!)}</span>
              <span className={cn('text-center font-semibold text-primary', value === undefined && 'invisible')} aria-live="polite">
                {value !== undefined ? tx(p.scale.labels[value - p.scale.min]!) : '·'}
              </span>
              <span className="max-w-[45%] text-end">{tx(p.scale.labels[p.scale.labels.length - 1]!)}</span>
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}
