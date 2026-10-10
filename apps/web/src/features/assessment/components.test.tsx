// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';

import { SequenceStation, type SequenceItem } from './sequence-station';
import type { Gender, ValuesPayload } from './types';
import { AssessmentProvider } from './ui-context';
import { ValuesStation } from './values-station';

afterEach(cleanup);

function wrap(ui: ReactNode, locale: 'ar' | 'en' = 'en', gender: Gender | null = null) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en} timeZone="UTC">
      <AssessmentProvider gender={gender}>{ui}</AssessmentProvider>
    </NextIntlClientProvider>,
  );
}

const scale = {
  min: 1,
  max: 5,
  labels: ['Strongly dislike', 'Dislike', 'Unsure', 'Like', 'Strongly like'].map((en, i) => ({ en, ar: `ar${i + 1}` })),
};
const items: SequenceItem[] = Array.from({ length: 12 }, (_, i) => ({
  id: `i${i}`,
  kind: 'scale',
  text: { en: `Item ${i}`, ar: `عنصر ${i}`, arF: `عنصرة ${i}` },
}));

/** Parent that stores answers like the real runner does. */
function Harness({ onAnswer, onFinish, mode }: { onAnswer: (...a: unknown[]) => void; onFinish: () => void; mode: 'swipe' | 'scale' }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  return (
    <SequenceStation
      station="interests"
      mode={mode}
      items={items}
      scale={scale}
      answers={answers}
      startIndex={0}
      promptKey="interests"
      onAnswer={(id, v, ms, c) => {
        setAnswers((a) => ({ ...a, [id]: v }));
        onAnswer(id, v, ms, c);
      }}
      onFinish={onFinish}
    />
  );
}

function seq(onAnswer = vi.fn(), onFinish = vi.fn(), mode: 'swipe' | 'scale' = 'swipe', locale: 'ar' | 'en' = 'en', gender: Gender | null = null) {
  wrap(<Harness onAnswer={onAnswer} onFinish={onFinish} mode={mode} />, locale, gender);
  return { onAnswer, onFinish };
}

const unsure = () => screen.getAllByRole('button', { name: /3.*Unsure/ })[0]!;

describe('SequenceStation (D2/D3)', () => {
  it('answers with the visible buttons (all 5 points) and advances', () => {
    const { onAnswer } = seq();
    expect(screen.getByTestId('counter').textContent).toBe('1 / 12');
    fireEvent.click(unsure());
    expect(onAnswer).toHaveBeenCalledWith('i0', 3, expect.any(Number), expect.any(Object));
    expect(screen.getByTestId('counter').textContent).toBe('2 / 12');
  });

  it('maps arrow keys like swipes: left=2 right=4 up=5', () => {
    const { onAnswer } = seq();
    const root = window;
    fireEvent.keyDown(root, { key: 'ArrowLeft' });
    fireEvent.keyDown(root, { key: 'ArrowRight' });
    fireEvent.keyDown(root, { key: 'ArrowUp' });
    expect(onAnswer.mock.calls.map((c) => c[1])).toEqual([2, 4, 5]);
  });

  it('maps pointer drags to the same values', () => {
    const { onAnswer } = seq();
    const drag = (dx: number, dy: number) => {
      const card = screen.getByTestId('swipe-card');
      fireEvent.pointerDown(card, { pointerId: 1, clientX: 100, clientY: 100, button: 0 });
      fireEvent.pointerMove(card, { pointerId: 1, clientX: 100 + dx, clientY: 100 + dy });
      fireEvent.pointerUp(card, { pointerId: 1, clientX: 100 + dx, clientY: 100 + dy });
    };
    drag(-150, 0);
    drag(150, 0);
    drag(0, -150);
    drag(10, 10); // too short: no answer
    expect(onAnswer.mock.calls.map((c) => c[1])).toEqual([2, 4, 5]);
  });

  it('undo goes back one card', () => {
    seq();
    fireEvent.click(unsure());
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByTestId('counter').textContent).toBe('1 / 12');
  });

  it('shows a neutral micro-insight after 9 items and no scores', () => {
    seq();
    for (let i = 0; i < 9; i++) fireEvent.click(unsure());
    const dlg = screen.getByTestId('micro-insight');
    expect(dlg.textContent).toMatch(/answered 9 of 12/);
    expect(dlg.textContent).not.toMatch(/score|%/i);
  });

  it('uses the feminine Arabic text for a female student only', () => {
    seq(vi.fn(), vi.fn(), 'scale', 'ar', 'female');
    expect(screen.getByTestId('statement').textContent).toBe('عنصرة 0');
    cleanup();
    seq(vi.fn(), vi.fn(), 'scale', 'ar', null);
    expect(screen.getByTestId('statement').textContent).toBe('عنصر 0');
  });
});

const payload: ValuesPayload = {
  kind: 'values',
  buckets: [
    { id: 'must', name: { en: 'Must have', ar: 'لازم' }, weight: 3, limit: 7 },
    { id: 'nice', name: { en: 'Nice to have', ar: 'كويس' }, weight: 2 },
    { id: 'no', name: { en: "Don't care", ar: 'لا' }, weight: 1 },
  ],
  cards: Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, value: 'achievement', text: { en: `Card ${i}`, ar: `كارت ${i}` } })),
  workValues: ['achievement'],
};

describe('ValuesStation (D4)', () => {
  it('blocks the 8th "must have" card in the UI', () => {
    const onAnswer = vi.fn();
    const answers: Record<string, number> = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`c${i}`, 3]));
    wrap(<ValuesStation payload={payload} answers={answers} initialRanking={[]} onAnswer={onAnswer} onFinish={vi.fn()} />);
    // card 7 is auto-selected (first unsorted); its bucket buttons are visible
    const group = screen.getByRole('group', { name: /Card 7/ });
    const must = within(group).getByRole('button', { name: /Must have/ }) as HTMLButtonElement;
    expect(must.disabled).toBe(true);
    fireEvent.click(must);
    expect(onAnswer).not.toHaveBeenCalled();
    fireEvent.click(within(group).getByRole('button', { name: /Nice to have/ }));
    expect(onAnswer).toHaveBeenCalledWith('c7', 2, expect.any(Number), expect.any(Object));
  });

  it('tap-to-assign puts a card in the chosen bucket', () => {
    const onAnswer = vi.fn();
    wrap(<ValuesStation payload={payload} answers={{}} initialRanking={[]} onAnswer={onAnswer} onFinish={vi.fn()} />);
    const group = screen.getByRole('group', { name: /Card 0/ });
    fireEvent.click(within(group).getByRole('button', { name: /Must have/ }));
    expect(onAnswer).toHaveBeenCalledWith('c0', 3, expect.any(Number), expect.any(Object));
  });
});
