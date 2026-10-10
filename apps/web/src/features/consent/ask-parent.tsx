'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { errorClass, hintClass, inputClass, labelClass } from '@/features/auth/field-styles';
import { Link, useRouter } from '@/i18n/navigation';
import type { InviteView } from '@/server/consent/types';

import { errorText, postJson } from './api';
import { cardClass } from './shell';

export interface DevInfo {
  otp: string;
  lastInviteText: string | null;
}

type Mode = 'form' | 'change';

/** B7 + B8: the teen asks a parent (phone + who), then follows the status (sent / opened), resends, or changes the number. */
export function AskParent({ minor, consented, invite: initial, dev }: { minor: boolean; consented: boolean; invite: InviteView | null; dev: DevInfo | null }) {
  const t = useTranslations('Consent');
  const locale = useLocale();
  const router = useRouter();
  const format = useFormatter();
  const [invite, setInvite] = useState<InviteView | null>(initial);
  const [mode, setMode] = useState<Mode>('form');
  const [phone, setPhone] = useState('');
  const [hint, setHint] = useState('mother');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!minor) {
    return (
      <section className={cardClass}>
        <h2 className="font-semibold">{t('teen.adultTitle')}</h2>
        <p>{t('teen.adultBody')}</p>
      </section>
    );
  }
  if (consented || invite?.status === 'granted') {
    return (
      <section className={cardClass} data-testid="consent-done">
        <h2 className="font-semibold">{t('teen.doneTitle')}</h2>
        <p>{t('teen.doneBody')}</p>
        <Button asChild>
          <Link href="/assessment">{t('teen.doneCta')}</Link>
        </Button>
      </section>
    );
  }

  const when = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });
  const live = invite && (invite.status === 'pending' || invite.status === 'opened');
  const showForm = !live || mode === 'change';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res =
      mode === 'change' && invite
        ? await postJson<{ invite: InviteView }>(`/api/consent/invites/${invite.id}/change-number`, { phone, locale })
        : await postJson<{ invite: InviteView }>('/api/consent/invites', { phone, hint, locale });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setInvite(res.invite);
    setMode('form');
    setPhone('');
    router.refresh(); // refreshes the dev outbox panel
  }

  async function resend() {
    if (!invite) return;
    setBusy(true);
    setError(null);
    const res = await postJson<{ invite: InviteView }>(`/api/consent/invites/${invite.id}/resend`, { locale });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setInvite(res.invite);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <p>{t('teen.intro')}</p>
      <ul className="list-disc ps-5 text-sm text-muted-foreground">
        {(t.raw('teen.bullets') as string[]).map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>

      {invite && (
        <section className={cardClass} aria-live="polite" data-testid="invite-status" data-status={invite.status}>
          <h2 className="font-semibold">{t(`teen.status.${invite.status}`)}</h2>
          <p className="text-sm">{t(`teen.statusBody.${invite.status}`, { phone: invite.maskedPhone })}</p>
          {live && (
            <>
              <p className={hintClass}>
                {invite.sentAt && <>{t('teen.sentAt', { when: when(invite.sentAt) })} · </>}
                {t('teen.expiresAt', { when: when(invite.expiresAt) })}
              </p>
              <p className={hintClass}>
                {t('teen.resendsLeft', { count: invite.resendsLeft })}
                {invite.resendsLeft === 0 && invite.retryAt ? ` · ${t('teen.resendLater', { when: when(invite.retryAt) })}` : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={busy || invite.resendsLeft === 0} onClick={resend}>
                  {busy ? t('teen.resending') : t('teen.resend')}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setMode(mode === 'change' ? 'form' : 'change')}>
                  {t('teen.changeNumber')}
                </Button>
              </div>
              <p className={hintClass}>{t('teen.resendNote')}</p>
            </>
          )}
        </section>
      )}

      {showForm && (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="parent-phone" className={labelClass}>
              {mode === 'change' ? t('teen.newPhoneLabel') : t('teen.phoneLabel')}
            </label>
            <input
              id="parent-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              dir="ltr"
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <p className={hintClass}>{t('teen.phoneHint')}</p>
          </div>
          {mode === 'form' && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="parent-hint" className={labelClass}>
                {t('teen.hintLabel')}
              </label>
              <select id="parent-hint" className={inputClass} value={hint} onChange={(e) => setHint(e.target.value)}>
                {(['mother', 'father', 'legal_guardian', 'other'] as const).map((r) => (
                  <option key={r} value={r}>
                    {t(`relations.${r}`)}
                  </option>
                ))}
              </select>
            </div>
          )}
          {error && (
            <p role="alert" className={errorClass}>
              {errorText(t, error)}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="lg" disabled={busy || phone.trim().length < 8}>
              {busy ? t('teen.sending') : mode === 'change' ? t('teen.changeSubmit') : invite ? t('teen.askAgain') : t('teen.send')}
            </Button>
            {mode === 'change' && (
              <Button type="button" variant="ghost" size="lg" onClick={() => setMode('form')}>
                {t('teen.cancel')}
              </Button>
            )}
          </div>
        </form>
      )}
      {!showForm && error && (
        <p role="alert" className={errorClass}>
          {errorText(t, error)}
        </p>
      )}

      {dev && (
        <section className="rounded-md border border-dashed p-3 text-xs" data-testid="dev-outbox">
          <strong>{t('teen.devTitle')}</strong>
          <pre className="mt-2 whitespace-pre-wrap break-words" dir="auto">
            {dev.lastInviteText ?? '-'}
          </pre>
          <p className="mt-2">{t('teen.devOtp', { code: dev.otp })}</p>
        </section>
      )}
    </div>
  );
}
