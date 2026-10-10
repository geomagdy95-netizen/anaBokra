'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useMemo, useState, useSyncExternalStore, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/navigation';

import { errorClass, hintClass, inputClass, labelClass } from './field-styles';
import { clearPending, parsePending, readPendingRaw, requestOtp, savePending } from './pending';

const RESEND_SECONDS = 60;
const subscribeNoop = () => () => {};

export function VerifyForm() {
  const t = useTranslations('Auth');
  const locale = useLocale();
  const router = useRouter();
  const ids = { code: useId(), error: useId() };

  // sessionStorage is an external store: null on the server, the saved login on the client.
  const raw = useSyncExternalStore(subscribeNoop, readPendingRaw, () => null);
  const pending = useMemo(() => parsePending(raw), [raw]);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Without a pending login (direct visit, refresh after success) go back to the start.
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const missing = hydrated && raw === null;
  useEffect(() => {
    if (missing) router.replace('/login');
  }, [missing, router]);

  // Tick once a second so the resend countdown re-renders.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = pending ? Math.max(0, Math.ceil(((resendAt ?? pending.sentAt + RESEND_SECONDS * 1000) - now) / 1000)) : 0;

  if (!pending) return null;
  const errorText = (c: string) => (t.has(`errors.${c}`) ? t(`errors.${c}`) : t('errors.server_error'));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pending) return;
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          channel: pending.channel,
          ...(pending.channel === 'phone' ? { phone: pending.target } : { email: pending.target }),
          token: code,
          role: pending.role,
          locale,
          next: pending.next,
        }),
      });
      const body = (await res.json()) as { ok: boolean; error?: string; next?: string };
      if (!body.ok) {
        setError(body.error ?? 'server_error');
        return;
      }
      clearPending();
      router.replace(body.next ?? '/account');
      router.refresh();
    } catch {
      setError('network');
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    if (!pending) return;
    setError(null);
    setInfo(null);
    const result = await requestOtp({
      channel: pending.channel,
      ...(pending.channel === 'phone' ? { phone: pending.target } : { email: pending.target }),
      role: pending.role,
      locale,
    });
    if (!result.ok) return setError(result.error);
    savePending({ ...pending, sentAt: Date.now() });
    setResendAt(Date.now() + RESEND_SECONDS * 1000);
    setNow(Date.now());
    setCode('');
    setInfo(t('verify.resent'));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <p className={hintClass}>
        {/* The destination is a number or email, always shown left-to-right even inside Arabic text. */}
        {t.rich(pending.channel === 'phone' ? 'verify.subtitlePhone' : 'verify.subtitleEmail', {
          target: () => (
            <bdi dir="ltr" className="font-medium text-foreground">
              {pending.masked}
            </bdi>
          ),
        })}
      </p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.code} className={labelClass}>
          {t('verify.codeLabel')}
        </label>
        <input
          id={ids.code}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          dir="ltr"
          className={`${inputClass} text-center text-2xl tracking-[0.5em]`}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          aria-describedby={error ? ids.error : undefined}
          autoFocus
          required
        />
      </div>

      {error && (
        <p id={ids.error} role="alert" className={errorClass}>
          {errorText(error)}
        </p>
      )}
      {info && (
        <p role="status" className={hintClass}>
          {info}
        </p>
      )}

      <Button type="submit" size="lg" disabled={busy || code.length !== 6}>
        {busy ? t('verify.verifying') : t('verify.submit')}
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={remaining > 0} onClick={onResend}>
          {remaining > 0 ? t('verify.resendIn', { seconds: remaining }) : t('verify.resend')}
        </Button>
        <Button asChild variant="link" size="sm">
          <Link href="/login" onClick={clearPending}>
            {pending.channel === 'phone' ? t('verify.changePhone') : t('verify.changeEmail')}
          </Link>
        </Button>
      </div>
    </form>
  );
}
