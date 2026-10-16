// @vitest-environment jsdom
import { enjoyId, paths } from '@anabokra/content';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '../../../messages/en.json';
import { AssessmentProvider } from '@/features/assessment/ui-context';
import { discoverPlan } from '@/lib/journey/discover-plan';
import { storyPlan } from '@/lib/journey/story-plan';

import { PathStory } from './path-story';
import { discoverSteps } from './steps';
import { TaskRunner } from './task-runner';

vi.mock('@/features/art/task-art-view', () => ({ TaskArt: () => null }));

afterEach(cleanup);

const wrap = (ui: ReactNode) =>
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
      <AssessmentProvider gender={null}>{ui}</AssessmentProvider>
    </NextIntlClientProvider>,
  );

describe('Discover as a checklist', () => {
  it('asks a task in three screens and saves every card of the grid at once (tapped 5, the rest 1)', async () => {
    const task = discoverPlan()[0]!;
    const steps = discoverSteps(task, 'checklist');
    expect(steps.map((s) => s.kind)).toEqual(['grid', 'stack', 'stack']);
    const onAnswer = vi.fn(async () => true);
    wrap(<TaskRunner title="Task 1" steps={steps} initial={{}} onAnswer={onAnswer} onDone={vi.fn()} onClose={vi.fn()} />);

    const cards = screen.getAllByTestId('grid-card');
    expect(cards).toHaveLength(6);
    fireEvent.click(cards[0]!);
    fireEvent.click(cards[3]!);
    fireEvent.click(screen.getByTestId('grid-done'));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(6));
    const saved = Object.fromEntries(onAnswer.mock.calls.map((c) => [(c as unknown as [{ id: string }, number])[0].id, (c as unknown as [unknown, number])[1]]));
    const grid = steps[0]!.kind === 'grid' ? steps[0]!.parts : [];
    expect(grid.map((p) => saved[p.id])).toEqual([5, 1, 1, 5, 1, 1]);
    // Then the personality statements together, one row each.
    await waitFor(() => expect(screen.getByTestId('q-stack')).toBeTruthy());
    expect(screen.getAllByTestId('stack-part')).toHaveLength(3);
  });

  it('shows the attention check as a card to tap', () => {
    const task = discoverPlan().find((t) => t.items.some((i) => i.id === 'ip_ac1'))!;
    wrap(<TaskRunner title="Task" steps={discoverSteps(task, 'checklist')} initial={{}} onAnswer={vi.fn(async () => true)} onDone={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Quick check: tap this card')).toBeTruthy();
  });

  it('explains a specialised card on request without picking it', () => {
    const task = discoverPlan().find((t) => t.items.some((i) => i.id === 'ip_E01'))!;
    wrap(<TaskRunner title="Task" steps={discoverSteps(task, 'checklist')} initial={{}} onAnswer={vi.fn(async () => true)} onDone={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByTestId('card-hint')).toBeNull();
    const toggle = screen.getAllByTestId('card-hint-toggle').find((b) => b.getAttribute('aria-label')!.includes('stocks and bonds'))!;
    fireEvent.click(toggle);
    expect(screen.getByTestId('card-hint').textContent).toContain('stock market');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    // The card itself stays unpicked.
    const card = screen.getAllByTestId('grid-card').find((c) => c.textContent!.includes('stocks and bonds'))!;
    expect(card.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('the path as a chat', () => {
  it('answers a moment with a reaction, then moves on to the next beat', async () => {
    const beats = storyPlan(paths.health!);
    const onAnswer = vi.fn(async () => true);
    wrap(<PathStory title="A day" pathId="health" beats={beats} initial={{}} onAnswer={onAnswer} onDone={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('react-3'));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(beats[0]!.item.id, 3));
    await waitFor(() => expect(screen.getByTestId('story-progress').textContent).toBe(`1/${beats.length}`));
    expect(screen.getAllByTestId('story-reply')).toHaveLength(1);
  });

  it('asks "did you enjoy that?" in the same chat after a Try it, and finishes after the last beat', async () => {
    const beats = storyPlan(paths.health!);
    const lastTry = beats.length - 1 - [...beats].reverse().findIndex((b) => b.kind === 'try');
    // Everything answered except the last "Try it" (and anything after it).
    const initial: Record<string, number> = {};
    beats.slice(0, lastTry).forEach((b) => {
      initial[b.item.id] = b.kind === 'moment' ? 2 : 0;
      if (b.kind === 'try') initial[enjoyId(b.item.id)] = 2;
    });
    const onDone = vi.fn();
    const onAnswer = vi.fn(async () => true);
    wrap(<PathStory title="A day" pathId="health" beats={beats} initial={initial} onAnswer={onAnswer} onDone={onDone} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('option-0'));
    await waitFor(() => expect(screen.getAllByText('Did you enjoy that?').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByTestId('react-3'));
    const tryItem = beats[lastTry]!.item.id;
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(enjoyId(tryItem), 3));
    if (lastTry === beats.length - 1) await waitFor(() => expect(onDone).toHaveBeenCalled());
  });
});
