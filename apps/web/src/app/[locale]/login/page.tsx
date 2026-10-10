import { getTranslations, setRequestLocale } from 'next-intl/server';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { LoginForm } from '@/features/auth/login-form';
import { redirect } from '@/i18n/navigation';
import { getUser } from '@/lib/supabase/server';
import { safeNextPath } from '@/server/auth/roles';
import { isConsentMock } from '@/server/consent/mock';

export default async function LoginPage({ params, searchParams }: PageProps<'/[locale]/login'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const next = typeof query.next === 'string' ? safeNextPath(query.next) : undefined;
  const t = await getTranslations('Auth.login');

  // Dev mock mode has a fake signed-in persona and no Supabase, so there is nothing to log into.
  if (isConsentMock() || (await getUser())) redirect({ href: next ?? '/account', locale });

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between">
        <span className="text-xl font-bold text-primary">{(await getTranslations('Home'))('title')}</span>
        <LocaleSwitcher />
      </header>
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold leading-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </section>
      <LoginForm next={next} initialError={query.error === 'oauth' ? 'oauth' : undefined} />
    </main>
  );
}
