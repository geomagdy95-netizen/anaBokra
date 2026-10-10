'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { errorClass, hintClass, inputClass, labelClass } from '@/features/auth/field-styles';
import { useRouter } from '@/i18n/navigation';
import type { WithdrawEffects } from '@/server/consent/service';
import type { ConsentRecord } from '@/server/consent/types';

import { errorText, postJson } from './api';
import { cardClass } from './shell';

/** J8 (minimal): the guardian's permissions, with withdrawal and what it changes (paused session, locked features). */
export function SettingsView({ consents }: { consents: ConsentRecord[] }) {
  const t = useTranslations('Consent');
  const locale = useLocale();
  const router = useRouter();
  const format = useFormatter();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ teen: string; effects: WithdrawEffects } | null>(null);
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium' });
  const teenOf = (c: ConsentRecord) => c.studentName.trim().split(/\s+/)[0] || t('notice.fallbackTeen');

  async function withdraw(c: ConsentRecord) {
    setBusy(true);
    setError(null);
    const res = await postJson<{ effects: WithdrawEffects }>('/api/consent/withdraw', { consentId: c.id, reason, locale });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setResult({ teen: teenOf(c), effects: res.effects });
    setConfirming(null);
    setReason('');
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <p>{t('settings.intro')}</p>

      {result && (
        <section className={cardClass} role="status" data-testid="withdraw-result">
          <h2 className="font-semibold">{t('settings.doneTitle')}</h2>
          <h3 className="text-sm font-medium">{t('settings.effectsTitle')}</h3>
          <ul className="list-disc ps-5 text-sm">
            {result.effects.assessmentPaused && <li>{t('settings.effectPaused')}</li>}
            {result.effects.featuresLocked && <li>{t('settings.effectLocked')}</li>}
            {result.effects.stillCovered && <li>{t('settings.effectCovered', { teen: result.teen })}</li>}
            <li>{t('settings.effectRecord')}</li>
          </ul>
          <p className={hintClass}>{t('settings.again')}</p>
        </section>
      )}

      {consents.length === 0 && <p className={hintClass}>{t('settings.empty')}</p>}
      {consents.map((c) => (
        <article key={c.id} className={cardClass} data-testid="consent-card">
          <h2 className="font-semibold">{teenOf(c)}</h2>
          <p className="text-sm">{t(`routes.${c.route}`)}</p>
          <p className={hintClass} data-testid="consent-state">
            {c.withdrawnAt ? t('settings.withdrawnOn', { date: date(c.withdrawnAt) }) : t('settings.active', { date: date(c.grantedAt) })}
          </p>
          {!c.withdrawnAt &&
            (confirming === c.id ? (
              <div role="alertdialog" aria-label={t('settings.confirmTitle', { teen: teenOf(c) })} className="flex flex-col gap-3">
                <h3 className="font-medium">{t('settings.confirmTitle', { teen: teenOf(c) })}</h3>
                <p className="text-sm">{t('settings.confirmBody', { teen: teenOf(c) })}</p>
                <p className={hintClass}>{t('settings.deletionNote', { teen: teenOf(c) })}</p>
                <label htmlFor={`reason-${c.id}`} className={labelClass}>
                  {t('settings.reasonLabel')}
                </label>
                <input id={`reason-${c.id}`} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
                {error && (
                  <p role="alert" className={errorClass}>
                    {errorText(t, error)}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="destructive" disabled={busy} onClick={() => withdraw(c)}>
                    {busy ? t('settings.confirming') : t('settings.confirm')}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setConfirming(null)}>
                    {t('settings.cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Button type="button" variant="outline" onClick={() => setConfirming(c.id)}>
                  {t('settings.withdraw')}
                </Button>
              </div>
            ))}
        </article>
      ))}
    </div>
  );
}
