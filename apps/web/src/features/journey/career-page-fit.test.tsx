// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { AssessmentProvider } from '@/features/assessment/ui-context';
import type { JourneyData } from '@/lib/journey/journey';

import { careerFit, FitCard } from './career-page-fit';

vi.mock('@/i18n/navigation', () => ({ Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => <a href={href} {...rest}>{children}</a> }));
afterEach(cleanup);

type FitData = Pick<JourneyData, 'journey' | 'preview' | 'discover'>;
const base = (over: Partial<FitData['journey']> = {}, fits: Record<string, number> = {}, next: number | null = null) =>
  ({ journey: { v: 1, paths: {}, ...over }, preview: { fits }, discover: { next } }) as unknown as FitData;
const pathResult = (careers: { careerId: string; fit: number }[]) => ({ result: { careers: careers.map((c) => ({ ...c, cautions: [] })) } });

describe('careerFit', () => {
  it('prefers the career quest, then the field check, then a finished Discover', () => {
    const quest = { answers: {}, result: { fit: 0.71, band: 'fitsWell' } };
    expect(careerFit(base({ careers: { pharmacist: quest } as never, paths: { health: pathResult([{ careerId: 'pharmacist', fit: 0.5 }]) } as never }), 'pharmacist')).toEqual({
      kind: 'quest',
      fit: 0.71,
      band: 'fitsWell',
    });
    expect(careerFit(base({ paths: { health: pathResult([{ careerId: 'pharmacist', fit: 0.5 }]) } as never }), 'pharmacist')).toMatchObject({ kind: 'path', band: 'fitsPartly' });
    expect(careerFit(base({}, { pharmacist: 64 }), 'pharmacist')).toEqual({ kind: 'discover', match: 64 });
  });

  it('shows nothing personal until Discover is finished', () => {
    expect(careerFit(base({}, { pharmacist: 64 }, 3), 'pharmacist')).toEqual({ kind: 'none' });
    expect(careerFit(base(), 'not_a_career')).toEqual({ kind: 'none' });
  });
});

describe('FitCard', () => {
  const wrap = (ui: ReactNode, locale: 'en' | 'ar' = 'en', gender: 'female' | null = null) =>
    render(
      <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en} timeZone="UTC">
        <AssessmentProvider gender={gender}>{ui}</AssessmentProvider>
      </NextIntlClientProvider>,
    );

  it('offers the career quest once the field is checked', () => {
    wrap(<FitCard careerId="pharmacist" fit={{ kind: 'path', fit: 0.58, band: 'fitsPartly', unlocked: true }} />);
    const card = screen.getByTestId('career-fit');
    expect(within(card).getByText('58%')).toBeTruthy();
    expect(within(card).getByText('Fits you partly')).toBeTruthy();
    const link = within(card).getByTestId('fit-action');
    expect(link.getAttribute('href')).toBe('/journey/health/pharmacist');
    expect(link.textContent).toMatch(/Try a day as Pharmacist/);
  });

  it('points to the field island from a Discover match, and to Discover with no data, in Arabic for a girl', () => {
    wrap(<FitCard careerId="pharmacist" fit={{ kind: 'discover', match: 64 }} />, 'ar', 'female');
    expect(screen.getByTestId('fit-action').getAttribute('href')).toBe('/journey/health');
    expect(screen.getByTestId('fit-action').textContent).toMatch(/اختبري جزيرة/);
    cleanup();
    wrap(<FitCard careerId="pharmacist" fit={{ kind: 'none' }} />);
    expect(screen.getByTestId('fit-action').getAttribute('href')).toBe('/journey/me');
  });
});
