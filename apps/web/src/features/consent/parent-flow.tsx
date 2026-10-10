'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { errorClass, hintClass, inputClass, labelClass } from '@/features/auth/field-styles';
import { Link } from '@/i18n/navigation';
import { RELATIONS, REQUIRED_CHECKS } from '@/server/consent/constants';
import type { InviteStatus } from '@/server/consent/state';

import { errorText, postJson } from './api';
import { ConsentChecks } from './checks';
import { cardClass } from './shell';

type Step = 'send' | 'code' | 'review' | 'decline' | 'granted' | 'declined';

interface Props {
  token: string;
  teen: string;
  maskedPhone: string;
  status: InviteStatus;
  /** The signed-in session already proved the invited number (e.g. a refresh after the OTP step). */
  verified: boolean;
  /** Dev (mock) mode only: the fake OTP, shown so the flow is testable. */
  mockOtp: string | null;
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="list-disc ps-5 text-sm text-muted-foreground">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </section>
  );
}

/** J1 (verify the parent's number by OTP) + J2 (what is collected / seen / private, checkboxes, confirm or decline). */
export function ParentFlow({ token, teen, maskedPhone, status, verified, mockOtp }: Props) {
  const t = useTranslations('Consent');
  const locale = useLocale();
  const format = useFormatter();
  const base = `/api/consent/invite/${token}`;

  const [step, setStep] = useState<Step>(verified ? 'review' : 'send');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [relation, setRelation] = useState<string>('mother');
  const [checks, setChecks] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [grantedAt, setGrantedAt] = useState<string | null>(null);

  // Opened is recorded from the browser, so a WhatsApp link preview (server fetch) never counts as "opened".
  useEffect(() => {
    void postJson(`${base}/open`, { locale });
  }, [base, locale]);

  if (status !== 'pending' && status !== 'opened') {
    const key = status === 'expired' ? 'expired' : status === 'granted' || status === 'declined' ? 'used' : 'invalid';
    return (
      <section className={cardClass} data-testid={`invite-${key}`}>
        <h2 className="font-semibold">{t(`parent.${key}Title`)}</h2>
        <p className="text-sm">{t(`parent.${key}Body`, { teen })}</p>
      </section>
    );
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    await fn();
    setBusy(false);
  };

  const sendCode = () =>
    run(async () => {
      const res = await postJson(`${base}/otp`, { locale });
      if (!res.ok) return setError(res.error);
      setStep('code');
    });

  const verify = (e: FormEvent) => {
    e.preventDefault();
    return run(async () => {
      const res = await postJson(`${base}/verify`, { code, locale });
      if (!res.ok) return setError(res.error);
      setStep('review');
    });
  };

  const allRequired = REQUIRED_CHECKS.every((c) => checks.includes(c));
  const confirm = (e: FormEvent) => {
    e.preventDefault();
    return run(async () => {
      const res = await postJson<{ grantedAt: string }>(`${base}/confirm`, { name, relation, checks, locale });
      if (!res.ok) return setError(res.error);
      setGrantedAt(res.grantedAt);
      setStep('granted');
    });
  };

  const decline = () =>
    run(async () => {
      const res = await postJson(`${base}/decline`, { locale });
      if (!res.ok) return setError(res.error);
      setStep('declined');
    });

  const errorLine = error && (
    <p role="alert" className={errorClass}>
      {errorText(t, error)}
    </p>
  );

  if (step === 'granted') {
    return (
      <section className={cardClass} data-testid="parent-granted">
        <h2 className="font-semibold">{t('parent.grantedTitle')}</h2>
        <p className="text-sm">{t('parent.grantedBody', { date: grantedAt ? format.dateTime(new Date(grantedAt), { dateStyle: 'long' }) : '' })}</p>
        <Button asChild>
          <Link href="/family">{t('parent.familyCta')}</Link>
        </Button>
      </section>
    );
  }
  if (step === 'declined') {
    return (
      <section className={cardClass} data-testid="parent-declined">
        <h2 className="font-semibold">{t('parent.declinedTitle')}</h2>
        <p className="text-sm">{t('parent.declinedBody', { teen })}</p>
      </section>
    );
  }

  if (step === 'send' || step === 'code') {
    return (
      <section className={cardClass}>
        <h2 className="font-semibold">{t('parent.verifyTitle')}</h2>
        <p className="text-sm">{t('parent.verifyBody', { phone: maskedPhone })}</p>
        {step === 'send' ? (
          <>
            {errorLine}
            <Button type="button" size="lg" disabled={busy} onClick={sendCode}>
              {busy ? t('parent.sending') : t('parent.sendCode')}
            </Button>
          </>
        ) : (
          <form onSubmit={verify} className="flex flex-col gap-3" noValidate>
            <p className={hintClass}>{t('parent.codeSent', { phone: maskedPhone })}</p>
            {mockOtp && (
              <p className="rounded border border-dashed p-2 text-xs" data-testid="mock-otp">
                {t('teen.devOtp', { code: mockOtp })}
              </p>
            )}
            <label htmlFor="otp" className={labelClass}>
              {t('parent.codeLabel')}
            </label>
            <input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              dir="ltr"
              className={`${inputClass} text-center text-2xl tracking-[0.5em]`}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoFocus
            />
            {errorLine}
            <Button type="submit" size="lg" disabled={busy || code.length !== 6}>
              {busy ? t('parent.verifying') : t('parent.verify')}
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={sendCode}>
              {t('parent.resendCode')}
            </Button>
          </form>
        )}
      </section>
    );
  }

  // step === 'review' | 'decline'
  return (
    <form onSubmit={confirm} className="flex flex-col gap-6" noValidate>
      <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground" data-testid="draft-notice">
        {t('draftNotice')}
      </p>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">{t('parent.step1')}</h2>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="guardian-name" className={labelClass}>
            {t('parent.nameLabel')}
          </label>
          <input id="guardian-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="guardian-relation" className={labelClass}>
            {t('parent.relationLabel', { teen })}
          </label>
          <select id="guardian-relation" className={inputClass} value={relation} onChange={(e) => setRelation(e.target.value)}>
            {RELATIONS.map((r) => (
              <option key={r} value={r}>
                {t(`relations.${r}`)}
              </option>
            ))}
          </select>
        </div>
        <p className={hintClass}>
          {t('parent.verifiedNumber')}:{' '}
          <bdi dir="ltr" className="font-medium text-foreground">
            {maskedPhone}
          </bdi>
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-semibold">{t('parent.step2')}</h2>
        <p className="text-sm">{t('parent.intro', { teen })}</p>
        <Bullets title={t('parent.collectedTitle')} items={t.raw('parent.collected') as string[]} />
        <Bullets title={t('parent.seesTitle')} items={(t.raw('parent.sees') as string[]).map((s) => s.replaceAll('{teen}', teen))} />
        <Bullets title={t('parent.privateTitle')} items={t.raw('parent.private') as string[]} />
        <p className={hintClass}>{t('parent.links')}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">{t('parent.step3')}</h2>
        <ConsentChecks teen={teen} value={checks} onChange={setChecks} />
      </section>

      {errorLine}

      {step === 'decline' ? (
        <div role="alertdialog" aria-label={t('parent.decline')} className={cardClass}>
          <p className="text-sm">{t('parent.declineConfirm', { teen })}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="destructive" disabled={busy} onClick={decline}>
              {t('parent.declineYes')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStep('review')}>
              {t('parent.declineBack')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="lg" disabled={busy || !allRequired || name.trim().length < 2}>
            {busy ? t('parent.agreeing') : t('parent.agree')}
          </Button>
          <Button type="button" variant="outline" size="lg" disabled={busy} onClick={() => setStep('decline')}>
            {t('parent.decline')}
          </Button>
        </div>
      )}
    </form>
  );
}
