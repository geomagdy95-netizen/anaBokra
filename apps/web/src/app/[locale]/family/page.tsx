import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Button } from '@/components/ui/button';
import { FamilyView } from '@/features/consent/family-view';
import { MockSwitcher } from '@/features/consent/mock-switcher';
import { ConsentShell } from '@/features/consent/shell';
import { Link, redirect } from '@/i18n/navigation';
import { isConsentMock } from '@/server/consent/mock';
import { getConsentRuntime } from '@/server/consent/runtime';

export const dynamic = 'force-dynamic';

// J3 (route B): the signed-in parent's family page.
export default async function FamilyPage({ params }: PageProps<'/[locale]/family'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Consent');

  const runtime = await getConsentRuntime();
  if (!runtime) return redirect({ href: '/login?next=/family', locale });
  if (runtime.role !== 'parent') {
    return (
      <ConsentShell title={t('family.title')}>
        <p>{t('family.notParent')}</p>
        <Button asChild variant="outline">
          <Link href="/account">{t('family.signIn')}</Link>
        </Button>
        {isConsentMock() && <MockSwitcher next={`/${locale}/family`} />}
      </ConsentShell>
    );
  }
  const members = await runtime.service.listChildren(runtime.userId);
  return (
    <ConsentShell title={t('family.title')}>
      <FamilyView members={members} defaultGuardianName="" />
      {isConsentMock() && <MockSwitcher next={`/${locale}/family`} />}
    </ConsentShell>
  );
}
