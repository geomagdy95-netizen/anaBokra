// @vitest-environment jsdom
import { paths } from '@anabokra/content';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '../../../messages/en.json';
import { AssessmentProvider } from '@/features/assessment/ui-context';
import { scoreVerify } from '@/lib/journey/verify';

import { Result } from './verify-page';

vi.mock('@/i18n/navigation', () => ({ Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

afterEach(cleanup);

const health = paths.health!;
const [day, real] = health.tasks;

describe('the path result', () => {
  it('explains the band with three signals, puts the best careers first and shows trade-offs side by side', () => {
    const answers: Record<string, number> = {};
    if (day?.kind === 'story') for (const i of day.items) answers[i.id] = 3;
    // Turn down every reality: the "keep in mind" cards.
    if (real?.kind === 'thisOrThat') for (const i of real.items) answers[i.id] = i.path === 'a' ? 1 : 0;
    const result = scoreVerify(health, answers, { groupFit: 55, careerFits: {} });
    render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
        <AssessmentProvider gender={null}>
          <Result path={health} result={result} onAgain={vi.fn()} rating={null} />
        </AssessmentProvider>
      </NextIntlClientProvider>,
    );

    const signals = within(screen.getByTestId('verify-signals')).getAllByRole('listitem');
    expect(signals.map((s) => [s.dataset.signal, s.dataset.level])).toEqual([
      ['profile', '2'],
      ['activities', '3'],
      ['realities', '1'],
    ]);
    expect(screen.getByText('Most of them aren’t for you')).toBeTruthy();

    const careers = () => within(screen.getByTestId('verify-careers')).getAllByRole('listitem').filter((li) => li.parentElement === screen.getByTestId('verify-careers'));
    expect(careers()).toHaveLength(3);
    fireEvent.click(screen.getByTestId('verify-all-careers'));
    expect(careers()).toHaveLength(14);

    const keep = screen.getByTestId('verify-keep');
    expect(within(keep).getAllByText('You’d rather')).toHaveLength(6);
    expect(within(keep).getAllByText('This path often means')).toHaveLength(6);
  });
});
