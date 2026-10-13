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

import { AppShell } from './app-shell';
import { JourneyGate } from './journey-gate';
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
        <section className="flex items-center gap-4 rounded-3xl bg-gradient-to-br from-brand-lilac to-card p-5 shadow-sm">
          <span className="grid size-14 place-items-center rounded-2xl bg-card shadow-sm">
            <LogoMark className="h-9" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{nickname ?? jt('account.noName')}</p>
            <p className="text-sm text-muted-foreground">{jt('account.onDevice')}</p>
          </div>
        </section>

        {!data.rt.device.persistent && <StorageWarning />}
        <InstallHint />

        <LockSetting onChanged={onChanged} />

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
