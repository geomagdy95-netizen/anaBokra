'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { MIN_PASSWORD, isValidPassword, normalizePassword } from '@/lib/local/lock';

export const inputClass = 'field';

/** A new password typed twice. `value` is the password once both match and it's long enough, else null. */
export function NewPasswordFields({ onChange, labels }: { onChange: (value: string | null) => void; labels?: { password: string; again: string } }) {
  const t = useTranslations('Local.profile');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const update = (na: string, nb: string) => {
    setA(na);
    setB(nb);
    onChange(isValidPassword(na) && normalizePassword(na) === normalizePassword(nb) ? na : null);
  };
  const short = a.length > 0 && !isValidPassword(a);
  const mismatch = b.length > 0 && isValidPassword(a) && normalizePassword(a) !== normalizePassword(b);
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        {labels?.password ?? t('password')}
        <input type="password" autoComplete="new-password" dir="ltr" value={a} onChange={(e) => update(e.target.value, b)} className={inputClass} data-testid="new-password" />
        <span className={`text-xs ${short ? 'text-destructive' : 'text-muted-foreground'}`}>{t(short ? 'errors.short' : 'passwordHelp', { min: MIN_PASSWORD })}</span>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {labels?.again ?? t('passwordAgain')}
        <input type="password" autoComplete="new-password" dir="ltr" value={b} onChange={(e) => update(a, e.target.value)} className={inputClass} data-testid="new-password-again" />
        {mismatch && (
          <span role="alert" className="text-xs text-destructive">
            {t('errors.mismatch')}
          </span>
        )}
      </label>
    </div>
  );
}

/** Shows a new recovery code once, with copy, until the user says they've saved it. */
export function RecoveryCodeCard({ code, onDone }: { code: string; onDone: () => void }) {
  const t = useTranslations('Local.recovery');
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <section className="flex flex-col gap-4" data-testid="recovery-code">
      <h2 className="text-xl font-semibold">{t('title')}</h2>
      <p className="text-sm">{t('body')}</p>
      <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-dashed p-4">
        <code dir="ltr" className="font-mono text-2xl tracking-widest select-all">
          {code}
        </code>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            void navigator.clipboard
              ?.writeText(code)
              .then(() => setCopied(true))
              .catch(() => {})
          }
        >
          {t(copied ? 'copied' : 'copy')}
        </Button>
      </div>
      <label className="flex min-h-12 items-start gap-3 rounded-2xl border border-input bg-card p-4 text-sm has-[:checked]:border-primary has-[:checked]:bg-secondary">
        <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" checked={saved} onChange={(e) => setSaved(e.target.checked)} data-testid="recovery-saved" />
        <span>{t('check')}</span>
      </label>
      <div>
        <Button size="lg" disabled={!saved} onClick={onDone}>
          {t('continue')}
        </Button>
      </div>
    </section>
  );
}

/** "Try again in …" after too many wrong tries. */
export function useWaitText() {
  const t = useTranslations('Local.unlock');
  return (retryAt: string) => {
    const seconds = Math.max(1, Math.ceil((new Date(retryAt).getTime() - Date.now()) / 1000));
    return seconds >= 90 ? t('waitMinutes', { minutes: Math.ceil(seconds / 60) }) : t('waitSeconds', { seconds });
  };
}
