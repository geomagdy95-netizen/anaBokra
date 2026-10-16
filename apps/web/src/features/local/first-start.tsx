'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { Logo } from '@/components/brand/logo';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { discoverArt } from '@/features/art/task-art';
import { TaskArt } from '@/features/art/task-art-view';
import { HeroCard, HeroPills, HeroText } from '@/features/journey/cards';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { AgeBand, ConsentBasis } from '@/lib/local/device';

import { JoinSession } from './join-session';
import { ProfileSetup } from './profile-setup';
import { ResearchConsent } from './research-consent';
import { RestoreData } from './restore-data';

/** Versions stored with every on-device acceptance (docs/legal/consent-texts, privacy-policy). */
export const CONSENT_TEXT_VERSION = 'consent-0.8-draft';
export const POLICY_VERSION = '0.7-draft';

type Step = 'welcome' | 'age' | 'too-young' | 'profile' | 'accept' | 'restore' | 'session' | 'research' | 'tour';
const AGES = ['under15', '15-17', '18-20', '21-25', '26plus'] as const satisfies readonly AgeBand[];

function Docs() {
  const t = useTranslations('Local.firstStart.docs');
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {(['privacy-policy', 'terms-of-use', 'children-data-notice'] as const).map((doc) => (
        <Link key={doc} href={`/legal/${doc}`} target="_blank" className="tap-link">
          {t(doc)}
        </Link>
      ))}
    </p>
  );
}

function Check({ checked, onChange, children, testId }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; testId?: string }) {
  return (
    <label className="flex min-h-12 items-start gap-3 rounded-2xl border border-input bg-card p-4 text-sm has-[:checked]:border-primary has-[:checked]:bg-secondary">
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

async function createProfile(input: { ageBand: AgeBand; locale: 'ar' | 'en'; basis: ConsentBasis; stats: boolean }) {
  const [{ deviceKv }, { DeviceStore }, { forgetActiveRuntime }] = await Promise.all([
    import('@/lib/local/kv'),
    import('@/lib/local/device'),
    import('@/lib/local/runtime'),
  ]);
  const device = new DeviceStore(await deviceKv());
  const profile = await device.createProfile({ mode: 'phone', ageBand: input.ageBand, locale: input.locale });
  await device.setConsent(profile.id, { basis: input.basis, textVersion: CONSENT_TEXT_VERSION, policyVersion: POLICY_VERSION, stats: input.stats });
  await device.setActiveId(profile.id);
  forgetActiveRuntime();
}

/** Where the user is in the first start, as dots: the steps that show depend on age (15–17 skip the session). */
function Progress({ step, teen }: { step: Step; teen: boolean }) {
  const t = useTranslations('Local.firstStart');
  const steps: Step[] = teen ? ['age', 'accept', 'profile', 'tour'] : ['age', 'accept', 'profile', 'session', 'tour'];
  const at = steps.indexOf(step === 'research' ? 'session' : step);
  if (at < 0) return null;
  return (
    <div className="flex items-center gap-2" role="img" aria-label={t('progress', { n: at + 1, total: steps.length })} data-testid="onboarding-progress">
      {steps.map((s, i) => (
        <span key={s} className={cn('h-1.5 flex-1 rounded-full transition-colors', i <= at ? 'bg-primary' : 'bg-brand-lavender')} />
      ))}
    </div>
  );
}

/** The three promises, as small cards instead of a bullet list. */
function Promises() {
  const t = useTranslations('Local.firstStart');
  const items = [
    ['🔒', 'p1'],
    ['👀', 'p2'],
    ['🧭', 'p3'],
  ] as const;
  return (
    <ul className="flex flex-col gap-2">
      {items.map(([icon, k]) => (
        <li key={k} className="flex items-start gap-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/70">
          <span aria-hidden className="text-2xl leading-none">
            {icon}
          </span>
          <span>
            <span className="block font-semibold">{t(`acceptHeads.${k}`)}</span>
            <span className="block text-sm text-muted-foreground">{t(`acceptPoints.${k}`)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** "Your journey in three stops", the last screen before the map. */
function Tour({ onDone, female }: { onDone: () => void; female: boolean }) {
  const base = useTranslations('Local.firstStart.tour');
  // The address was chosen a step earlier, so the tour already speaks the right way.
  const t = (key: string, values?: Record<string, number>) => (female && base.has(`${key}F`) ? base(`${key}F`, values) : base(key, values));
  const stops = [
    ['🏝️', 's1'],
    ['🌉', 's2'],
    ['⭐', 's3'],
  ] as const;
  return (
    <section className="flex flex-col gap-4" data-testid="onboarding-tour">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('intro')}</p>
      </div>
      <ol className="relative flex flex-col gap-3">
        {stops.map(([icon, k], i) => (
          <li key={k} className="relative flex items-start gap-3 rounded-3xl bg-gradient-to-br from-brand-lavender via-[#F6EFFA] to-accent p-4 text-brand-ink">
            <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/80 text-2xl shadow-sm">
              {icon}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-primary">{t('stop', { n: i + 1 })}</span>
              <span className="block font-bold">{t(`${k}.title`)}</span>
              <span className="block text-sm opacity-80">{t(`${k}.body`)}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted-foreground">{t('tip')}</p>
      <Button size="lg" className="h-14 rounded-2xl text-base" onClick={onDone} data-testid="tour-done">
        {t('go')}
      </Button>
    </section>
  );
}

/**
 * First start (consent-texts.en.md §1): a welcome that says what anaBokra is, an age question;
 * everyone 15 or older accepts for themselves (15–17 tick their own wording); under-15s are turned
 * away. There is no parent step in phase 1: nothing personal reaches anaBokra (counsel agreed, 13 Oct
 * 2026). Nothing is saved before acceptance. Then a nickname, how to address you and an optional
 * password (profile-setup.tsx); adults can then join a pilot session; a three-stop tour ends it.
 */
export function FirstStart({ onDone }: { onDone: () => void }) {
  const t = useTranslations('Local.firstStart');
  const locale = useLocale() as 'ar' | 'en';
  const [step, setStep] = useState<Step>('welcome');
  const [age, setAge] = useState<AgeBand | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [stats, setStats] = useState(false);
  const [saving, setSaving] = useState(false);
  const [female, setFemale] = useState(false);
  const teen = age === '15-17';
  const tour = () => setStep('tour');

  const pickAge = (a: AgeBand) => {
    setAge(a);
    setAccepted(false);
    setStep(a === 'under15' ? 'too-young' : 'accept');
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 py-6" data-testid="first-start">
      <header className="flex items-center justify-between gap-3">
        <Logo locale={locale} className="h-11" />
        <LocaleSwitcher />
      </header>
      <Progress step={step} teen={teen} />

      {step === 'welcome' && (
        <section className="flex flex-col gap-4" data-testid="welcome">
          <HeroCard art={<TaskArt chain={discoverArt()} className="absolute inset-0" />} eyebrow={t('welcome.eyebrow')} title={t('welcome.title')} titleAs="h1">
            <HeroText>{t('welcome.body')}</HeroText>
            <HeroPills items={[`⏱️ ${t('welcome.time')}`, `🔒 ${t('welcome.private')}`, `✨ ${t('welcome.noWrong')}`]} />
          </HeroCard>
          <Button size="lg" className="h-14 rounded-2xl text-base" onClick={() => setStep('age')} data-testid="welcome-start">
            {t('welcome.start')}
          </Button>
          <button onClick={() => setStep('restore')} className="tap-link self-center" data-testid="open-restore">
            {t('restoreLink')}
          </button>
        </section>
      )}

      {step === 'age' && (
        <section className="flex flex-col gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">{t('ageQuestion')}</h1>
            <p className="text-muted-foreground">{t('ageWhy')}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {AGES.map((a) => (
              <Button key={a} variant="outline" size="lg" className={cn('h-14 rounded-2xl text-base', a === '26plus' && 'col-span-2')} onClick={() => pickAge(a)} data-testid={`age-${a}`}>
                {t(`ages.${a}`)}
              </Button>
            ))}
          </div>
          <Button variant="ghost" className="self-start" onClick={() => setStep('welcome')}>
            {t('back')}
          </Button>
        </section>
      )}

      {step === 'restore' && <RestoreData onDone={onDone} onCancel={() => setStep('welcome')} />}

      {step === 'too-young' && (
        <section className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">{t('tooYoungTitle')}</h1>
          <p>{t('tooYoungBody')}</p>
          <Button variant="outline" className="self-start" onClick={() => setStep('age')}>
            {t('back')}
          </Button>
        </section>
      )}

      {/* Adults can then join a university pilot session (§2.2); 15–17 go straight to the tour. */}
      {step === 'profile' && (
        <ProfileSetup
          onDone={(address) => {
            setFemale(address === 'female');
            if (teen) tour();
            else setStep('session');
          }}
        />
      )}

      {step === 'session' && (
        <section className="flex flex-col gap-3">
          <JoinSession onJoined={(e) => (e.research ? setStep('research') : tour())} onSkip={tour} />
          <p className="text-xs text-muted-foreground">{t('joinLater')}</p>
        </section>
      )}

      {step === 'research' && <ResearchConsent onAnswered={tour} />}

      {step === 'tour' && <Tour onDone={onDone} female={female} />}

      {step === 'accept' && (
        <section className="flex flex-col gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">{t('acceptTitle')}</h1>
            <p className="text-muted-foreground">{t('acceptIntro')}</p>
          </div>
          <Promises />
          <Docs />
          <Check checked={accepted} onChange={setAccepted} testId="accept">
            {/* LRI…PDI keep the Latin version string in order inside Arabic text. */}
            {t(teen ? 'acceptCheckTeen' : 'acceptCheck', { version: `\u2066${POLICY_VERSION}\u2069` })}
          </Check>
          <Check checked={stats} onChange={setStats} testId="stats-opt-in">
            {t('statsCheck')}
          </Check>
          <Button
            size="lg"
            className="h-14 rounded-2xl text-base"
            disabled={!accepted || saving || !age}
            onClick={async () => {
              if (!age) return;
              setSaving(true);
              await createProfile({ ageBand: age, locale, basis: teen ? 'teen_self' : 'adult_self', stats });
              setSaving(false);
              setStep('profile');
            }}
            data-testid="accept-continue"
          >
            {accepted ? t('start') : t('acceptFirst')}
          </Button>
          <Button variant="ghost" className="self-start" onClick={() => setStep('age')}>
            {t('back')}
          </Button>
        </section>
      )}
    </main>
  );
}
