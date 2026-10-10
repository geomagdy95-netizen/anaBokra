'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import type { AgeBand, ConsentBasis } from '@/lib/local/device';

/** Versions stored with every on-device confirmation (docs/legal/consent-texts, privacy-policy). */
export const CONSENT_TEXT_VERSION = 'consent-0.2-draft';
export const POLICY_VERSION = '0.2-draft';

type Step = 'age' | 'too-young' | 'hand-over' | 'guardian' | 'thanks' | 'adult';
const AGES = ['under15', '15', '16', '17', '18plus'] as const;

function Docs() {
  const t = useTranslations('Local.firstStart.docs');
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {(['privacy-policy', 'terms-of-use', 'children-data-notice'] as const).map((doc) => (
        <Link key={doc} href={`/legal/${doc}`} target="_blank" className="text-primary underline underline-offset-4">
          {t(doc)}
        </Link>
      ))}
    </p>
  );
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
 * First start on a phone (consent-texts.en.md §1): age question, then a parent or guardian confirms
 * on the device for under-18s, or an adult accepts for themselves. Nothing is saved before that.
 */
export function FirstStart({ onDone }: { onDone: () => void }) {
  const t = useTranslations('Local.firstStart');
  const locale = useLocale() as 'ar' | 'en';
  const [step, setStep] = useState<Step>('age');
  const [ticks, setTicks] = useState([false, false, false]);
  const [adultTick, setAdultTick] = useState(false);
  const [notNow, setNotNow] = useState(false);
  const [saving, setSaving] = useState(false);

  const create = async (ageBand: AgeBand, basis: ConsentBasis) => {
    setSaving(true);
    const [{ deviceKv }, { DeviceStore }, { forgetActiveRuntime }] = await Promise.all([
      import('@/lib/local/kv'),
      import('@/lib/local/device'),
      import('@/lib/local/runtime'),
    ]);
    const device = new DeviceStore(await deviceKv());
    const profile = await device.createProfile({ mode: 'phone', ageBand, locale });
    await device.setConsent(profile.id, { basis, textVersion: CONSENT_TEXT_VERSION, policyVersion: POLICY_VERSION });
    await device.setActiveId(profile.id);
    forgetActiveRuntime();
    setSaving(false);
  };

  const pickAge = (a: (typeof AGES)[number]) => {
    setNotNow(false);
    setStep(a === 'under15' ? 'too-young' : a === '18plus' ? 'adult' : 'hand-over');
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 py-8" data-testid="first-start">
      <header className="flex justify-end">
        <LocaleSwitcher />
      </header>

      {step === 'age' && (
        <section className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">{t('ageTitle')}</h1>
          <p className="text-lg">{t('ageQuestion')}</p>
          {notNow && (
            <p role="status" className="rounded-xl bg-muted p-3 text-sm">
              {t('notNowDone')}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {AGES.map((a) => (
              <Button key={a} variant="outline" size="lg" className={a === '18plus' ? 'col-span-2' : ''} onClick={() => pickAge(a)}>
                {t(`ages.${a}`)}
              </Button>
            ))}
          </div>
        </section>
      )}

      {step === 'too-young' && (
        <section className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">{t('tooYoungTitle')}</h1>
          <p>{t('tooYoungBody')}</p>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/careers">{t('browseCareers')}</Link>
            </Button>
            <Button variant="outline" onClick={() => setStep('age')}>
              {t('back')}
            </Button>
          </div>
        </section>
      )}

      {step === 'hand-over' && (
        <section className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">{t('handOverTitle')}</h1>
          <p>{t('handOverBody')}</p>
          <div className="flex gap-2">
            <Button size="lg" onClick={() => setStep('guardian')}>
              {t('handOverButton')}
            </Button>
            <Button variant="outline" onClick={() => setStep('age')}>
              {t('back')}
            </Button>
          </div>
        </section>
      )}

      {step === 'guardian' && (
        <section className="flex flex-col gap-4" lang={locale}>
          <h1 className="text-2xl font-semibold">{t('guardianTitle')}</h1>
          <ul className="list-disc space-y-1.5 ps-5 text-sm">
            {(['p1', 'p2', 'p3', 'p4', 'p5'] as const).map((k) => (
              <li key={k}>{t(`guardianPoints.${k}`)}</li>
            ))}
          </ul>
          <Docs />
          <h2 className="font-semibold">{t('tickTitle')}</h2>
          {(['c1', 'c2', 'c3'] as const).map((k, i) => (
            <Check key={k} checked={ticks[i]!} onChange={(v) => setTicks((prev) => prev.map((x, j) => (j === i ? v : x)))}>
              {t(`guardianChecks.${k}`, { version: POLICY_VERSION })}
            </Check>
          ))}
          <div className="flex gap-2">
            <Button
              size="lg"
              disabled={!ticks.every(Boolean) || saving}
              onClick={async () => {
                await create('15-17', 'guardian_on_device');
                setStep('thanks');
              }}
            >
              {t('agree')}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setTicks([false, false, false]);
                setNotNow(true);
                setStep('age');
              }}
            >
              {t('notNow')}
            </Button>
          </div>
        </section>
      )}

      {step === 'thanks' && (
        <section className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">{t('thanks')}</h1>
          <div>
            <Button size="lg" onClick={onDone}>
              {t('continue')}
            </Button>
          </div>
        </section>
      )}

      {step === 'adult' && (
        <section className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">{t('adultTitle')}</h1>
          <ul className="list-disc space-y-1.5 ps-5">
            <li>{t('adultP1')}</li>
            <li>{t('adultP2')}</li>
          </ul>
          <Docs />
          <Check checked={adultTick} onChange={setAdultTick}>
            {t('adultCheck', { version: POLICY_VERSION })}
          </Check>
          <div className="flex gap-2">
            <Button
              size="lg"
              disabled={!adultTick || saving}
              onClick={async () => {
                await create('18plus', 'adult_self');
                onDone();
              }}
            >
              {t('start')}
            </Button>
            <Button variant="outline" onClick={() => setStep('age')}>
              {t('back')}
            </Button>
          </div>
        </section>
      )}
    </main>
  );
}
