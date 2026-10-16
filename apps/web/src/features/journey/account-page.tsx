'use client';

import { useLocale, useTranslations } from 'next-intl';

import { Logo, LogoMark } from '@/components/brand/logo';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { DeleteMyData } from '@/features/local/delete-data';
import { StorageWarning } from '@/features/local/local-states';
import { LockSetting } from '@/features/local/lock-setting';
import { MoveData } from '@/features/local/move-data';
import { SessionSetting } from '@/features/local/session-setting';
import { StatsSetting } from '@/features/local/stats-setting';
import { InstallHint } from '@/features/pwa/install-hint';
import { Link } from '@/i18n/navigation';
import type { JourneyData } from '@/lib/journey/journey';
import { saveSituation } from '@/lib/journey/situation';

import { AppShell } from './app-shell';
import { HeroCard, HeroText } from './cards';
import { JourneyGate } from './journey-gate';
import { FeedbackForm } from './feedback-form';
import { SituationView } from './situation-card';
import { useJT } from './use-jt';

/** Account: the user's profile and every setting that used to sit at the foot of my island. */
export function AccountPage() {
  return <JourneyGate>{(data, reload) => <Account data={data} onChanged={reload} />}</JourneyGate>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="px-1 text-sm font-semibold text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Account({ data, onChanged }: { data: JourneyData; onChanged: () => void }) {
  const jt = useJT();
  const tDocs = useTranslations('Local.firstStart.docs');
  const locale = useLocale() as 'ar' | 'en';
  const nickname = data.rt.profile.displayName;

  return (
    <AppShell tab="account" title={jt('account.title')} testId="account">
      <div className="space-y-6">
        <HeroCard
          icon={
            <span className="grid size-14 place-items-center rounded-2xl bg-white/80 shadow-sm">
              <LogoMark className="h-9" />
            </span>
          }
          title={<span className="block truncate">{nickname ?? jt('account.noName')}</span>}
          testId="account-hero"
        >
          <HeroText>{jt('account.onDevice')}</HeroText>
        </HeroCard>

        {!data.rt.device.persistent && <StorageWarning />}
        <InstallHint />

        <LockSetting onChanged={onChanged} />

        {locale === 'ar' && <AddressSetting data={data} onChanged={onChanged} />}

        <Section title={jt('situation.settingsTitle')}>
          <SituationView
            situation={data.journey.situation}
            onSave={async (next) => {
              await saveSituation(data.rt.device.kv, data.rt.userId, next);
              onChanged();
            }}
          />
        </Section>

        <Section title={jt('feedback.title')}>
          <FeedbackForm rt={data.rt} screen="account" />
        </Section>

        <Section title={jt('account.language')}>
          <div className="surface p-2">
            <LocaleSwitcher />
          </div>
        </Section>

        <Section title={jt('account.data')}>
          <StatsSetting />
          <SessionSetting />
          <div className="surface flex flex-col items-start gap-1 py-2">
            <MoveData />
            <DeleteMyData onDeleted={onChanged} />
          </div>
        </Section>

        <footer className="flex flex-col items-center gap-3 border-t pt-6 text-sm">
          <Logo locale={locale} className="h-12" />
          <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            {(['privacy-policy', 'terms-of-use', 'children-data-notice'] as const).map((doc) => (
              <Link key={doc} href={`/legal/${doc}`} className="tap-link">
                {tDocs(doc)}
              </Link>
            ))}
          </nav>
        </footer>
      </div>
    </AppShell>
  );
}

/** How the Arabic text addresses the user (set at first start; only for grammar, stays on the phone). */
function AddressSetting({ data, onChanged }: { data: JourneyData; onChanged: () => void }) {
  const tp = useTranslations('Local.profile');
  const current = data.rt.profile.gender;
  const set = async (gender: 'male' | 'female' | null) => {
    await data.rt.device.updateProfile(data.rt.userId, { gender });
    onChanged();
  };
  return (
    <Section title={tp('addressQ')}>
      <div className="surface flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['male', tp('address.male')],
              ['female', tp('address.female')],
              [null, tp('address.none')],
            ] as const
          ).map(([value, label]) => (
            <button
              key={String(value)}
              type="button"
              aria-pressed={current === value}
              onClick={() => void set(value)}
              className={
                'min-h-11 rounded-full border px-4 text-sm font-medium transition-colors ' +
                (current === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary')
              }
              data-testid={`account-address-${value ?? 'none'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{tp('addressHelp')}</p>
      </div>
    </Section>
  );
}
