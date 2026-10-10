import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ParentFlow } from '@/features/consent/parent-flow';
import { ConsentShell, cardClass } from '@/features/consent/shell';
import type { Locale } from '@/i18n/routing';
import { MOCK_OTP } from '@/server/consent/constants';
import { getGuardianAuth } from '@/server/consent/guardian-auth';
import { isConsentMock } from '@/server/consent/mock';
import { getPublicConsentService } from '@/server/consent/runtime';
import { hashToken } from '@/server/consent/token';
import { ConsentError } from '@/server/consent/types';

export const dynamic = 'force-dynamic';

// J1 + J2: the parent opens the WhatsApp link. Server render is side-effect free (link previews must not mark it "opened").
export const metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' as const };

export default async function ConsentLandingPage({ params }: PageProps<'/[locale]/consent/[token]'>) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Consent');

  const service = await getPublicConsentService();
  let invite;
  try {
    invite = await service.peekInvite(token, locale as Locale);
  } catch (e) {
    if (!(e instanceof ConsentError)) throw e;
    return (
      <ConsentShell title={t('parent.invalidTitle')}>
        <section className={cardClass} data-testid="invite-invalid">
          <p>{t('parent.invalidBody')}</p>
        </section>
      </ConsentShell>
    );
  }
  const live = invite.status === 'pending' || invite.status === 'opened';
  const phone = live ? await service.invitedPhone(token) : null;
  const verified = phone ? (await getGuardianAuth().current(phone, hashToken(token))) !== null : false;

  return (
    <ConsentShell title={t('parent.title', { teen: invite.teen })}>
      <ParentFlow token={token} teen={invite.teen} maskedPhone={invite.maskedPhone} status={invite.status} verified={verified} mockOtp={isConsentMock() ? MOCK_OTP : null} />
    </ConsentShell>
  );
}
