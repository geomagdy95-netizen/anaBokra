import { getTranslations, setRequestLocale } from 'next-intl/server';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { Link, redirect } from '@/i18n/navigation';
import { MockSwitcher } from '@/features/consent/mock-switcher';
import { createClient } from '@/lib/supabase/server';
import { isConsentMock } from '@/server/consent/mock';
import { getConsentRuntime } from '@/server/consent/runtime';

/** Signed-in identity for the page: the mock persona in dev mock mode, otherwise Supabase. */
async function loadAccount(): Promise<{ role: 'student' | 'parent'; contact: string } | null> {
  if (isConsentMock()) {
    const rt = await getConsentRuntime();
    return rt ? { role: rt.role === 'parent' ? 'parent' : 'student', contact: rt.phone ?? 'mock user' } : null;
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  // RLS: a user can read their own profile row.
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  return {
    role: profile?.role === 'parent' ? 'parent' : 'student',
    contact: data.user.phone ? `+${data.user.phone.replace(/^\+/, '')}` : (data.user.email ?? ''),
  };
}

export default async function AccountPage({ params }: PageProps<'/[locale]/account'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Auth.account');
  const tc = await getTranslations('Consent.nav');

  const account = await loadAccount();
  if (!account) redirect({ href: '/login?next=/account', locale });
  const { role, contact } = account!;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">{t('title')}</h1>
        <LocaleSwitcher />
      </header>
      <dl className="flex flex-col gap-3">
        <div>
          <dt className="text-sm text-muted-foreground">{t('contact')}</dt>
          <dd className="font-medium">
            <bdi dir="ltr" data-testid="contact">
              {contact}
            </bdi>
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t('role')}</dt>
          <dd className="font-medium" data-testid="role">
            {t(`roles.${role}`)}
          </dd>
        </div>
      </dl>
      <nav className="flex flex-col items-start gap-1">
        {role === 'student' ? (
          <>
            <Button asChild variant="link" className="px-0">
              <Link href="/ask-parent">{tc('askParent')}</Link>
            </Button>
            <Button asChild variant="link" className="px-0">
              <Link href="/school/join">{tc('joinClass')}</Link>
            </Button>
          </>
        ) : (
          <Button asChild variant="link" className="px-0">
            <Link href="/family">{tc('family')}</Link>
          </Button>
        )}
      </nav>
      {isConsentMock() && <MockSwitcher next={`/${locale}/account`} />}
      <div className="flex items-center gap-2">
        <form action="/api/auth/signout" method="post">
          <input type="hidden" name="locale" value={locale} />
          <Button type="submit" variant="outline">
            {t('signOut')}
          </Button>
        </form>
        <Button asChild variant="ghost">
          <Link href="/">{t('home')}</Link>
        </Button>
      </div>
    </main>
  );
}
