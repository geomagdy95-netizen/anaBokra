import { getTranslations, setRequestLocale } from 'next-intl/server';

import { MockSwitcher } from '@/features/consent/mock-switcher';
import { SchoolJoin } from '@/features/consent/school-join';
import { ConsentShell } from '@/features/consent/shell';
import { redirect } from '@/i18n/navigation';
import { isConsentMock } from '@/server/consent/mock';
import { getConsentRuntime } from '@/server/consent/runtime';

export const dynamic = 'force-dynamic';

// B9: students join a school with a class code.
export default async function SchoolJoinPage({ params }: PageProps<'/[locale]/school/join'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Consent');

  const runtime = await getConsentRuntime();
  if (!runtime) return redirect({ href: '/login?next=/school/join', locale });
  return (
    <ConsentShell title={t('school.joinTitle')}>
      {runtime.role === 'student' ? <SchoolJoin /> : <p>{t('teen.notStudent')}</p>}
      {isConsentMock() && <MockSwitcher next={`/${locale}/school/join`} />}
    </ConsentShell>
  );
}
