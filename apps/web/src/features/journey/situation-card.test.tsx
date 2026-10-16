// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { AssessmentProvider } from '@/features/assessment/ui-context';

import { SituationView } from './situation-card';

afterEach(cleanup);

const wrap = (ui: ReactNode, locale: 'en' | 'ar' = 'en', gender: 'female' | null = null) =>
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en} timeZone="UTC">
      <AssessmentProvider gender={gender}>{ui}</AssessmentProvider>
    </NextIntlClientProvider>,
  );

const hurdles = [
  { kind: 'cost', level: 3 },
  { kind: 'interview', level: 3 },
];

describe('SituationView', () => {
  it('invites, then saves only what was answered', async () => {
    const onSave = vi.fn(async () => {});
    wrap(<SituationView situation={undefined} hurdles={hurdles} onSave={onSave} />);
    fireEvent.click(screen.getByTestId('situation-open'));
    expect((screen.getByTestId('situation-save') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Saved on this device only.')).toBeTruthy();
    fireEvent.click(screen.getByTestId('budget-public'));
    fireEvent.click(screen.getByTestId('situation-save'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ budget: 'public', region: undefined, work: undefined }));
  });

  it('marks the hurdles that weigh more, and can forget the answers', async () => {
    const onSave = vi.fn(async () => {});
    wrap(<SituationView situation={{ budget: 'public', at: '' }} hurdles={hurdles} onSave={onSave} />);
    expect(screen.getByTestId('situation-affects').textContent).toMatch(/Cost/);
    expect(screen.getByTestId('situation-affects').textContent).not.toMatch(/Interviews/);
    fireEvent.click(screen.getByTestId('situation-forget'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(null));
  });

  it('speaks to a girl in Arabic', () => {
    wrap(<SituationView situation={undefined} hurdles={hurdles} onSave={vi.fn()} />, 'ar', 'female');
    expect(screen.getByTestId('situation-open').textContent).toBe('جاوبي');
  });
});
