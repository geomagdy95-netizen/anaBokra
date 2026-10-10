// @vitest-environment jsdom
import { careers, clusters, industryById } from '@anabokra/content';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getCareerPage } from '@/server/content/career-pages';

import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';

import { buildCatalog } from './catalog';
import { CareerBrowser } from './career-browser';

// next-intl's navigation helpers need the Next.js runtime; a plain anchor is enough for markup tests.
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

const items = buildCatalog(careers, clusters, getCareerPage, (id) => industryById(id)?.outlook.trend ?? null);

function mount(locale: 'ar' | 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en} timeZone="UTC">
      <CareerBrowser items={items} clusterOptions={clusters} />
    </NextIntlClientProvider>,
  );
}

describe('CareerBrowser', () => {
  it('lists every career and narrows by an Arabic query with diacritics', () => {
    mount('ar');
    expect(screen.getAllByTestId('career-card')).toHaveLength(careers.length);
    const name = careers.find((c) => c.id === 'software_engineer')!.name.ar;
    const withMarks = name.split(' ').map((w) => `${w[0]}َ${w.slice(1)}`).join(' ');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: withMarks } });
    const cards = screen.getAllByTestId('career-card');
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.some((c) => within(c).queryByText(name))).toBe(true);
  });

  it('shows an empty state with a reset action', () => {
    mount('en');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzzzqqq' } });
    expect(screen.getByText('No careers match these filters.')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!);
    expect(screen.getAllByTestId('career-card')).toHaveLength(careers.length);
  });

  it('limits compare to 3: the fourth checkbox is disabled and Compare links to the chosen ids', () => {
    mount('en');
    const boxes = () => screen.getAllByRole('checkbox', { name: /^Compare/ }) as HTMLInputElement[];
    fireEvent.click(boxes()[0]!);
    expect(screen.getByRole('button', { name: 'Compare' }).hasAttribute('disabled')).toBe(true); // needs 2
    fireEvent.click(boxes()[1]!);
    fireEvent.click(boxes()[2]!);
    const unchecked = boxes().filter((b) => !b.checked);
    expect(unchecked.length).toBe(careers.length - 3);
    expect(unchecked.every((b) => b.disabled)).toBe(true);
    expect(screen.getByText(/up to 3 careers/)).toBeTruthy();
    const go = screen.getByRole('link', { name: 'Compare' });
    expect(go.getAttribute('href')).toMatch(/\/careers\/compare\?ids=[a-z_]+,[a-z_]+,[a-z_]+$/);
    // Unchecking frees a slot again.
    fireEvent.click(boxes().find((b) => b.checked)!);
    expect(boxes().filter((b) => !b.checked && b.disabled)).toHaveLength(0);
  });
});
