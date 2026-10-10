import { getTranslations, setRequestLocale } from 'next-intl/server';

import { MockSwitcher } from '@/features/consent/mock-switcher';
import { SchoolAdmin } from '@/features/consent/school-admin';
import { ConsentShell } from '@/features/consent/shell';
import { redirect } from '@/i18n/navigation';
import { isConsentMock } from '@/server/consent/mock';
import { getConsentRuntime } from '@/server/consent/runtime';

export const dynamic = 'force-dynamic';

// Route C: minimal school-staff screen (class codes + record consent). The full B2B dashboard is out of scope.
export default async function SchoolAdminPage({ params }: PageProps<'/[locale]/school/admin'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Consent');

  const runtime = await getConsentRuntime();
  if (!runtime) return redirect({ href: '/login?next=/school/admin', locale });
  const school = await runtime.service.schoolView(runtime.userId);
  return (
    <ConsentShell title={t('school.adminTitle')} wide>
      {school ? <SchoolAdmin school={school} /> : <p>{t('school.notStaff')}</p>}
      {isConsentMock() && <MockSwitcher next={`/${locale}/school/admin`} />}
    </ConsentShell>
  );
}
