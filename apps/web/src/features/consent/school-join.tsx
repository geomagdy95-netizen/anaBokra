'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { errorClass, hintClass, inputClass, labelClass } from '@/features/auth/field-styles';
import { Link } from '@/i18n/navigation';

import { errorText, postJson } from './api';
import { cardClass } from './shell';

/** B9: a student joins a school with a class code. Joining never grants consent. */
export function SchoolJoin() {
  const t = useTranslations('Consent');
  const locale = useLocale();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<{ organizationName: string; cohort: string | null } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await postJson<{ school: { organizationName: string; cohort: string | null } }>('/api/consent/school/join', { code, locale });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setJoined(res.school);
  }

  if (joined) {
    return (
      <section className={cardClass} data-testid="class-joined">
        <h2 className="font-semibold">{t('school.joined', { school: joined.organizationName })}</h2>
        {joined.cohort && <p className="text-sm">{t('school.joinedCohort', { cohort: joined.cohort })}</p>}
        <p className={hintClass}>{t('school.joinNote')}</p>
        <Button asChild variant="outline">
          <Link href="/ask-parent">{t('nav.askParent')}</Link>
        </Button>
      </section>
    );
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <p>{t('school.joinIntro')}</p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="class-code" className={labelClass}>
          {t('school.codeLabel')}
        </label>
        <input id="class-code" dir="ltr" autoCapitalize="characters" autoComplete="off" className={`${inputClass} uppercase tracking-widest`} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={12} />
      </div>
      {error && (
        <p role="alert" className={errorClass}>
          {errorText(t, error)}
        </p>
      )}
      <Button type="submit" size="lg" disabled={busy || code.trim().length < 6}>
        {busy ? t('school.joining') : t('school.join')}
      </Button>
      <p className={hintClass}>{t('school.joinNote')}</p>
    </form>
  );
}
