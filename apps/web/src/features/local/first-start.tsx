'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import type { AgeBand, ConsentBasis, GuardianRecord } from '@/lib/local/device';

import { GuardianConsent } from './guardian-consent';
import { JoinSession } from './join-session';
import { ProfileSetup } from './profile-setup';
import { ResearchConsent } from './research-consent';
import { RestoreData } from './restore-data';

/** Versions stored with every on-device acceptance (docs/legal/consent-texts, privacy-policy). */
export const CONSENT_TEXT_VERSION = 'consent-0.5-draft';
export const POLICY_VERSION = '0.5-draft';

type Step = 'age' | 'too-young' | 'hand-over' | 'guardian' | 'thanks' | 'profile' | 'accept' | 'restore' | 'session' | 'research';
const AGES = ['under15', '15-17', '18-20', '21-25', '26plus'] as const satisfies readonly AgeBand[];

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

function Check({ checked, onChange, children, testId }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; testId?: string }) {
  return (
    <label className="flex items-start gap-3 rounded-xl border p-3 text-sm has-[:checked]:border-primary">
      <input
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        data-testid={testId}
      />
      <span>{children}</span>
    </label>
  );
}

async function createProfile(input: {
  ageBand: AgeBand;
  locale: 'ar' | 'en';
  basis: ConsentBasis;
  stats: boolean;
  guardian?: Omit<GuardianRecord, 'pin'> & { pinPlain: string };
}) {
  const [{ deviceKv }, { DeviceStore }, { forgetActiveRuntime }, { hashPin }] = await Promise.all([
    import('@/lib/local/kv'),
    import('@/lib/local/device'),
    import('@/lib/local/runtime'),
    import('@/lib/local/pin'),
  ]);
  const device = new DeviceStore(await deviceKv());
  let guardian: GuardianRecord | null = null;
  if (input.guardian) {
    const { pinPlain, ...rest } = input.guardian;
    guardian = { ...rest, pin: await hashPin(pinPlain) };
  }
  const profile = await device.createProfile({ mode: 'phone', ageBand: input.ageBand, locale: input.locale, guardian });
  await device.setConsent(profile.id, { basis: input.basis, textVersion: CONSENT_TEXT_VERSION, policyVersion: POLICY_VERSION, stats: input.stats });
  await device.setActiveId(profile.id);
  forgetActiveRuntime();
}

/**
 * First start (consent-texts.en.md §1): an age question; adults accept for themselves; 15–17 need a
 * verified parent or guardian; under-15s are turned away. Nothing is saved before consent. Then a
 * nickname and an optional password (profile-setup.tsx); adults can then join a pilot session.
 */
export function FirstStart({ onDone }: { onDone: () => void }) {
  const t = useTranslations('Local.firstStart');
  const locale = useLocale() as 'ar' | 'en';
  const [step, setStep] = useState<Step>('age');
  const [age, setAge] = useState<AgeBand | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [stats, setStats] = useState(false);
  const [notNow, setNotNow] = useState(false);
  const [saving, setSaving] = useState(false);

  const pickAge = (a: AgeBand) => {
    setAge(a);
    setNotNow(false);
    setStep(a === 'under15' ? 'too-young' : a === '15-17' ? 'hand-over' : 'accept');
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
              <Button key={a} variant="outline" size="lg" className={a === '26plus' ? 'col-span-2' : ''} onClick={() => pickAge(a)}>
                {t(`ages.${a}`)}
              </Button>
            ))}
          </div>
          <button onClick={() => setStep('restore')} className="self-start text-sm text-primary underline underline-offset-4" data-testid="open-restore">
            {t('restoreLink')}
          </button>
        </section>
      )}

      {step === 'restore' && <RestoreData onDone={onDone} onCancel={() => setStep('age')} />}

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
        <GuardianConsent
          policyVersion={POLICY_VERSION}
          onCancel={() => {
            setNotNow(true);
            setStep('age');
          }}
          onAgree={async (guardian, parentStats) => {
            await createProfile({ ageBand: '15-17', locale, basis: 'guardian_verified', stats: parentStats, guardian });
            setStep('thanks');
          }}
        />
      )}

      {step === 'thanks' && (
        <section className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">{t('thanks')}</h1>
          <div>
            <Button size="lg" onClick={() => setStep('profile')}>
              {t('continue')}
            </Button>
          </div>
        </section>
      )}

      {step === 'profile' && <ProfileSetup onDone={() => (age === '15-17' ? onDone() : setStep('session'))} />}

      {step === 'session' && (
        <section className="flex flex-col gap-3">
          <JoinSession onJoined={(e) => (e.research ? setStep('research') : onDone())} onSkip={onDone} />
          <p className="text-xs text-muted-foreground">{t('joinLater')}</p>
        </section>
      )}

      {step === 'research' && <ResearchConsent onAnswered={onDone} />}

      {step === 'accept' && (
        <section className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">{t('acceptTitle')}</h1>
          <ul className="list-disc space-y-1.5 ps-5">
            {(['p1', 'p2', 'p3'] as const).map((k) => (
              <li key={k}>{t(`acceptPoints.${k}`)}</li>
            ))}
          </ul>
          <Docs />
          <Check checked={accepted} onChange={setAccepted} testId="accept">
            {/* LRI…PDI keep the Latin version string in order inside Arabic text. */}
            {t('acceptCheck', { version: `⁦${POLICY_VERSION}⁩` })}
          </Check>
          <Check checked={stats} onChange={setStats}>
            {t('statsCheck')}
          </Check>
          <div className="flex gap-2">
            <Button
              size="lg"
              disabled={!accepted || saving || !age}
              onClick={async () => {
                if (!age) return;
                setSaving(true);
                await createProfile({ ageBand: age, locale, basis: 'adult_self', stats });
                setSaving(false);
                // Then a nickname and an optional password; then adults can join a pilot session (§2.2).
                setStep('profile');
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
