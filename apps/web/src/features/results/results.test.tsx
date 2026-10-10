// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { AssessmentProvider } from '@/features/assessment/ui-context';

import { ProfileOverview } from './profile-overview';
import { ReadinessCheck } from './readiness-check';
import { SectionDetail } from './section-detail';
import { SharePanel } from './share-panel';
import { buildProfileView, sectionItems } from './view';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

function wrap(ui: ReactNode, locale: 'ar' | 'en' = 'en', gender: 'female' | 'male' | null = null) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en} timeZone="UTC">
      <AssessmentProvider gender={gender}>{ui}</AssessmentProvider>
    </NextIntlClientProvider>,
  );
}

const lowScores = {
  interests: { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 },
  personality: { extraversion: 0, agreeableness: 0, conscientiousness: 0, emotionalStability: 0, intellect: 0 },
  values: { achievement: 0, workingConditions: 0, recognition: 0, relationships: 0, support: 0, independence: 0 },
  abilities: { verbal: 0, numerical: 0, logical: 0, spatial: 0, creative: 0, manual: 0 },
  derived: { hollandCode: 'RIA', abilityBasis: { verbal: 'self', numerical: 'performance', logical: 'performance+self', spatial: 'self', creative: 'self', manual: 'self' } },
};

const NEGATIVE_EN = /\b(low|weak|weakness|poor|bad|neurotic|anxious|unstable|lack|worst|fail)/i;
const NEGATIVE_AR = /ضعيف|ضعف|سيء|سيئ|عصابي|ناقص|أسوأ|فاشل/;

describe('profile overview', () => {
  it('shows five Big Five bars, three type cards and three values, even when every score is at the bottom', () => {
    const view = buildProfileView(lowScores);
    wrap(<ProfileOverview view={view} summary="" />);
    expect(screen.getAllByTestId('type-card')).toHaveLength(3);
    expect(screen.getByTestId('big-five').querySelectorAll('li')).toHaveLength(5);
    expect(screen.getByTestId('top-values').querySelectorAll('li')).toHaveLength(3);
    for (const b of screen.getAllByTestId('band-label')) expect(b.textContent).toBe('Growing strength');
  });

  it.each([
    ['en', NEGATIVE_EN],
    ['ar', NEGATIVE_AR],
  ] as const)('renders no negative labels (%s)', (locale, bad) => {
    wrap(<ProfileOverview view={buildProfileView(lowScores)} summary="" />, locale, 'female');
    expect(document.body.textContent ?? '').not.toMatch(bad);
  });

  it('never prints raw scores or percentages', () => {
    const { container } = wrap(<ProfileOverview view={buildProfileView({ ...lowScores, personality: { extraversion: 0.73, agreeableness: 0.5, conscientiousness: 0.9, emotionalStability: 0.2, intellect: 0.6 } })} summary="" />);
    expect(container.textContent).not.toMatch(/\d+\s?%|0\.\d/);
  });

  it('labels self-rated abilities as self-reported, and only those', () => {
    const view = buildProfileView(lowScores);
    wrap(<ProfileOverview view={view} summary="" />);
    const rows = screen.getByTestId('abilities').querySelectorAll('li');
    const labelled = [...rows].filter((r) => r.textContent?.includes('Self-reported')).length;
    expect(labelled).toBe(view.abilities.filter((a) => a.selfReported).length);
    expect(labelled).toBe(4);
  });

  it('uses the feminine Arabic note for a female profile where one exists', () => {
    wrap(<ProfileOverview view={buildProfileView(lowScores)} summary="" partial />, 'ar', 'female');
    expect(document.body.textContent).toContain('خلّصتيها');
  });
});

describe('section detail', () => {
  it('explains each item and carries the guidance note', () => {
    const view = buildProfileView(lowScores);
    wrap(<SectionDetail section="bigFive" items={sectionItems(view, 'bigFive')} suits={[{ careerId: 'x', name: 'Nurse', fit: 80 }]} />);
    expect(screen.getAllByTestId('detail-item')).toHaveLength(5);
    expect(screen.getByTestId('guidance-note').textContent).toMatch(/not a diagnosis/i);
    expect(screen.getByText('Nurse')).toBeTruthy();
  });
});

describe('readiness check', () => {
  const instrument = {
    min: 1,
    labels: [1, 2, 3, 4, 5].map((n) => ({ en: `L${n}`, ar: `ل${n}` })),
    items: [1, 2].map((n) => ({ id: `rd_0${n}`, text: { en: `Statement ${n}`, ar: `جملة ${n}` } })),
  };
  it('does not submit until every statement is answered, then saves once and calls onDone', async () => {
    const save = vi.fn(async () => ({}));
    const onDone = vi.fn();
    const { container } = wrap(<ReadinessCheck sessionId="s1" instrument={instrument} onDone={onDone} onSkip={() => {}} save={save} />);
    fireEvent.submit(screen.getByTestId('readiness'));
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/Answer all/);
    for (const radios of [0, 1]) fireEvent.click(container.querySelectorAll(`input[name="rd_0${radios + 1}"]`)[3]!);
    fireEvent.submit(screen.getByTestId('readiness'));
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith('s1', { rd_01: 4, rd_02: 4 });
  });
  it('shows an error and stays open when saving fails', async () => {
    const onDone = vi.fn();
    const { container } = wrap(<ReadinessCheck sessionId="s1" instrument={instrument} onDone={onDone} onSkip={() => {}} save={async () => Promise.reject(new Error('x'))} />);
    for (const n of [1, 2]) fireEvent.click(container.querySelectorAll(`input[name="rd_0${n}"]`)[0]!);
    fireEvent.submit(screen.getByTestId('readiness'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/could not save/i));
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe('share panel', () => {
  it('puts the privacy toggles into the image URL', () => {
    wrap(<SharePanel />);
    const src = () => screen.getByTestId('share-preview').getAttribute('src')!;
    expect(src()).toBe('/api/assessment/share/story?locale=en');
    fireEvent.click(screen.getByTestId('toggle-hideName'));
    expect(src()).toContain('hideName=1');
    expect(src()).not.toContain('hideMatches');
    fireEvent.click(screen.getByTestId('toggle-hideMatches'));
    expect(src()).toContain('hideMatches=1');
    fireEvent.click(screen.getByLabelText(/Post/));
    expect(src()).toContain('/post?');
    fireEvent.click(screen.getByTestId('toggle-hideName'));
    expect(src()).not.toContain('hideName');
  });
});
