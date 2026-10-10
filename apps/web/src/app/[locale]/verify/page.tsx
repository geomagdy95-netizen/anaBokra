import { getTranslations, setRequestLocale } from 'next-intl/server';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { VerifyForm } from '@/features/auth/verify-form';

export default async function VerifyPage({ params }: PageProps<'/[locale]/verify'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Auth.verify');

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between">
        <span className="text-xl font-bold text-primary">{(await getTranslations('Home'))('title')}</span>
        <LocaleSwitcher />
      </header>
      <h1 className="text-3xl font-semibold leading-tight">{t('title')}</h1>
      <VerifyForm />
    </main>
  );
}
