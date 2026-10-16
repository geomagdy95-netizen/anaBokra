// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '../../../messages/en.json';
import { AssessmentProvider } from '@/features/assessment/ui-context';
import { questPlan, saveQuestResult, scoreQuest, setCareerSelected, taskId } from '@/lib/journey/career-quest';
import type { JourneyData } from '@/lib/journey/journey';
import { readJourney } from '@/lib/journey/verify';
import { MemoryKv } from '@/lib/local/kv';
import { getCareerPage } from '@/server/content/career-pages';

import { CareerResultView, QuestChat } from './career-island';

vi.mock('@/features/art/task-art-view', () => ({ TaskArt: () => null }));
vi.mock('@/i18n/navigation', () => ({ Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => <a href={href} {...rest}>{children}</a> }));

afterEach(cleanup);

const page = getCareerPage('pharmacist')!;
const beats = questPlan(page);
const wrap = (ui: ReactNode) =>
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
      <AssessmentProvider gender={null}>{ui}</AssessmentProvider>
    </NextIntlClientProvider>,
  );

describe('the career quest chat', () => {
  it('saves every task card at once (tapped 1, the rest 0)', async () => {
    const onAnswer = vi.fn(async () => true);
    wrap(<QuestChat title="Quest" art={[]} careerName="Pharmacist" beats={beats} initial={{ day: 3 }} onAnswer={onAnswer} onDone={vi.fn()} onClose={vi.fn()} />);
    const tasks = screen.getByTestId('quest-tasks').querySelectorAll('button[aria-pressed]');
    fireEvent.click(tasks[0]!);
    fireEvent.click(tasks[2]!);
    fireEvent.click(screen.getByTestId('quest-tasks-done'));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(tasks.length));
    expect(onAnswer).toHaveBeenCalledWith(taskId(0), 1);
    expect(onAnswer).toHaveBeenCalledWith(taskId(1), 0);
    expect(onAnswer).toHaveBeenCalledWith(taskId(2), 1);
  });

  it('reveals the real pay after a guess', async () => {
    const before: Record<string, number> = { day: 3 };
    for (const b of beats) if (b.kind === 'tasks') b.tasks.forEach((_, i) => (before[taskId(i)] = 1));
    wrap(<QuestChat title="Quest" art={[]} careerName="Pharmacist" beats={beats} initial={before} onAnswer={vi.fn(async () => true)} onDone={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('salary-0'));
    await waitFor(() => expect(screen.getByText(/The usual range:/)).toBeTruthy());
  });
});

describe('choosing a career', () => {
  it('asks to swap when two careers are already chosen', async () => {
    const kv = new MemoryKv();
    const answers = Object.fromEntries(beats.flatMap((b) => (b.kind === 'tasks' ? b.tasks.map((_, i) => [taskId(i), 1]) : [[b.id, 3]])));
    for (const id of ['pharmacist', 'nurse', 'dentist']) await saveQuestResult(kv, 'p1', scoreQuest(getCareerPage(id)!, answers, { profileFit: 60 }));
    await setCareerSelected(kv, 'p1', 'nurse', true);
    await setCareerSelected(kv, 'p1', 'dentist', true);
    const data = { rt: { userId: 'p1', device: { kv } }, journey: await readJourney(kv, 'p1') } as unknown as JourneyData;
    const result = (await readJourney(kv, 'p1')).careers!.pharmacist!.result!;
    wrap(<CareerResultView data={data} page={page} result={result} name="Pharmacist" groupId="health" onAgain={vi.fn()} onChanged={vi.fn()} />);
    fireEvent.click(screen.getByTestId('career-select'));
    await waitFor(() => expect(screen.getByText('You already chose 2 careers.')).toBeTruthy());
    fireEvent.click(screen.getByText(/Swap Nurse/));
    await waitFor(async () => expect((await readJourney(kv, 'p1')).selectedCareers).toEqual(['dentist', 'pharmacist']));
  });
});
