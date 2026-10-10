import { getTranslations, setRequestLocale } from 'next-intl/server';

import { MockSwitcher } from '@/features/consent/mock-switcher';
import { SettingsView } from '@/features/consent/settings-view';
import { ConsentShell } from '@/features/consent/shell';
import { redirect } from '@/i18n/navigation';
import { isConsentMock } from '@/server/consent/mock';
import { getConsentRuntime } from '@/server/consent/runtime';

export const dynamic = 'force-dynamic';

// J8 (minimal): withdraw a permission. Works for any parent who granted one.
export default async function ConsentSettingsPage({ params }: PageProps<'/[locale]/family/settings'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Consent');

  const runtime = await getConsentRuntime();
  if (!runtime) return redirect({ href: '/login?next=/family/settings', locale });
  const consents = await runtime.service.listGuardianConsents(runtime.userId);
  return (
    <ConsentShell title={t('settings.title')}>
      <SettingsView consents={consents} />
      {isConsentMock() && <MockSwitcher next={`/${locale}/family/settings`} />}
    </ConsentShell>
  );
}
