import { getTranslations } from 'next-intl/server';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { ConsentGateCard } from '@/features/consent/consent-gate';
import { Link } from '@/i18n/navigation';

/** Shown instead of the assessment when the server refuses to start it (consent, role...). */
export async function AssessmentBlocked({ code }: { code: string }) {
  const t = await getTranslations('Assessment');
  const key = ['consent_required', 'not_student'].includes(code) ? code : 'generic';
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 py-10">
      <header className="flex justify-end">
        <LocaleSwitcher />
      </header>
      <h1 className="text-2xl font-semibold">{t(`blocked.${key}.title`)}</h1>
      <p role="alert">{t(`blocked.${key}.body`)}</p>
      {key === 'consent_required' && <ConsentGateCard />}
      <div>
        <Button asChild variant="outline">
          <Link href="/account">{t('blocked.account')}</Link>
        </Button>
      </div>
    </main>
  );
}
