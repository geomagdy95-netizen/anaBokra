// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ar from '../../../messages/ar.json';
import { DeviceStore } from '@/lib/local/device';
import { MemoryKv } from '@/lib/local/kv';

const kv = new MemoryKv();
vi.mock('@/lib/local/kv', async (orig) => ({ ...(await orig<typeof import('@/lib/local/kv')>()), deviceKv: async () => kv }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => '/journey',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock('@/features/art/task-art-view', () => ({ TaskArt: () => null }));

import { FirstStart } from './first-start';

afterEach(cleanup);

describe('FirstStart', () => {
  it('welcomes, asks age and the promise, then name and address, skips the session and ends with the tour', async () => {
    const onDone = vi.fn();
    render(
      <NextIntlClientProvider locale="ar" messages={ar} timeZone="UTC">
        <FirstStart onDone={onDone} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByTestId('welcome').textContent).toContain('اكتشف المهنة اللي على مقاسك');
    fireEvent.click(screen.getByTestId('welcome-start'));
    expect(screen.getByTestId('onboarding-progress').getAttribute('aria-label')).toBe('خطوة 1 من 5');

    fireEvent.click(screen.getByTestId('age-18-20'));
    const go = screen.getByTestId('accept-continue') as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.click(screen.getByTestId('accept'));
    fireEvent.click(go);

    await waitFor(() => expect(screen.getByTestId('profile-setup')).toBeTruthy());
    // Nothing typed: the button says "skip", and works.
    expect(screen.getByTestId('profile-save').textContent).toBe('تخطّى دلوقتي');
    fireEvent.click(screen.getAllByTestId('nickname-suggestion')[0]!);
    expect((screen.getByTestId('nickname') as HTMLInputElement).value).toBe('صاروخ');
    fireEvent.click(screen.getByTestId('address-female'));
    fireEvent.click(screen.getByTestId('profile-save'));

    await waitFor(() => expect(screen.getByText('تخطي')).toBeTruthy());
    fireEvent.click(screen.getByText('تخطي'));
    await waitFor(() => expect(screen.getByTestId('onboarding-tour')).toBeTruthy());
    // She chose to be addressed as a girl, so the tour already speaks that way.
    expect(screen.getByTestId('onboarding-tour').textContent).toContain('إنتي بتحبي إيه');
    fireEvent.click(screen.getByTestId('tour-done'));
    expect(onDone).toHaveBeenCalledOnce();

    const device = new DeviceStore(kv);
    const profile = await device.getProfile((await device.getActiveId())!);
    expect(profile).toMatchObject({ displayName: 'صاروخ', gender: 'female', ageBand: '18-20' });
    expect(profile?.consent?.stats).toBe(false);
  });
});
