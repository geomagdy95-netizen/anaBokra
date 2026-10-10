'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useId, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';

import { errorClass, hintClass, inputClass, labelClass } from './field-styles';
import { requestOtp, savePending } from './pending';

type Role = 'student' | 'parent';
type Method = 'whatsapp' | 'email';

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const t = useTranslations('Auth');
  const locale = useLocale();
  const router = useRouter();
  const ids = { phone: useId(), email: useId(), error: useId() };

  const [role, setRole] = useState<Role>('student');
  const [method, setMethod] = useState<Method>('whatsapp');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [busy, setBusy] = useState(false);

  const errorText = (code: string) => (t.has(`errors.${code}`) ? t(`errors.${code}`) : t('errors.server_error'));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await requestOtp(
      method === 'whatsapp'
        ? { channel: 'phone', phone, role, locale }
        : { channel: 'email', email, role, locale },
    );
    setBusy(false);
    if (!result.ok) return setError(result.error);
    savePending({ channel: result.channel, target: result.target, masked: result.masked, role, next, sentAt: Date.now() });
    router.push('/verify');
  }

  async function onGoogle() {
    setError(null);
    const redirectTo = new URL('/api/auth/callback', window.location.origin);
    redirectTo.searchParams.set('role', role);
    redirectTo.searchParams.set('locale', locale);
    if (next) redirectTo.searchParams.set('next', next);
    const { error: oauthError } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo.toString() },
    });
    if (oauthError) setError('oauth');
  }

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className={labelClass}>{t('login.roleLabel')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['student', 'parent'] as const).map((r) => (
            <Button
              key={r}
              type="button"
              variant={role === r ? 'default' : 'outline'}
              aria-pressed={role === r}
              onClick={() => setRole(r)}
            >
              {t(`login.${r}`)}
            </Button>
          ))}
        </div>
      </fieldset>

      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate aria-describedby={error ? ids.error : undefined}>
        {method === 'whatsapp' ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.phone} className={labelClass}>
              {t('login.phoneLabel')}
            </label>
            <input
              id={ids.phone}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              placeholder="010 1234 5678"
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <p className={hintClass}>{t('login.phoneHint')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.email} className={labelClass}>
              {t('login.emailLabel')}
            </label>
            <input
              id={ids.email}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              dir="ltr"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        )}

        {error && (
          <p id={ids.error} role="alert" className={errorClass}>
            {errorText(error)}
          </p>
        )}

        <Button type="submit" size="lg" disabled={busy}>
          {busy ? t('login.sending') : method === 'whatsapp' ? t('login.sendWhatsapp') : t('login.sendEmail')}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-sm text-muted-foreground" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        {t('login.or')}
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="flex flex-col gap-2" role="group" aria-label={t('login.methodLabel')}>
        <Button type="button" variant="outline" size="lg" onClick={onGoogle}>
          {t('login.google')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setError(null);
            setMethod(method === 'whatsapp' ? 'email' : 'whatsapp');
          }}
        >
          {method === 'whatsapp' ? t('login.useEmail') : t('login.useWhatsapp')}
        </Button>
      </div>
    </div>
  );
}
