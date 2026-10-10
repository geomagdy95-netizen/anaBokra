'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { errorClass, hintClass, inputClass, labelClass } from '@/features/auth/field-styles';
import { useRouter } from '@/i18n/navigation';
import type { SchoolView } from '@/server/consent/types';

import { errorText, postJson } from './api';
import { cardClass } from './shell';

/** Minimal school-admin screen (route C): class codes + record the school's consent per student. Not the B2B dashboard. */
export function SchoolAdmin({ school }: { school: SchoolView }) {
  const t = useTranslations('Consent');
  const locale = useLocale();
  const router = useRouter();
  const [cohort, setCohort] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [rep, setRep] = useState('');
  const [method, setMethod] = useState('paper_form');
  const [attest, setAttest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function newCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await postJson('/api/consent/school/codes', { cohort });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setCohort('');
    router.refresh();
  }

  async function record(e: FormEvent, studentId: string) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await postJson('/api/consent/school/consents', { studentId, method, representativeName: rep, confirmed: attest, locale });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setSaved(true);
    setOpen(null);
    setAttest(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <p>{t('school.adminIntro')}</p>
      <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">{t('draftNotice')}</p>
      <h2 className="text-lg font-semibold">{school.organizationName}</h2>

      <section className="flex flex-col gap-3">
        <h3 className="font-semibold">{t('school.codes')}</h3>
        <ul className="flex flex-col gap-1 text-sm" data-testid="class-codes">
          {school.joinCodes.map((c) => (
            <li key={c.code}>
              <bdi dir="ltr" className="font-mono tracking-widest">
                {c.code}
              </bdi>
              {c.cohort ? ` · ${c.cohort}` : ''}
            </li>
          ))}
        </ul>
        <form onSubmit={newCode} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cohort" className={labelClass}>
              {t('school.cohortLabel')}
            </label>
            <input id="cohort" className={inputClass} value={cohort} onChange={(e) => setCohort(e.target.value)} maxLength={100} />
          </div>
          <Button type="submit" variant="outline" disabled={busy}>
            {t('school.createCode')}
          </Button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="font-semibold">{t('school.students')}</h3>
        {school.students.length === 0 && <p className={hintClass}>{t('school.noStudents')}</p>}
        {saved && (
          <p role="status" className="text-sm" data-testid="school-saved">
            {t('school.saved')}
          </p>
        )}
        {school.students.map((s) => (
          <article key={s.studentId} className={cardClass} data-testid="school-student">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">
                {s.name || s.studentId.slice(0, 8)}
                {s.cohort ? ` · ${s.cohort}` : ''}
              </span>
              <span className="text-sm" data-testid="school-student-state">
                {s.consent ? t('school.consented') : t('school.missing')}
              </span>
            </div>
            {s.consent ? (
              <WithdrawButton consentId={s.consent.id} />
            ) : open === s.studentId ? (
              <form onSubmit={(e) => record(e, s.studentId)} className="flex flex-col gap-3">
                <label htmlFor={`rep-${s.studentId}`} className={labelClass}>
                  {t('school.repLabel')}
                </label>
                <input id={`rep-${s.studentId}`} className={inputClass} value={rep} onChange={(e) => setRep(e.target.value)} maxLength={100} />
                <label htmlFor={`method-${s.studentId}`} className={labelClass}>
                  {t('school.methodLabel')}
                </label>
                <select id={`method-${s.studentId}`} className={inputClass} value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="paper_form">{t('school.methodPaper')}</option>
                  <option value="school_attestation">{t('school.methodAttest')}</option>
                </select>
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" className="mt-1 size-5 accent-primary" checked={attest} onChange={(e) => setAttest(e.target.checked)} />
                  <span>{t('school.attest')}</span>
                </label>
                {error && (
                  <p role="alert" className={errorClass}>
                    {errorText(t, error)}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button type="submit" disabled={busy || !attest || rep.trim().length < 2}>
                    {t('school.save')}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setOpen(null)}>
                    {t('teen.cancel')}
                  </Button>
                </div>
              </form>
            ) : (
              <div>
                <Button type="button" variant="outline" onClick={() => setOpen(s.studentId)}>
                  {t('school.record')}
                </Button>
              </div>
            )}
          </article>
        ))}
      </section>
      {error && open === null && (
        <p role="alert" className={errorClass}>
          {errorText(t, error)}
        </p>
      )}
    </div>
  );
}

function WithdrawButton({ consentId }: { consentId: string }) {
  const t = useTranslations('Consent');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await postJson('/api/consent/withdraw', { consentId });
          setBusy(false);
          router.refresh();
        }}
      >
        {t('school.withdraw')}
      </Button>
    </div>
  );
}
