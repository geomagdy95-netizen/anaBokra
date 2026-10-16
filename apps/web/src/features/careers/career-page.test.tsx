// @vitest-environment jsdom
import { careerById, clusters, industryById } from '@anabokra/content';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
  it('shows a single published band as one range, with the note folded and the source link', () => {
    const page = getCareerPage('software_engineer')!;
    wrap(<SalaryBands market={page.marketEgypt!} />);
    const card = screen.getByTestId('salary-single');
    expect(within(card).getByText(/15,466/)).toBeTruthy();
    expect(within(card).getByText(/79,673/)).toBeTruthy();
    expect(within(card).getByText('One range for all experience levels.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('About this number').closest('details')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Salary source' }).getAttribute('href')).toMatch(/^https:\/\//);
    expect(screen.queryByTestId('salary-empty')).toBeNull();
  });

  it('keeps the table when more than one level is published, marking the missing ones', () => {
    const salary = { junior: { min: 8000, max: 12000 }, mid: null, senior: { min: 20000, max: 30000 }, year: 2026, sourceUrl: 'https://example.org' };
    wrap(<SalaryBands market={{ salaryMonthlyEgp: salary }} />);
    const table = screen.getByRole('table');
    expect(within(table).getByText(/8,000/)).toBeTruthy();
    expect(within(table).getAllByText('Not published separately')).toHaveLength(1);
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

function view(id: string, page: CareerPage | undefined, locale: 'ar' | 'en' = 'en', framed = false) {
  const career = careerById(id)!;
  return wrap(
    <CareerView
      career={career}
      cluster={clusters.find((c) => c.id === career.cluster)}
      page={page}
      industry={industryById(page?.industryId ?? career.cluster)}
      path={`/careers/${id}`}
      framed={framed}
    />,
    locale,
  );
}

// Section headings live in tab panels; inactive panels stay in the DOM but hidden.
const h2 = (name: string) => screen.queryByRole('heading', { level: 2, name, hidden: true });

describe('CareerView', () => {
  it('shows every section for a full page, with programs and their latest minimum score', () => {
    view('software_engineer', getCareerPage('software_engineer'));
    for (const name of ['Overview', 'Path in Egypt', 'Skills', 'Market', 'Future outlook', 'Reality check', 'Related careers', 'Sources']) {
      expect(h2(name), name).toBeTruthy();
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
    expect(h2('Path in Egypt')).toBeTruthy();
    for (const missing of ['Skills', 'Market', 'Reality check']) {
      expect(h2(missing)).toBeNull();
    }
    // The outlook comes from the field, so it is still there; no programs list without program ids.
    expect(h2('Future outlook')).toBeTruthy();
    expect(screen.queryAllByTestId('program')).toHaveLength(0);
    expect(screen.getByRole('link', { name: careerById('ai_engineer')!.name.en, hidden: true })).toBeTruthy();
    // No market data: the pay tile is left out rather than shown empty.
    expect(within(screen.getByTestId('quick-facts')).queryByText('Pay')).toBeNull();
  });

  it('renders a career with no page yet, in Arabic', () => {
    const missing = 'physician';
    view(missing, undefined, 'ar'); // as if the career had no authored page
    expect(screen.getByTestId('lite-note').textContent).toMatch(/جاية قريب/);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(careerById(missing)!.name.ar);
  });

  it('opens on the job tab and switches tabs by tap and arrow keys', () => {
    view('software_engineer', getCareerPage('software_engineer'));
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['The job', 'Getting there', 'Pay & future', 'Real talk']);
    expect(screen.getByRole('heading', { level: 2, name: 'Overview' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2, name: 'Market' })).toBeNull(); // hidden panel
    fireEvent.click(tabs[2]!);
    expect(screen.getByRole('heading', { level: 2, name: 'Market' })).toBeTruthy();
    expect(tabs[2]!.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(tabs[2]!, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Real talk' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Real talk' }), { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'The job' }).getAttribute('aria-selected')).toBe('true');
  });

  it('shows pay, study, demand and outlook up front, and a tile opens its tab', () => {
    view('software_engineer', getCareerPage('software_engineer'));
    const facts = screen.getByTestId('quick-facts');
    expect(within(facts).getByText('EGP 15k–80k')).toBeTruthy();
    expect(within(facts).getByText('4 years')).toBeTruthy();
    fireEvent.click(within(facts).getByText('Field outlook'));
    expect(screen.getByRole('tab', { name: 'Pay & future' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('heading', { level: 2, name: 'Future outlook' })).toBeTruthy();
  });

  it('says when there is no reliable pay figure, keeps myths behind a tap, and folds the sources', () => {
    view('ai_engineer', getCareerPage('ai_engineer'));
    expect(within(screen.getByTestId('quick-facts')).getByText('No reliable figure')).toBeTruthy();
    const myths = screen.getAllByTestId('myth');
    expect(myths.length).toBeGreaterThan(0);
    expect(myths[0]!.tagName).toBe('DETAILS');
    expect(myths[0]!.hasAttribute('open')).toBe(false);
    expect(screen.getByRole('heading', { level: 2, name: 'Sources' }).closest('details')).toBeTruthy();
    // The outlook's own sources move down to the folded list.
    expect(within(document.getElementById('panel-money')!).queryByText('Outlook sources')).toBeNull();
  });

  it('ends with a step back to the field island inside the app, in Arabic', () => {
    view('pharmacist', getCareerPage('pharmacist'), 'ar', true);
    const next = screen.getByTestId('career-next');
    expect(within(next).getByRole('link').getAttribute('href')).toBe('/journey/health');
    expect(screen.getByRole('tab', { name: 'الشغلانة' })).toBeTruthy();
  });
});
