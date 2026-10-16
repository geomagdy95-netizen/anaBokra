'use client';

import { enjoyId } from '@anabokra/content';
import type { I18n } from '@anabokra/engine';
import { X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { pathArt } from '@/features/art/task-art';
import { TaskArt } from '@/features/art/task-art-view';
import { useNumberFormat } from '@/features/assessment/primitives';
import { useText } from '@/features/assessment/ui-context';
import { BEAT_TASK, beatDone, type Beat } from '@/lib/journey/story-plan';
import { cn } from '@/lib/utils';

import { useJT } from './use-jt';

const REACT = [
  { v: 3, emoji: '😍' },
  { v: 2, emoji: '🙂' },
  { v: 1, emoji: '😕' },
] as const;

export interface PathStoryProps {
  title: string;
  pathId: string;
  beats: Beat[];
  /** Answers given before; the story resumes at the first beat not fully answered. */
  initial: Record<string, number>;
  /** Saves one answer. Return false if it couldn't be saved; the beat stays open. */
  onAnswer: (itemId: string, value: number) => Promise<boolean>;
  onDone: () => void;
  onClose: () => void;
}

/**
 * Verify as a chat, "a day in their shoes" (docs/product/discover-verify.md §5.2): a guide sends the
 * path's moments, trade-offs and "Try it" items one at a time and the user answers inline: a reaction
 * to a moment, a reply to a trade-off, an option for a situation or puzzle followed by "did you enjoy
 * that?" in the same bubble. The picture at the top follows the beat. Every answer is saved as it is
 * given, so leaving midway loses nothing.
 */
export function PathStory({ title, pathId, beats, initial, onAnswer, onDone, onClose }: PathStoryProps) {
  const jt = useJT();
  const nf = useNumberFormat();
  // A story answered all the way through is played again from the start ("answer again").
  const [answers, setAnswers] = useState<Record<string, number>>(() => (beats.every((b) => beatDone(b, initial)) ? {} : initial));
  const [current, setCurrent] = useState(() => Math.max(0, beats.findIndex((b) => !beatDone(b, answers))));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [current, answers]);

  const beat = beats[current]!;
  const answered = beats.filter((b) => beatDone(b, answers)).length;

  const save = async (id: string, value: number) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const ok = await onAnswer(id, value);
    if (!ok) {
      setBusy(false);
      setFailed(true);
      return;
    }
    const next = { ...answers, [id]: value };
    setAnswers(next);
    if (beatDone(beat, next)) {
      // A beat, so the reply is seen before the next message comes in.
      await new Promise((r) => setTimeout(r, 450));
      if (current === beats.length - 1) {
        setBusy(false);
        onDone();
        return;
      }
      setCurrent(current + 1);
    }
    setBusy(false);
  };

  return (
    <main className="mx-auto flex h-dvh w-full max-w-md flex-col bg-background" data-testid="path-story">
      <div className="relative h-36 shrink-0 overflow-hidden">
        <TaskArt chain={pathArt(pathId, BEAT_TASK[beat.kind], beat.item.id)} className="absolute inset-0" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40" />
        <div className="absolute inset-x-0 top-0 flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
          <span className="min-w-0 flex-1 truncate rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-brand-ink shadow-sm backdrop-blur">{title}</span>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={jt('back')} className="shrink-0 rounded-full bg-white/90 text-brand-ink shadow-sm hover:bg-white">
            <X className="size-5" />
          </Button>
        </div>
        <div className="absolute inset-x-4 bottom-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/50" aria-hidden="true">
            <div className="h-full rounded-full bg-brand-orange transition-[width] duration-500" style={{ width: `${(answered / beats.length) * 100}%` }} />
          </div>
          <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold tabular-nums text-brand-ink" data-testid="story-progress">
            {jt('day.progress', { done: nf.format(answered), total: nf.format(beats.length) })}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-6 pt-4" aria-live="polite">
        {beats.slice(0, current + 1).map((b, i) => (
          <BeatView key={b.item.id} beat={b} answers={answers} active={i === current} busy={busy} onAnswer={(id, v) => void save(id, v)} />
        ))}
        {failed && (
          <p role="alert" className="text-sm text-destructive">
            {jt('saveFailed')}
          </p>
        )}
        <div ref={end} />
      </div>
    </main>
  );
}

/** A message from the guide (start side). */
export function Guide({ lead, title, children }: { lead: string; title?: string; children: ReactNode }) {
  return (
    <div className="flex items-end gap-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm text-primary-foreground shadow-sm">
        🧭
      </span>
      <div className="max-w-[85%] rounded-3xl rounded-es-md bg-secondary p-4 text-foreground shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{lead}</p>
        {title && <p className="mt-0.5 font-bold">{title}</p>}
        <div className="mt-1 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

/** The user's reply (end side). */
export function Reply({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-200" data-testid="story-reply">
      <p className="max-w-[80%] rounded-3xl rounded-ee-md bg-primary px-4 py-2.5 font-semibold text-primary-foreground shadow-sm">{children}</p>
    </div>
  );
}

/** Quick replies under the latest message. */
export function Choices({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap justify-end gap-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300', className)}>{children}</div>;
}

export const chip =
  'min-h-12 rounded-full border-2 border-primary/40 bg-card px-4 py-2 text-start text-sm font-semibold text-foreground shadow-sm transition-all hover:border-primary hover:bg-primary/5 active:scale-95 disabled:opacity-50';

/** 😍 / 🙂 / 😕 with the labels under `keys` (`story`, `enjoy`, or any key with 1–3). */
export function Reactions({ keys, onPick, disabled }: { keys: string; onPick: (v: number) => void; disabled: boolean }) {
  const jt = useJT();
  return (
    <Choices>
      {REACT.map(({ v, emoji }) => (
        <button key={v} type="button" className={chip} disabled={disabled} onClick={() => onPick(v)} data-testid={`react-${v}`}>
          <span aria-hidden="true" className="me-1.5 text-lg">
            {emoji}
          </span>
          {jt(`${keys}.${v}`)}
        </button>
      ))}
    </Choices>
  );
}

export function reactionText(jt: (k: string) => string, keys: string, v: number) {
  return `${REACT.find((r) => r.v === v)?.emoji ?? ''} ${jt(`${keys}.${v}`)}`;
}

function BeatView({ beat, answers, active, busy, onAnswer }: { beat: Beat; answers: Record<string, number>; active: boolean; busy: boolean; onAnswer: (id: string, v: number) => void }) {
  const jt = useJT();
  const tx = useText();
  const title = beat.item.title ? tx(beat.item.title) : undefined;
  const value = answers[beat.item.id];

  if (beat.kind === 'moment')
    return (
      <>
        <Guide lead={jt('day.lead.moment')} title={title}>
          {tx(beat.item.text)}
        </Guide>
        {value !== undefined ? <Reply>{reactionText(jt, 'story', value)}</Reply> : active && <Reactions keys="story" disabled={busy} onPick={(v) => onAnswer(beat.item.id, v)} />}
      </>
    );

  if (beat.kind === 'choice') {
    const item = beat.item;
    const side = (v: 0 | 1, text: I18n) => (
      <button key={v} type="button" className={cn(chip, 'flex-1 basis-0 rounded-2xl')} disabled={busy} onClick={() => onAnswer(item.id, v)} data-testid={`pick-${v}`}>
        {tx(text)}
      </button>
    );
    return (
      <>
        <Guide lead={jt('day.lead.choice')} title={title}>
          {jt('choice.prompt')}
        </Guide>
        {value !== undefined ? (
          <Reply>{tx(value === 0 ? item.a : item.b)}</Reply>
        ) : (
          active && (
            <Choices className="flex-nowrap items-stretch">
              {side(0, item.a)}
              <span className="self-center text-xs font-semibold text-muted-foreground">{jt('choice.or')}</span>
              {side(1, item.b)}
            </Choices>
          )
        )}
      </>
    );
  }

  // "Try it": a situation or a puzzle, then "did you enjoy that?" in a follow-up message.
  const item = beat.item;
  const options = item.type === 'puzzle' ? item.options : item.options.map((o) => o.text);
  const enjoy = answers[enjoyId(item.id)];
  return (
    <>
      <Guide lead={jt(item.type === 'puzzle' ? 'day.lead.puzzle' : 'day.lead.try')} title={title}>
        <p>{tx(item.text)}</p>
        {item.type === 'scenario' && <p className="mt-1 text-sm text-muted-foreground">{jt('scenario.prompt')}</p>}
      </Guide>
      {value === undefined ? (
        active && (
          <Choices className={item.type === 'puzzle' ? 'grid grid-cols-2' : 'flex-col items-end'}>
            {options.map((o, i) => (
              <button key={i} type="button" className={cn(chip, item.type === 'puzzle' && 'rounded-2xl text-center')} disabled={busy} onClick={() => onAnswer(item.id, i)} data-testid={`option-${i}`}>
                {tx(o)}
              </button>
            ))}
          </Choices>
        )
      ) : (
        <>
          <Reply>{tx(options[value]!)}</Reply>
          <Guide lead={item.type === 'puzzle' ? (value === item.answer ? jt('puzzle.right') : jt('puzzle.wrong', { answer: tx(item.options[item.answer]!) })) : jt('day.lead.after')}>
            {item.type === 'puzzle' && <p className="mb-2 text-sm">{tx(item.explain)}</p>}
            <p className="font-semibold">{jt('enjoy.prompt')}</p>
          </Guide>
          {enjoy !== undefined ? (
            <Reply>{reactionText(jt, 'enjoy', enjoy)}</Reply>
          ) : (
            active && <Reactions keys="enjoy" disabled={busy} onPick={(v) => onAnswer(enjoyId(item.id), v)} />
          )}
        </>
      )}
    </>
  );
}
