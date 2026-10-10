'use client';

import { ArrowLeft, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

import { insightFor } from './insight';
import { MicroInsight } from './micro-insight';
import { ProgressBar, ScaleInput, useNumberFormat } from './primitives';
import { PuzzleItemOrNothing } from './puzzle-item';
import { SwipeCard } from './swipe-card';
import { SWIPE_KEYS, SWIPE_VALUE, valueForSwipe } from './swipe';
import type { AnswerMap, ItemPayload, PuzzlePayload, ScalePayload } from './types';
import { useAT, useText } from './ui-context';

export interface SequenceItem {
  id: string;
  kind: 'scale' | 'puzzle';
  text?: ItemPayload['text'];
  puzzle?: PuzzlePayload;
}

export interface SequenceProps {
  station: string;
  /** How a scale item is presented. */
  mode: 'swipe' | 'scale';
  items: SequenceItem[];
  scale: ScalePayload;
  answers: AnswerMap;
  startIndex: number;
  /** Message key under Assessment.prompts */
  promptKey: string;
  onAnswer: (itemId: string, value: number, ms: number, cursor: Record<string, unknown>) => void;
  /** The last item was answered. */
  onFinish: () => void;
}

const DIGITS = new Set(['1', '2', '3', '4', '5']);

/**
 * One-item-at-a-time player shared by interests (swipe cards), personality and abilities (scale buttons,
 * plus puzzles when the instrument has them). Owns the position, undo, the progress counter and the
 * D8 micro-insight overlay. Attention-check items go through here like any other item (D11).
 */
export function SequenceStation({ station, mode, items, scale, answers, startIndex, promptKey, onAnswer, onFinish }: SequenceProps) {
  const at = useAT();
  const text = useText();
  const nf = useNumberFormat();
  const [index, setIndex] = useState(() => Math.min(Math.max(startIndex, 0), items.length - 1));
  const [insight, setInsight] = useState<{ ordinal: number; answered: number } | null>(null);
  const shownInsights = useRef(new Set<number>());
  const shownAt = useRef(0);

  const item = items[index]!;
  useEffect(() => {
    shownAt.current = Date.now();
  }, [index]);

  const labels = useMemo(() => scale.labels.map((l) => text(l)), [scale.labels, text]);
  const answeredCount = useMemo(() => items.filter((i) => answers[i.id] !== undefined).length, [items, answers]);

  const commit = useCallback(
    (value: number) => {
      const ms = Date.now() - shownAt.current;
      onAnswer(item.id, value, ms, { station, index: Math.min(index + 1, items.length - 1) });
      const count = items.filter((i) => i.id === item.id || answers[i.id] !== undefined).length;
      if (index >= items.length - 1) {
        onFinish();
        return;
      }
      setIndex(index + 1);
      const ordinal = insightFor(count, items.length);
      if (ordinal !== null && !shownInsights.current.has(count)) {
        shownInsights.current.add(count);
        setInsight({ ordinal, answered: count });
      }
    },
    [answers, index, item.id, items, onAnswer, onFinish, station],
  );

  const back = () => setIndex((i) => Math.max(0, i - 1));

  // Window-level so the keys keep working after the insight dialog closes or focus is elsewhere on the page.
  const onKey = (e: KeyboardEvent) => {
    if (insight || e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (mode === 'swipe' && item.kind === 'scale') {
      const d = SWIPE_KEYS[e.key];
      if (d) {
        e.preventDefault();
        commit(valueForSwipe(d));
        return;
      }
    }
    if (item.kind === 'scale' && DIGITS.has(e.key)) {
      const v = Number(e.key);
      if (v >= scale.min && v <= scale.max) {
        e.preventDefault();
        commit(v);
      }
    }
  };
  const keyHandler = useRef(onKey);
  useEffect(() => {
    keyHandler.current = onKey;
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const current = answers[item.id];
  const counter = at('sequence.counter', { current: nf.format(Math.min(index + 1, items.length)), total: nf.format(items.length) });

  return (
    <div className="flex flex-col gap-5" data-testid="sequence">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium tabular-nums" data-testid="counter" aria-live="off">
            {counter}
          </span>
          <span className="text-muted-foreground">{at('sequence.answered', { n: nf.format(answeredCount) })}</span>
        </div>
        <ProgressBar value={answeredCount} max={items.length} label={at('sequence.progressLabel')} />
      </div>

      <p className="text-sm text-muted-foreground">{at(`prompts.${promptKey}`)}</p>

      {item.kind === 'puzzle' ? (
        <PuzzleItemOrNothing puzzle={item.puzzle} value={current} onSelect={commit} />
      ) : mode === 'swipe' ? (
        <>
          <SwipeCard
            key={item.id}
            ariaLabel={at('swipe.cardLabel', { current: nf.format(index + 1), total: nf.format(items.length) })}
            hintFor={(v) => labels[v - scale.min] ?? ''}
            onSwipe={(v) => commit(v)}
          >
            {text(item.text!)}
          </SwipeCard>
          <p className="text-center text-sm text-muted-foreground">
            {at('swipe.help', {
              left: labels[SWIPE_VALUE.left - scale.min] ?? '',
              right: labels[SWIPE_VALUE.right - scale.min] ?? '',
              up: labels[SWIPE_VALUE.up - scale.min] ?? '',
            })}
          </p>
          <ScaleInput legend={at('swipe.buttonsLabel')} min={scale.min} labels={labels} value={current} onSelect={commit} />
        </>
      ) : (
        <>
          <p className="min-h-16 text-2xl font-semibold leading-snug" aria-live="polite" data-testid="statement">
            {text(item.text!)}
          </p>
          <ScaleInput legend={at(`prompts.${promptKey}`)} min={scale.min} labels={labels} value={current} onSelect={commit} stacked={labels.some((l) => l.length > 18)} />
        </>
      )}

      <div className="flex items-center justify-between gap-2">
        {mode === 'swipe' ? (
          <Button type="button" variant="outline" onClick={back} disabled={index === 0}>
            <Undo2 className="rtl:-scale-x-100" aria-hidden="true" />
            {at('sequence.undo')}
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={back} disabled={index === 0}>
            <ArrowLeft className="rtl:rotate-180" aria-hidden="true" />
            {at('sequence.previous')}
          </Button>
        )}
        {current !== undefined && index < items.length - 1 && (
          <Button type="button" variant="ghost" onClick={() => setIndex(index + 1)}>
            {at('sequence.next')}
          </Button>
        )}
        {current !== undefined && index === items.length - 1 && answeredCount === items.length && (
          <Button type="button" onClick={onFinish}>
            {at('sequence.finish')}
          </Button>
        )}
      </div>

      <MicroInsight
        open={insight !== null}
        ordinal={insight?.ordinal ?? 0}
        answered={insight?.answered ?? 0}
        total={items.length}
        onContinue={() => setInsight(null)}
      />
    </div>
  );
}
