'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import type { AgeBand } from '@/lib/local/device';

/** Versions stored with every on-device acceptance (docs/legal/consent-texts, privacy-policy). */
export const CONSENT_TEXT_VERSION = 'consent-0.3-draft';
export const POLICY_VERSION = '0.3-draft';

type Step = 'age' | 'too-young' | 'accept';
const AGES = ['under18', '18-20', '21-25', '26plus'] as const satisfies readonly AgeBand[];

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

/**
 * First start (consent-texts.en.md §1): phase 1 is for ages 18 and up, who accept for themselves.
 * Nothing is saved before that. Under-18s are told a version for them is coming.
 */
export function FirstStart({ onDone }: { onDone: () => void }) {
  const t = useTranslations('Local.firstStart');
  const locale = useLocale() as 'ar' | 'en';
  const [step, setStep] = useState<Step>('age');
  const [age, setAge] = useState<AgeBand | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  const start = async () => {
    if (!age) return;
    setSaving(true);
    const [{ deviceKv }, { DeviceStore }, { forgetActiveRuntime }] = await Promise.all([
      import('@/lib/local/kv'),
      import('@/lib/local/device'),
      import('@/lib/local/runtime'),
    ]);
    const device = new DeviceStore(await deviceKv());
    const profile = await device.createProfile({ mode: 'phone', ageBand: age, locale });
    await device.setConsent(profile.id, { basis: 'adult_self', textVersion: CONSENT_TEXT_VERSION, policyVersion: POLICY_VERSION });
    await device.setActiveId(profile.id);
    forgetActiveRuntime();
    setSaving(false);
    onDone();
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
          <div className="grid grid-cols-2 gap-2">
            {AGES.map((a) => (
              <Button
                key={a}
                variant="outline"
                size="lg"
                onClick={() => {
                  setAge(a);
                  setStep(a === 'under18' ? 'too-young' : 'accept');
                }}
              >
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

      {step === 'accept' && (
        <section className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">{t('acceptTitle')}</h1>
          <ul className="list-disc space-y-1.5 ps-5">
            {(['p1', 'p2', 'p3'] as const).map((k) => (
              <li key={k}>{t(`acceptPoints.${k}`)}</li>
            ))}
          </ul>
          <Docs />
          <label className="flex items-start gap-3 rounded-xl border p-3 text-sm has-[:checked]:border-primary">
            <input
              type="checkbox"
              className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            {/* LRI…PDI keep the Latin version string in order inside Arabic text. */}
            <span>{t('acceptCheck', { version: `\u2066${POLICY_VERSION}\u2069` })}</span>
          </label>
          <div className="flex gap-2">
            <Button size="lg" disabled={!accepted || saving} onClick={() => void start()}>
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
