'use client';

import { Lock } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { NewPasswordFields, RecoveryCodeCard, inputClass } from './password-parts';

export const MAX_NICKNAME = 24;

const load = () => Promise.all([import('@/lib/local/kv'), import('@/lib/local/device'), import('@/lib/local/lock'), import('@/lib/local/runtime')]);

/** Playful nicknames to tap instead of typing (any language, no gender). */
const SUGGESTIONS = { ar: ['🚀 صاروخ', '🌟 نجم بكرة', '🦉 بومة', '🌊 موجة', '🌴 نخلة', '⚡ برق'], en: ['🚀 Rocket', '🌟 Tomorrow Star', '🦉 Owl', '🌊 Wave', '🌴 Palm', '⚡ Spark'] } as const;

type Address = 'male' | 'female' | null;

/**
 * First start, after acceptance: what to call you (optional, with suggestions), how the Arabic text
 * should address you (optional; only for grammar, never sent anywhere), and an optional password that
 * locks the app, with its recovery code. Everything stays on the phone.
 */
export function ProfileSetup({ onDone }: { onDone: (address?: 'male' | 'female' | null) => void }) {
  const t = useTranslations('Local.profile');
  const locale = useLocale() as 'ar' | 'en';
  const [nickname, setNickname] = useState('');
  const [address, setAddress] = useState<Address | undefined>(undefined);
  const [wantLock, setWantLock] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recovery, setRecovery] = useState<string | null>(null);

  const name = nickname.trim();
  const ready = !wantLock || password !== null;

  const save = async () => {
    setSaving(true);
    const [{ deviceKv }, { DeviceStore }, lock, { forgetActiveRuntime }] = await load();
    const device = new DeviceStore(await deviceKv());
    const id = await device.getActiveId();
    if (!id) return setSaving(false);
    await device.updateProfile(id, { displayName: name ? name.slice(0, MAX_NICKNAME) : null, ...(address !== undefined ? { gender: address } : {}) });
    forgetActiveRuntime();
    if (wantLock && password) {
      setRecovery(await lock.setPassword(device, id, password));
      setSaving(false);
      return;
    }
    setSaving(false);
    onDone(address);
  };

  const chip = (on: boolean) =>
    cn('min-h-11 rounded-full border px-4 text-sm font-medium transition-colors', on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary');

  if (recovery) return <RecoveryCodeCard code={recovery} onDone={() => onDone(address)} />;
  return (
    <section className="flex flex-col gap-5" data-testid="profile-setup">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('intro')}</p>
      </div>

      <label className="flex flex-col gap-2">
        <span className="font-semibold">{t('nickname')}</span>
        <input value={nickname} maxLength={MAX_NICKNAME} autoComplete="nickname" onChange={(e) => setNickname(e.target.value)} placeholder={t('nicknamePlaceholder')} className={inputClass} data-testid="nickname" />
        <span className="text-xs text-muted-foreground">{t('nicknameHelp')}</span>
      </label>
      <div className="flex flex-wrap gap-2" aria-label={t('suggestions')}>
        {SUGGESTIONS[locale].map((s) => (
          <button key={s} type="button" onClick={() => setNickname(s.replace(/^\S+\s/, ''))} className={chip(nickname === s.replace(/^\S+\s/, ''))} data-testid="nickname-suggestion">
            {s}
          </button>
        ))}
      </div>

      {/* Arabic has masculine and feminine "you"; English needs nothing. */}
      {locale === 'ar' && (
        <fieldset className="space-y-2">
          <legend className="font-semibold">{t('addressQ')}</legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['male', t('address.male')],
                ['female', t('address.female')],
                [null, t('address.none')],
              ] as const
            ).map(([value, label]) => (
              <button key={String(value)} type="button" aria-pressed={address === value} onClick={() => setAddress(value)} className={chip(address === value)} data-testid={`address-${value ?? 'none'}`}>
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t('addressHelp')}</p>
        </fieldset>
      )}

      <div className="flex flex-col gap-3 rounded-3xl border-2 border-brand-lavender bg-card p-4">
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" className="size-5 shrink-0 accent-[var(--primary)]" checked={wantLock} onChange={(e) => setWantLock(e.target.checked)} data-testid="want-lock" />
          <span className="flex items-center gap-2 font-semibold">
            <Lock className="size-4 text-primary" aria-hidden />
            {t('lockCheck')}
          </span>
        </label>
        <p className="text-sm text-muted-foreground">{t('lockBody')}</p>
        {wantLock && <NewPasswordFields onChange={setPassword} />}
      </div>

      <Button size="lg" className="h-14 rounded-2xl text-base" disabled={!ready || saving} onClick={() => void save()} data-testid="profile-save">
        {name ? t('save') : t('skipName')}
      </Button>
    </section>
  );
}
