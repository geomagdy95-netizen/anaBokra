import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AskParent } from '@/features/consent/ask-parent';
import { MockSwitcher } from '@/features/consent/mock-switcher';
import { ConsentShell } from '@/features/consent/shell';
import { redirect } from '@/i18n/navigation';
import { getMockOutbox, isConsentMock } from '@/server/consent/mock';
import { MOCK_OTP } from '@/server/consent/constants';
import { getConsentRuntime } from '@/server/consent/runtime';

export const dynamic = 'force-dynamic';

// B7 + B8: teen asks a parent, then follows the status. Teen-only screen.
export default async function AskParentPage({ params }: PageProps<'/[locale]/ask-parent'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Consent');

  const runtime = await getConsentRuntime();
  if (!runtime) return redirect({ href: '/login?next=/ask-parent', locale });
  if (runtime.role !== 'student') {
    return (
      <ConsentShell title={t('teen.title')}>
        <p>{t('teen.notStudent')}</p>
        {runtime.mock && <MockSwitcher next={`/${locale}/ask-parent`} />}
      </ConsentShell>
    );
  }
  const status = await runtime.service.teenStatus(runtime.userId);
  const dev = runtime.mock ? { otp: MOCK_OTP, lastInviteText: getMockOutbox().last('consent_invite')?.text ?? null } : null;
  return (
    <ConsentShell title={t('teen.title')}>
      <AskParent minor={status.minor} consented={status.consented} invite={status.invite} dev={dev} />
      {isConsentMock() && <MockSwitcher next={`/${locale}/ask-parent`} />}
    </ConsentShell>
  );
}
