'use client';

import { useTranslations } from 'next-intl';

import { LocaleSwitcher } from '@/components/locale-switcher';

export function LocalLoading() {
  const t = useTranslations('Local');
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md items-center justify-center px-4" aria-busy>
      <p role="status" className="text-muted-foreground">
        {t('loading')}
      </p>
    </main>
  );
}

/** Client counterpart of AssessmentBlocked for unexpected refusals in local mode. */
export function LocalBlocked({ code }: { code: string }) {
  const t = useTranslations('Assessment');
  const key = code === 'not_student' ? code : 'generic';
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 py-10">
      <header className="flex justify-end">
        <LocaleSwitcher />
      </header>
      <h1 className="text-2xl font-semibold">{t(`blocked.${key}.title`)}</h1>
      <p role="alert">{t(`blocked.${key}.body`)}</p>
    </main>
  );
}

/** Shown when the browser can't keep data (private window, blocked storage). */
export function StorageWarning() {
  const t = useTranslations('Local');
  return (
    <p role="note" className="mx-auto mt-3 w-full max-w-md rounded-xl border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {t('storageWarning')}
    </p>
  );
}
