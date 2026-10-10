// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';

import { ConsentGate } from './consent-gate';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

const wrap = (ui: ReactNode, locale: 'ar' | 'en' = 'en') =>
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en} timeZone="UTC">
      {ui}
    </NextIntlClientProvider>,
  );

describe('ConsentGate', () => {
  it('shows the feature untouched when not locked', () => {
    wrap(
      <ConsentGate locked={false}>
        <button>Save career</button>
      </ConsentGate>,
    );
    expect(screen.getByRole('button', { name: 'Save career' })).toBeTruthy();
    expect(screen.queryByTestId('consent-gate')).toBeNull();
  });

  it('overlays locked features: content is inert and hidden from assistive tech, CTA leads to the parent flow', () => {
    wrap(
      <ConsentGate locked>
        <button>Save career</button>
      </ConsentGate>,
    );
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.textContent).toContain('A parent needs to say yes first');
    expect(screen.getByRole('link', { name: 'Ask my parent' }).getAttribute('href')).toBe('/ask-parent');
    expect(screen.getByRole('link', { name: 'Join with a class code' }).getAttribute('href')).toBe('/school/join');
    const dimmed = screen.getByText('Save career').closest('[aria-hidden="true"]') as HTMLElement;
    expect(dimmed).toBeTruthy();
    expect(dimmed.hasAttribute('inert')).toBe(true);
  });

  it('is available in Arabic', () => {
    wrap(
      <ConsentGate locked>
        <p>x</p>
      </ConsentGate>,
      'ar',
    );
    expect(screen.getByRole('link', { name: ar.Consent.gate.cta })).toBeTruthy();
  });
});
