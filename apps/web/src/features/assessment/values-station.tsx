'use client';

import { ArrowDown, ArrowUp, Check } from 'lucide-react';
import { useMemo, useRef, useState, type DragEvent } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { insightFor } from './insight';
import { MicroInsight } from './micro-insight';
import { choiceBase, choiceIdle, choiceOn, FOCUS, ProgressBar, useNumberFormat } from './primitives';
import type { AnswerMap, ValuesPayload } from './types';
import { useAT, useText } from './ui-context';
import { assignCard, countIn, moveTop, orderWorkValues, toggleTop, TOP_VALUES } from './values-sort';

const nowMs = () => Date.now();

export interface ValuesStationProps {
  payload: ValuesPayload;
  /** card id -> bucket weight (what is stored). */
  answers: AnswerMap;
  initialRanking: string[];
  onAnswer: (cardId: string, weight: number, ms: number, cursor: Record<string, unknown>) => void;
  onFinish: (ranking: string[]) => void;
}

/**
 * D4: sort 21 need-cards into "must have" (max 7) / "nice to have" / "don't care", then pick and order
 * the top values. Desktop: drag a card onto a bucket. Everywhere (touch, keyboard, screen readers):
 * the selected card shows the three bucket buttons, so it is two taps. Same code path for both.
 */
export function ValuesStation({ payload, answers, initialRanking, onAnswer, onFinish }: ValuesStationProps) {
  const at = useAT();
  const text = useText();
  const nf = useNumberFormat();
  const { cards, buckets } = payload;
  const sortedCount = cards.filter((c) => answers[c.id] !== undefined).length;
  const [step, setStep] = useState<'sort' | 'rank'>(sortedCount === cards.length ? 'rank' : 'sort');
  const [selected, setSelected] = useState<string | null>(() => cards.find((c) => answers[c.id] === undefined)?.id ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [insight, setInsight] = useState<{ ordinal: number; answered: number } | null>(null);
  const [top, setTop] = useState<string[]>(initialRanking.slice(0, TOP_VALUES));
  const shown = useRef(new Set<number>());
  const startedAt = useRef(0);

  const place = (cardId: string, weight: number) => {
    const res = assignCard(answers, cardId, weight, buckets);
    if (!res.ok) {
      if (res.reason === 'limit') setMessage(at('values.limitReached', { limit: nf.format(res.limit) }));
      return;
    }
    setMessage(null);
    const wasNew = answers[cardId] === undefined;
    const count = sortedCount + (wasNew ? 1 : 0);
    onAnswer(cardId, weight, nowMs() - (startedAt.current || nowMs()), { station: 'values', sorted: count });
    startedAt.current = nowMs();
    const unsorted = cards.filter((c) => c.id !== cardId && answers[c.id] === undefined);
    setSelected(unsorted[0]?.id ?? null);
    if (wasNew && unsorted.length === 0) {
      setStep('rank');
      return;
    }
    const ordinal = wasNew ? insightFor(count, cards.length) : null;
    if (ordinal !== null && !shown.current.has(count)) {
      shown.current.add(count);
      setInsight({ ordinal, answered: count });
    }
  };

  const onDragStart = (e: DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDrop = (e: DragEvent, weight: number) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (cards.some((c) => c.id === id)) place(id, weight);
  };

  if (step === 'rank') {
    return (
      <RankStep
        payload={payload}
        answers={answers}
        top={top}
        setTop={setTop}
        onBack={() => setStep('sort')}
        onDone={() => onFinish(top)}
      />
    );
  }

  const unsortedCards = cards.filter((c) => answers[c.id] === undefined);
  const renderCard = (c: ValuesPayload['cards'][number]) => {
    const isSel = selected === c.id;
    const cur = answers[c.id];
    return (
      <li key={c.id}>
        <div
          draggable
          onDragStart={(e) => onDragStart(e, c.id)}
          className={cn('rounded-lg border bg-card text-card-foreground', isSel && 'border-primary ring-2 ring-primary')}
        >
          <button
            type="button"
            aria-expanded={isSel}
            onClick={() => setSelected(isSel ? null : c.id)}
            className={cn('w-full rounded-lg p-3 text-start text-sm font-medium', FOCUS)}
          >
            {text(c.text)}
          </button>
          {isSel && (
            <div role="group" aria-label={at('values.placeLabel', { card: text(c.text) })} className="flex flex-wrap gap-2 border-t p-2">
              {buckets.map((b) => {
                const full = b.limit !== undefined && cur !== b.weight && countIn(answers, b.weight) >= b.limit;
                return (
                  <button
                    key={b.id}
                    type="button"
                    disabled={full}
                    aria-pressed={cur === b.weight}
                    onClick={() => place(c.id, b.weight)}
                    className={cn(choiceBase, 'min-h-10 flex-1 text-xs sm:text-sm disabled:opacity-60', cur === b.weight ? choiceOn : choiceIdle)}
                  >
                    {text(b.name)}
                    {b.limit !== undefined && (
                      <span className="tabular-nums">
                        {nf.format(countIn(answers, b.weight))}/{nf.format(b.limit)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-5" data-testid="values-sort">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium tabular-nums">{at('values.sorted', { n: nf.format(sortedCount), total: nf.format(cards.length) })}</span>
        </div>
        <ProgressBar value={sortedCount} max={cards.length} label={at('sequence.progressLabel')} />
      </div>
      <p className="text-sm text-muted-foreground">{at('prompts.values')}</p>
      <p role="alert" className={cn('text-sm text-destructive', !message && 'hidden')}>
        {message}
      </p>

      <section aria-labelledby="mx-pool" className="flex flex-col gap-2">
        <h2 id="mx-pool" className="text-base font-semibold">
          {at('values.toSort', { n: nf.format(unsortedCards.length) })}
        </h2>
        {unsortedCards.length === 0 ? (
          <p className="text-sm text-muted-foreground">{at('values.allSorted')}</p>
        ) : (
          <ul className="flex flex-col gap-2">{unsortedCards.map(renderCard)}</ul>
        )}
      </section>

      <div className="grid gap-3 md:grid-cols-3">
        {buckets.map((b) => {
          const inBucket = cards.filter((c) => answers[c.id] === b.weight);
          return (
            <section
              key={b.id}
              aria-labelledby={`mx-b-${b.id}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, b.weight)}
              data-testid={`bucket-${b.id}`}
              className="flex min-h-24 flex-col gap-2 rounded-xl border-2 border-dashed bg-muted p-3"
            >
              <h2 id={`mx-b-${b.id}`} className="flex items-center justify-between text-base font-semibold">
                <span>{text(b.name)}</span>
                <span className="tabular-nums text-sm font-medium" data-testid={`count-${b.id}`}>
                  {nf.format(inBucket.length)}
                  {b.limit !== undefined && <> / {nf.format(b.limit)}</>}
                </span>
              </h2>
              {inBucket.length === 0 ? (
                <p className="text-sm text-muted-foreground">{at('values.dropHere')}</p>
              ) : (
                <ul className="flex flex-col gap-2">{inBucket.map(renderCard)}</ul>
              )}
            </section>
          );
        })}
      </div>

      {sortedCount === cards.length && (
        <Button type="button" onClick={() => setStep('rank')}>
          {at('values.toRank')}
        </Button>
      )}

      <MicroInsight
        open={insight !== null}
        ordinal={insight?.ordinal ?? 0}
        answered={insight?.answered ?? 0}
        total={cards.length}
        onContinue={() => setInsight(null)}
      />
    </div>
  );
}

function RankStep({
  payload,
  answers,
  top,
  setTop,
  onBack,
  onDone,
}: {
  payload: ValuesPayload;
  answers: AnswerMap;
  top: string[];
  setTop: (t: string[]) => void;
  onBack: () => void;
  onDone: () => void;
}) {
  const at = useAT();
  const nf = useNumberFormat();
  const options = useMemo(() => orderWorkValues(payload, answers), [payload, answers]);
  return (
    <div className="flex flex-col gap-5" data-testid="values-rank">
      <div>
        <h2 className="text-xl font-semibold">{at('values.rankTitle', { n: nf.format(TOP_VALUES) })}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{at('values.rankHelp', { n: nf.format(TOP_VALUES) })}</p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {options.map((v) => {
          const rank = top.indexOf(v);
          const on = rank >= 0;
          const full = !on && top.length >= TOP_VALUES;
          return (
            <li key={v}>
              <button
                type="button"
                aria-pressed={on}
                disabled={full}
                onClick={() => setTop(toggleTop(top, v))}
                className={cn(choiceBase, 'w-full flex-col items-start gap-1 px-4 py-3 text-start disabled:opacity-60', on ? choiceOn : choiceIdle)}
              >
                <span className="flex items-center gap-2 font-semibold">
                  {on && (
                    <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary-foreground text-xs text-primary tabular-nums">
                      {nf.format(rank + 1)}
                    </span>
                  )}
                  {at(`workValues.${v}.name`)}
                </span>
                <span className="text-xs font-normal">{at(`workValues.${v}.desc`)}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {top.length > 1 && (
        <section aria-labelledby="mx-order" className="flex flex-col gap-2">
          <h3 id="mx-order" className="text-base font-semibold">
            {at('values.yourOrder')}
          </h3>
          <ol className="flex flex-col gap-2">
            {top.map((v, i) => (
              <li key={v} className="flex items-center justify-between gap-2 rounded-lg border bg-card p-2 ps-3 text-sm">
                <span className="font-medium">
                  <span className="tabular-nums">{nf.format(i + 1)}.</span> {at(`workValues.${v}.name`)}
                </span>
                <span className="flex gap-1">
                  <Button type="button" size="icon" variant="outline" disabled={i === 0} aria-label={at('values.moveUp', { name: at(`workValues.${v}.name`) })} onClick={() => setTop(moveTop(top, v, -1))}>
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button type="button" size="icon" variant="outline" disabled={i === top.length - 1} aria-label={at('values.moveDown', { name: at(`workValues.${v}.name`) })} onClick={() => setTop(moveTop(top, v, 1))}>
                    <ArrowDown aria-hidden="true" />
                  </Button>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="outline" onClick={onBack}>
          {at('values.backToSort')}
        </Button>
        <Button type="button" disabled={top.length !== TOP_VALUES} onClick={onDone}>
          <Check aria-hidden="true" />
          {at('values.done')}
        </Button>
      </div>
    </div>
  );
}
