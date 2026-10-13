// @vitest-environment jsdom
import { careerById, clusters, industryById } from '@anabokra/content';
import { cleanup, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getCareerPage } from '@/server/content/career-pages';

import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';

import { CareerView } from './career-view';
import { latestMinScore } from './programs';
import { SalaryBands } from './salary';
import type { CareerPage } from './types';

// next-intl's navigation helpers need the Next.js runtime; a plain anchor is enough for markup tests.
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

function wrap(ui: ReactNode, locale: 'ar' | 'en' = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en} timeZone="UTC">
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('SalaryBands', () => {
  it('renders the published bands, the unpublished ones as such, and the source link', () => {
    const page = getCareerPage('software_engineer')!;
    wrap(<SalaryBands market={page.marketEgypt!} />);
    const table = screen.getByRole('table');
    expect(within(table).getByText(/15,466/)).toBeTruthy();
    expect(within(table).getByText(/79,673/)).toBeTruthy();
    expect(within(table).getAllByText('Not published separately')).toHaveLength(2); // junior and senior
    expect(screen.getByRole('link', { name: 'Salary source' }).getAttribute('href')).toMatch(/^https:\/\//);
    expect(screen.queryByTestId('salary-empty')).toBeNull();
  });

  it('renders the null note instead of numbers when there is no citable figure', () => {
    const page = getCareerPage('ai_engineer')!;
    expect(page.marketEgypt!.salaryMonthlyEgp).toBeNull();
    wrap(<SalaryBands market={page.marketEgypt!} />);
    expect(screen.getByTestId('salary-empty')).toBeTruthy();
    expect(screen.getByText(/did not find a citable Egypt salary figure/)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('falls back to a default sentence when a null salary has no note, and localises the note in Arabic', () => {
    wrap(<SalaryBands market={{ salaryMonthlyEgp: null }} />);
    expect(screen.getByText(/do not show one/)).toBeTruthy();
    cleanup();
    wrap(<SalaryBands market={{ salaryMonthlyEgp: null, salaryNote: { en: 'x', ar: 'لا يوجد رقم' } }} />, 'ar');
    expect(screen.getByText('لا يوجد رقم')).toBeTruthy();
  });
});

describe('latestMinScore', () => {
  const base = { sourceUrl: 'https://x', system: 'thanaweya-amma', track: 'science' };
  it('takes the latest year and prefers a Tansik cut-off within a year', () => {
    const r = latestMinScore({
      minScores: [
        { ...base, year: 2024, scorePct: 90, kind: 'tansik-phase1-cutoff' },
        { ...base, year: 2026, scorePct: 70, kind: 'regulatory-minimum' },
        { ...base, year: 2026, scorePct: 91, kind: 'tansik-phase1-cutoff' },
      ],
    });
    expect(r).toMatchObject({ year: 2026, scorePct: 91 });
    expect(latestMinScore({ minScores: [] })).toBeNull();
  });
});

function view(id: string, page: CareerPage | undefined, locale: 'ar' | 'en' = 'en') {
  const career = careerById(id)!;
  return wrap(
    <CareerView
      career={career}
      cluster={clusters.find((c) => c.id === career.cluster)}
      page={page}
      industry={industryById(page?.industryId ?? career.cluster)}
      path={`/careers/${id}`}
    />,
    locale,
  );
}

describe('CareerView', () => {
  it('shows every section for a full page, with programs and their latest minimum score', () => {
    view('software_engineer', getCareerPage('software_engineer'));
    for (const name of ['Overview', 'Path in Egypt', 'Skills', 'Market', 'Future outlook', 'Reality check', 'Related careers', 'Sources']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeTruthy();
    }
    expect(screen.queryByTestId('lite-note')).toBeNull();
    const programs = screen.getAllByTestId('program');
    expect(programs.length).toBeGreaterThan(0);
    expect(within(programs[0]!).getByText(/Latest minimum score/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Report an issue/ }).getAttribute('href')).toMatch(/^mailto:/);
    expect(screen.getByText(/Last reviewed: October 9, 2026/)).toBeTruthy();
  });

  it('renders a lite page with only the sections it has plus the coming-soon note', () => {
    const full = getCareerPage('software_engineer')!;
    const lite: CareerPage = {
      id: 'software_engineer',
      depth: 'lite',
      lastReviewedAt: full.lastReviewedAt,
      industryId: full.industryId,
      snapshot: { summary: full.snapshot!.summary },
      pathEgypt: { studyYears: 4, thanaweyaTracks: ['math'] },
      progression: { relatedCareerIds: ['ai_engineer'] },
      sources: full.sources!.slice(0, 2),
    };
    view('software_engineer', lite);
    expect(screen.getByTestId('lite-note').textContent).toMatch(/coming soon/);
    expect(screen.getByRole('heading', { level: 2, name: 'Path in Egypt' })).toBeTruthy();
    for (const missing of ['Skills', 'Market', 'Reality check']) {
      expect(screen.queryByRole('heading', { level: 2, name: missing })).toBeNull();
    }
    // The outlook comes from the field, so it is still there; no programs list without program ids.
    expect(screen.getByRole('heading', { level: 2, name: 'Future outlook' })).toBeTruthy();
    expect(screen.queryAllByTestId('program')).toHaveLength(0);
    expect(screen.getByRole('link', { name: careerById('ai_engineer')!.name.en })).toBeTruthy();
  });

  it('renders a career with no page yet, in Arabic', () => {
    const missing = 'physician';
    view(missing, undefined, 'ar'); // as if the career had no authored page
    expect(screen.getByTestId('lite-note').textContent).toMatch(/جاية قريب/);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(careerById(missing)!.name.ar);
  });
});
