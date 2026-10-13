'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { Logo } from '@/components/brand/logo';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import type { DeviceStore } from '@/lib/local/device';
import type * as Lock from '@/lib/local/lock';
import type { CheckResult } from '@/lib/local/lock';

import { DeleteMyData } from './delete-data';
import { NewPasswordFields, RecoveryCodeCard, inputClass, useWaitText } from './password-parts';

const load = () => Promise.all([import('@/lib/local/kv'), import('@/lib/local/device'), import('@/lib/local/lock'), import('@/lib/local/runtime')]);

/** Runs a lock action on the active profile (loaded lazily, like the other on-device settings). */
export async function withActiveLock<T>(fn: (lock: typeof Lock, device: DeviceStore, id: string) => Promise<T>): Promise<T> {
  const [{ deviceKv }, { DeviceStore }, lock, { forgetActiveRuntime }] = await load();
  const device = new DeviceStore(await deviceKv());
  const id = await device.getActiveId();
  if (!id) throw new Error('no_profile');
  const r = await fn(lock, device, id);
  forgetActiveRuntime();
  return r;
}

/**
 * The profile has a password (lib/local/lock.ts): ask for it before anything is shown. Forgot it:
 * the recovery code resets it. Lost both: the only way on is to delete this profile (then restore
 * a backup file if there is one).
 */
export function UnlockScreen({ nickname, onUnlocked }: { nickname: string | null; onUnlocked: () => void }) {
  const t = useTranslations('Local.unlock');
  const locale = useLocale() as 'ar' | 'en';
  const waitText = useWaitText();
  const [mode, setMode] = useState<'password' | 'recovery' | 'new-code'>('password');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [removeInstead, setRemoveInstead] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);

  const explain = (r: CheckResult, wrongKey: 'wrong' | 'recoveryWrong') => setError(r.ok ? null : r.reason === 'wait' ? waitText(r.retryAt) : t(wrongKey));

  const tryUnlock = async () => {
    setBusy(true);
    const r = await withActiveLock((lock, device, id) => lock.unlock(device, id, password));
    setBusy(false);
    if (r.ok) return onUnlocked();
    setPassword('');
    explain(r, 'wrong');
  };

  const tryReset = async () => {
    setBusy(true);
    const r = await withActiveLock((lock, device, id) => lock.resetWithRecovery(device, id, code, removeInstead ? null : newPassword));
    setBusy(false);
    if (!r.ok) return explain(r, 'recoveryWrong');
    if (r.recovery) {
      setNewCode(r.recovery);
      setMode('new-code');
    } else onUnlocked();
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 py-8" data-testid="unlock">
      <header className="flex items-center justify-between gap-3">
        <Logo locale={locale} className="h-11" />
        <LocaleSwitcher />
      </header>

      {mode === 'new-code' && newCode && <RecoveryCodeCard code={newCode} onDone={onUnlocked} />}

      {mode === 'password' && (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void tryUnlock();
          }}
        >
          <h1 className="text-2xl font-semibold">{nickname ? t('titleNamed', { name: nickname }) : t('title')}</h1>
          <p>{t('body')}</p>
          <label className="flex flex-col gap-1 text-sm">
            {t('password')}
            <input
              type="password"
              autoComplete="current-password"
              dir="ltr"
              autoFocus
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              className={inputClass}
              data-testid="unlock-password"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div>
            <Button size="lg" type="submit" disabled={busy || password.length === 0} data-testid="unlock-open">
              {t('open')}
            </Button>
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode('recovery');
            }}
            className="tap-link self-start"
          >
            {t('forgot')}
          </button>
        </form>
      )}

      {mode === 'recovery' && (
        <section className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">{t('recoveryTitle')}</h1>
          <label className="flex flex-col gap-1 text-sm">
            {t('recoveryCode')}
            <input
              dir="ltr"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError(null);
              }}
              className={`${inputClass} font-mono tracking-widest`}
              data-testid="recovery-input"
            />
          </label>
          {!removeInstead && <NewPasswordFields onChange={setNewPassword} labels={{ password: t('newPassword'), again: t('newPasswordAgain') }} />}
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" checked={removeInstead} onChange={(e) => setRemoveInstead(e.target.checked)} />
            <span>{t('removeInstead')}</span>
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button size="lg" disabled={busy || code.trim().length === 0 || (!removeInstead && newPassword === null)} onClick={() => void tryReset()} data-testid="recovery-reset">
              {t('reset')}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setError(null);
                setMode('password');
              }}
            >
              {t('back')}
            </Button>
          </div>

          <div className="mt-4 flex flex-col gap-2 border-t pt-4">
            <p className="font-medium">{t('lostTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('lostBody')}</p>
            <DeleteMyData onDeleted={onUnlocked} />
          </div>
        </section>
      )}
    </main>
  );
}
