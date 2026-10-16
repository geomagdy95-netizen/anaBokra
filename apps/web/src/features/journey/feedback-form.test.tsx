// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '../../../messages/en.json';
import { AssessmentProvider } from '@/features/assessment/ui-context';
import type { LocalRuntime } from '@/lib/local/runtime';

import { FeedbackForm } from './feedback-form';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const rt = {
  userId: 'p1',
  profile: { ageBand: '18-20', locale: 'en', event: null },
  device: { getProfile: async () => ({ ageBand: '18-20', locale: 'en', event: { code: 'uni-1' } }) },
  service: { getLatestResult: async () => ({ context: { stage: 'university' } }) },
} as unknown as LocalRuntime;

const wrap = (ui: ReactNode) =>
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
      <AssessmentProvider gender={null}>{ui}</AssessmentProvider>
    </NextIntlClientProvider>,
  );

describe('FeedbackForm', () => {
  it('sends only what was chosen, cleaned, with the coarse sender fields, then thanks', async () => {
    const fetchMock = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    wrap(<FeedbackForm rt={rt} screen="results" />);
    expect((screen.getByTestId('feedback-send') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('face-4'));
    fireEvent.click(screen.getByTestId('liked-map'));
    fireEvent.click(screen.getByTestId('confusing-hurdles'));
    fireEvent.change(screen.getByTestId('feedback-text'), { target: { value: 'Great map! mail me at a@b.com' } });
    fireEvent.click(screen.getByTestId('feedback-send'));
    await waitFor(() => expect(screen.getByTestId('feedback-thanks')).toBeTruthy());
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toEqual({
      v: 1,
      ageBand: '18-20',
      stage: 'university',
      locale: 'en',
      eventCode: 'UNI-1',
      kind: 'feedback',
      screen: 'results',
      career: null,
      rating: 4,
      liked: ['map'],
      confusing: ['hurdles'],
      text: 'Great map! mail me at […]',
    });
  });
});
