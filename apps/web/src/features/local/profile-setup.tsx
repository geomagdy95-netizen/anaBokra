'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { NewPasswordFields, RecoveryCodeCard, inputClass } from './password-parts';

export const MAX_NICKNAME = 24;

const load = () => Promise.all([import('@/lib/local/kv'), import('@/lib/local/device'), import('@/lib/local/lock'), import('@/lib/local/runtime')]);

/**
 * First start, after acceptance (or after the parent hands the phone back): a nickname, and an
 * optional password that locks the app, with its recovery code. Everything stays on the phone.
 */
export function ProfileSetup({ onDone }: { onDone: () => void }) {
  const t = useTranslations('Local.profile');
  const [nickname, setNickname] = useState('');
  const [wantLock, setWantLock] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recovery, setRecovery] = useState<string | null>(null);

  const name = nickname.trim();
  const ready = name.length > 0 && (!wantLock || password !== null);

  const save = async () => {
    setSaving(true);
    const [{ deviceKv }, { DeviceStore }, lock, { forgetActiveRuntime }] = await load();
    const device = new DeviceStore(await deviceKv());
    const id = await device.getActiveId();
    if (!id) return setSaving(false);
    await device.updateProfile(id, { displayName: name.slice(0, MAX_NICKNAME) });
    forgetActiveRuntime();
    if (wantLock && password) {
      setRecovery(await lock.setPassword(device, id, password));
      setSaving(false);
      return;
    }
    setSaving(false);
    onDone();
  };

  if (recovery) return <RecoveryCodeCard code={recovery} onDone={onDone} />;
  return (
    <section className="flex flex-col gap-4" data-testid="profile-setup">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <label className="flex flex-col gap-1 text-sm">
        {t('nickname')}
        <input value={nickname} maxLength={MAX_NICKNAME} autoComplete="nickname" onChange={(e) => setNickname(e.target.value)} className={inputClass} data-testid="nickname" />
        <span className="text-xs text-muted-foreground">{t('nicknameHelp')}</span>
      </label>

      <div className="flex flex-col gap-3 rounded-xl border p-3">
        <p className="font-medium">{t('lockTitle')}</p>
        <p className="text-sm text-muted-foreground">{t('lockBody')}</p>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" checked={wantLock} onChange={(e) => setWantLock(e.target.checked)} data-testid="want-lock" />
          <span>{t('lockCheck')}</span>
        </label>
        {wantLock && <NewPasswordFields onChange={setPassword} />}
      </div>

      <div>
        <Button size="lg" disabled={!ready || saving} onClick={() => void save()} data-testid="profile-save">
          {t('save')}
        </Button>
      </div>
    </section>
  );
}
