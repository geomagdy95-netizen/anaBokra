// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { AssessmentProvider } from '@/features/assessment/ui-context';
import type { ResultView } from '@/features/results/view';
import type { JourneyData } from '@/lib/journey/journey';
import { careerFacts } from '@/server/content/career-facts';

import { MyResults } from './my-results';

vi.mock('@/i18n/navigation', () => ({ Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => <a href={href} {...rest}>{children}</a> }));
afterEach(cleanup);

const match = (careerId: string, name: string, fit: number) => ({ careerId, name, cluster: 'Law', fit, rank: 1, text: '', reasons: ['Reason one', 'Reason two'], watchOuts: ['Watch this'], flags: [], surprising: false });
const view = {
  resultId: 'r',
  sessionId: 's',
  summary: 'A short summary.',
  hollandCode: 'SEC',
  types: [{ id: 'S', band: 'standout' }, { id: 'E', band: 'strong' }, { id: 'C', band: 'strong' }],
  interests: {},
  bigFive: [],
  values: [],
  abilities: [],
  top: [match('judge_prosecutor', 'Judge / Prosecutor', 81), match('lawyer', 'Lawyer', 78)],
  more: [match('diplomat', 'Diplomat', 70)],
  surprising: [],
} as unknown as ResultView;

const data = (paths: Record<string, unknown> = {}) =>
  ({ journey: { v: 1, paths }, discover: { next: null, doneCount: 10 }, preview: { stage: 'suggested', groups: [], fits: {} }, open: false }) as unknown as JourneyData;

const readiness = { items: [], labels: {}, min: 1 } as never;

function wrap(ui: ReactNode, locale: 'en' | 'ar' = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en} timeZone="UTC">
      <AssessmentProvider gender={null}>{ui}</AssessmentProvider>
    </NextIntlClientProvider>,
  );
}

describe('MyResults', () => {
  it('leads with who I am, offers readiness as a card, and shows how hard each top match is to get into', () => {
    wrap(<MyResults data={data()} view={view} worldProfile={{ interests: { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 } }} facts={careerFacts()} fresh={false} readinessDone={false} readiness={readiness} partial={false} />);
    const hero = screen.getByTestId('results-hero');
    expect(within(hero).getByRole('heading').textContent).toMatch(/Helper|Leader|المساعد|.+/);
    // No zero stats ("0 fields checked") on a fresh journey.
    expect(within(hero).queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.getByTestId('readiness-card')).toBeTruthy();
    const rows = within(screen.getByRole('heading', { name: 'Your top matches' }).parentElement!).getAllByTestId('match-row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByTestId('match-entry').textContent).toMatch(/Very competitive/);
    expect(within(rows[0]!).getByTestId('match-page').getAttribute('href')).toBe('/careers/judge_prosecutor');
    // The quest link only appears once the field is checked.
    expect(screen.queryByTestId('match-quest')).toBeNull();
  });

  it('offers the career quest for a checked field and lists the fields checked on the journey tab', () => {
    const paths = { law: { answers: {}, result: { band: 'fitsWell', fit: 0.72, careers: [] } } };
    wrap(<MyResults data={data(paths)} view={view} worldProfile={{ interests: { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 } }} facts={careerFacts()} fresh={false} readinessDone readiness={readiness} partial={false} />);
    expect(screen.queryByTestId('readiness-card')).toBeNull();
    expect(screen.getAllByTestId('match-quest')[0]!.getAttribute('href')).toBe('/journey/law/judge_prosecutor');
    fireEvent.click(screen.getByRole('tab', { name: 'My journey' }));
    expect(screen.getByText('72%')).toBeTruthy();
  });
});
