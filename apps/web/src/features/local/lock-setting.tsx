'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

import { NewPasswordFields, RecoveryCodeCard, inputClass, useWaitText } from './password-parts';
import { MAX_NICKNAME } from './profile-setup';
import { withActiveLock } from './unlock-screen';

type Mode = 'idle' | 'set' | 'change' | 'remove' | 'code';

/**
 * Settings: the nickname, and the optional password that locks the app (lib/local/lock.ts).
 * Changing or removing the password needs the current one; changing it gives a new recovery code.
 */
export function LockSetting({ onChanged }: { onChanged: () => void }) {
  const t = useTranslations('Local.lock');
  const waitText = useWaitText();
  const [loaded, setLoaded] = useState(false);
  const [locked, setLocked] = useState(false);
  const [nickname, setNickname] = useState('');
  const [savedName, setSavedName] = useState('');
  const [mode, setMode] = useState<Mode>('idle');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void withActiveLock(async (_lock, device, id) => {
      const p = await device.getProfile(id);
      setLocked(Boolean(p?.lock));
      setNickname(p?.displayName ?? '');
      setSavedName(p?.displayName ?? '');
      setLoaded(true);
    });
  }, []);

  const reset = (m: Mode = 'idle') => {
    setMode(m);
    setCurrent('');
    setNext(null);
    setError(null);
  };

  const saveName = async () => {
    const name = nickname.trim().slice(0, MAX_NICKNAME);
    if (!name) return;
    await withActiveLock((_lock, device, id) => device.updateProfile(id, { displayName: name }));
    setSavedName(name);
    onChanged();
  };

  const apply = async () => {
    setBusy(true);
    try {
      await withActiveLock(async (lock, device, id) => {
        if (mode !== 'set') {
          const r = await lock.checkPassword(device, id, current);
          if (!r.ok) return setError(r.reason === 'wait' ? waitText(r.retryAt) : t('wrongCurrent'));
        }
        if (mode === 'remove') {
          await lock.removePassword(device, id);
          setLocked(false);
          return reset();
        }
        if (next) {
          setCode(await lock.setPassword(device, id, next));
          setLocked(true);
          reset('code');
        }
      });
    } finally {
      setBusy(false);
    }
  };

  const lockNow = async () => {
    const { lockActiveProfile } = await import('@/lib/local/runtime');
    lockActiveProfile();
    onChanged();
  };

  if (!loaded) return null;
  if (mode === 'code' && code)
    return (
      <div className="rounded-xl border p-3">
        <RecoveryCodeCard
          code={code}
          onDone={() => {
            setCode(null);
            reset();
          }}
        />
      </div>
    );

  const needsCurrent = mode === 'change' || mode === 'remove';
  const canApply = (!needsCurrent || current.length > 0) && (mode === 'remove' || next !== null);

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-3 text-sm" data-testid="lock-setting">
      <p className="font-medium">{t('title')}</p>

      <div className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1">
          {t('nickname')}
          <input value={nickname} maxLength={MAX_NICKNAME} onChange={(e) => setNickname(e.target.value)} className={inputClass} data-testid="settings-nickname" />
        </label>
        <Button variant="outline" disabled={!nickname.trim() || nickname.trim() === savedName} onClick={() => void saveName()}>
          {t('saveNickname')}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{t(locked ? 'on' : 'off')}</p>

      {mode === 'idle' && (
        <div className="flex flex-wrap gap-2">
          {locked ? (
            <>
              <Button variant="outline" size="sm" onClick={() => void lockNow()} data-testid="lock-now">
                {t('lockNow')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => reset('change')}>
                {t('change')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => reset('remove')}>
                {t('remove')}
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => reset('set')} data-testid="lock-set">
              {t('set')}
            </Button>
          )}
        </div>
      )}
      {locked && mode === 'idle' && <p className="text-xs text-muted-foreground">{t('lostCode')}</p>}

      {mode !== 'idle' && (
        <div className="flex flex-col gap-3">
          {needsCurrent && (
            <label className="flex flex-col gap-1">
              {t('current')}
              <input
                type="password"
                autoComplete="current-password"
                dir="ltr"
                value={current}
                onChange={(e) => {
                  setCurrent(e.target.value);
                  setError(null);
                }}
                className={inputClass}
              />
            </label>
          )}
          {mode !== 'remove' && <NewPasswordFields onChange={setNext} />}
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant={mode === 'remove' ? 'destructive' : 'default'} disabled={busy || !canApply} onClick={() => void apply()}>
              {t(mode === 'remove' ? 'remove' : 'confirm')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => reset()}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
