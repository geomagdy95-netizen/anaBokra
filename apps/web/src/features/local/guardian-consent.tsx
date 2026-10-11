'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import type { GuardianRecord } from '@/lib/local/device';
import { isValidPin } from '@/lib/local/pin';
import { checkGuardianId, normalizeNationalId, type GuardianRelation } from '@/lib/national-id';

type Verified = { last3: string; verifiedAt: string };
type PhoneError = 'invalid_phone' | 'rate_limited' | 'sms_unavailable' | 'send_failed' | 'invalid_code' | 'expired' | 'too_many_attempts' | 'network';

const RELATIONS: GuardianRelation[] = ['mother', 'father', 'legal_guardian'];
const field = 'w-full rounded-xl border bg-background px-3 py-2.5 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

async function post<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new Error('network');
  }
  const json = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: string } & T) | null;
  if (!res.ok || !json?.ok) throw new Error(json?.error ?? 'network');
  return json;
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-3 rounded-xl border p-3 text-sm has-[:checked]:border-primary">
      <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

/**
 * Parent or guardian consent for 15–17 (consent-texts §1.3): phone verified by SMS code, national ID
 * checked on the device, declaration, terms, parent PIN. Everything except the phone number (used
 * once, to send the code) stays on this device.
 */
export function GuardianConsent({
  onAgree,
  onCancel,
  policyVersion,
}: {
  onAgree: (guardian: Omit<GuardianRecord, 'pin'> & { pinPlain: string }, stats: boolean) => Promise<void>;
  onCancel: () => void;
  policyVersion: string;
}) {
  const t = useTranslations('Local.guardian');
  const td = useTranslations('Local.firstStart.docs');
  const locale = useLocale() as 'ar' | 'en';

  const [name, setName] = useState('');
  const [relation, setRelation] = useState<GuardianRelation | null>(null);
  const [nid, setNid] = useState('');
  const [phone, setPhone] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verified, setVerified] = useState<Verified | null>(null);
  const [phoneError, setPhoneError] = useState<PhoneError | null>(null);
  const [busy, setBusy] = useState(false);
  const [ticks, setTicks] = useState([false, false, false]);
  const [stats, setStats] = useState(false);
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');

  const idCheck = useMemo(() => (normalizeNationalId(nid).length === 14 && relation ? checkGuardianId(nid, relation) : null), [nid, relation]);
  const pinOk = isValidPin(pin) && pin === pin2;
  const ready = name.trim().length >= 3 && relation && idCheck?.ok && verified && ticks.every(Boolean) && pinOk && !busy;

  const sendCode = async () => {
    setBusy(true);
    setPhoneError(null);
    try {
      const out = await post<{ requestId: string }>('/api/verify/phone/request', { phone, locale });
      setRequestId(out.requestId);
      setCode('');
    } catch (e) {
      setPhoneError((e as Error).message as PhoneError);
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async () => {
    if (!requestId) return;
    setBusy(true);
    setPhoneError(null);
    try {
      const out = await post<Verified>('/api/verify/phone/confirm', { requestId, code });
      setVerified({ last3: out.last3, verifiedAt: out.verifiedAt });
      // The number is no longer needed on this screen either.
      setPhone('');
      setRequestId(null);
    } catch (e) {
      setPhoneError((e as Error).message as PhoneError);
    } finally {
      setBusy(false);
    }
  };

  const agree = async () => {
    if (!ready || !relation || !verified) return;
    setBusy(true);
    await onAgree(
      { name: name.trim(), relation, nationalId: normalizeNationalId(nid), phoneLast3: verified.last3, phoneVerifiedAt: verified.verifiedAt, pinPlain: pin },
      stats,
    );
    setBusy(false);
  };

  return (
    <section className="flex flex-col gap-4" data-testid="guardian-consent">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <ul className="list-disc space-y-1.5 ps-5 text-sm">
        {(['p1', 'p2', 'p3', 'p4', 'p5'] as const).map((k) => (
          <li key={k}>{t(`points.${k}`)}</li>
        ))}
      </ul>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {(['privacy-policy', 'terms-of-use', 'children-data-notice'] as const).map((doc) => (
          <Link key={doc} href={`/legal/${doc}`} target="_blank" className="text-primary underline underline-offset-4">
            {td(doc)}
          </Link>
        ))}
      </p>

      <h2 className="font-semibold">{t('detailsTitle')}</h2>
      <label className="flex flex-col gap-1 text-sm">
        {t('name')}
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </label>

      <fieldset className="flex flex-col gap-1 text-sm">
        <legend className="mb-1">{t('relation')}</legend>
        <div className="flex flex-wrap gap-2">
          {RELATIONS.map((r) => (
            <label key={r} className="flex items-center gap-2 rounded-xl border px-3 py-2 has-[:checked]:border-primary">
              <input type="radio" name="relation" checked={relation === r} onChange={() => setRelation(r)} className="accent-[var(--primary)]" />
              {t(`relations.${r}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        {t('nid')}
        <input className={`${field} tracking-wider`} dir="ltr" inputMode="numeric" value={nid} onChange={(e) => setNid(e.target.value)} autoComplete="off" data-testid="nid" />
        <span className="text-xs text-muted-foreground">{t('nidHelp')}</span>
        {idCheck && (
          <span role={idCheck.ok ? 'status' : 'alert'} className={`text-xs ${idCheck.ok ? 'text-emerald-700' : 'text-destructive'}`}>
            {idCheck.ok ? t('nidOk') : t(`nidErrors.${idCheck.error}`)}
          </span>
        )}
        {!relation && normalizeNationalId(nid).length === 14 && <span className="text-xs text-muted-foreground">{t('nidNeedsRelation')}</span>}
      </label>

      <div className="flex flex-col gap-2 rounded-xl border p-3 text-sm">
        <span>{t('phone')}</span>
        {verified ? (
          <p role="status" className="text-emerald-700" data-testid="phone-verified">
            {t('verified', { last3: verified.last3 })}
          </p>
        ) : (
          <>
            <div className="flex gap-2">
              <input className={field} dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" data-testid="phone" />
              <Button type="button" variant="outline" disabled={busy || phone.trim().length < 10} onClick={() => void sendCode()}>
                {requestId ? t('resend') : t('sendCode')}
              </Button>
            </div>
            {requestId && (
              <div className="flex gap-2">
                <input
                  className={`${field} tracking-[0.3em]`}
                  dir="ltr"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder={t('codeLabel')}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="one-time-code"
                  data-testid="code"
                />
                <Button type="button" disabled={busy || code.length !== 6} onClick={() => void confirmCode()}>
                  {t('verify')}
                </Button>
              </div>
            )}
            <span className="text-xs text-muted-foreground">{t('phoneHelp')}</span>
          </>
        )}
        {phoneError && (
          <p role="alert" className="text-xs text-destructive">
            {t(`phoneErrors.${phoneError}`)}
          </p>
        )}
      </div>

      <h2 className="font-semibold">{t('tickTitle')}</h2>
      {(['c1', 'c2', 'c3'] as const).map((k, i) => (
        <Check key={k} checked={ticks[i]!} onChange={(v) => setTicks((prev) => prev.map((x, j) => (j === i ? v : x)))}>
          {t(`checks.${k}`, { version: `⁦${policyVersion}⁩` })}
        </Check>
      ))}
      <Check checked={stats} onChange={setStats}>
        {t('checks.c4')}
      </Check>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <label className="flex flex-col gap-1">
          {t('pin')}
          <input className={`${field} tracking-[0.3em]`} dir="ltr" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value)} data-testid="pin" />
        </label>
        <label className="flex flex-col gap-1">
          {t('pinConfirm')}
          <input className={`${field} tracking-[0.3em]`} dir="ltr" type="password" inputMode="numeric" maxLength={6} value={pin2} onChange={(e) => setPin2(e.target.value)} data-testid="pin2" />
        </label>
        <span className={`col-span-2 text-xs ${pin2 && !pinOk ? 'text-destructive' : 'text-muted-foreground'}`}>{pin2 && !pinOk ? t('pinMismatch') : t('pinHelp')}</span>
      </div>

      <div className="flex gap-2">
        <Button size="lg" disabled={!ready} onClick={() => void agree()} data-testid="guardian-agree">
          {t('agree')}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          {t('notNow')}
        </Button>
      </div>
    </section>
  );
}
