// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { AssessmentProvider } from '@/features/assessment/ui-context';
import type { JourneyData } from '@/lib/journey/journey';
import { readJourney } from '@/lib/journey/verify';
import { MemoryKv } from '@/lib/local/kv';

import { RatingCard } from './rating-card';

vi.mock('@/lib/local/stats', () => ({ syncStats: vi.fn(async () => 'skipped') }));

afterEach(cleanup);

function setup({ rated = false, locale = 'en' as 'ar' | 'en', gender = null as 'female' | null } = {}) {
  const kv = new MemoryKv();
  const onChanged = vi.fn();
  const data = { rt: { userId: 'p1', device: { kv } }, journey: { v: 1, paths: {}, ...(rated ? { rating: { value: 4, at: 'x' } } : {}) } } as unknown as JourneyData;
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en} timeZone="UTC">
      <AssessmentProvider gender={gender}>
        <RatingCard data={data} onChanged={onChanged} />
      </AssessmentProvider>
    </NextIntlClientProvider>,
  );
  return { kv, onChanged };
}

describe('results rating card', () => {
  it('saves the chosen value on the phone and thanks the user', async () => {
    const { kv, onChanged } = setup();
    const send = screen.getByTestId('rating-send') as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.click(screen.getByTestId('rating-4'));
    fireEvent.click(send);
    await waitFor(() => expect(screen.getByTestId('rating-thanks')).toBeTruthy());
    expect((await readJourney(kv, 'p1')).rating?.value).toBe(4);
    expect(onChanged).toHaveBeenCalled();
  });

  it('is not asked again once answered, and "Not now" hides it', () => {
    setup({ rated: true });
    expect(screen.queryByTestId('rating')).toBeNull();
    cleanup();
    setup();
    fireEvent.click(screen.getByText(en.Journey.rating.later));
    expect(screen.queryByTestId('rating')).toBeNull();
  });

  it('uses the feminine Arabic forms for a female user', () => {
    setup({ locale: 'ar', gender: 'female' });
    expect(screen.getByText(ar.Journey.rating.questionF)).toBeTruthy();
    expect(screen.getByText('موافقة جدًا')).toBeTruthy();
  });
});
