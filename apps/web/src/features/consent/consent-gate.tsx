'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

/** The explanation card on its own (also used where there is nothing to dim, e.g. a blocked page). */
export function ConsentGateCard({ className = '' }: { className?: string }) {
  const t = useTranslations('Consent.gate');
  return (
    <div role="alertdialog" aria-labelledby="consent-gate-title" aria-describedby="consent-gate-body" data-testid="consent-gate" className={`flex flex-col gap-3 rounded-lg border bg-card p-5 text-card-foreground shadow-md ${className}`}>
      <h2 id="consent-gate-title" className="text-lg font-semibold">
        {t('title')}
      </h2>
      <p id="consent-gate-body" className="text-sm text-muted-foreground">
        {t('body')}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/ask-parent">{t('cta')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/school/join">{t('classCta')}</Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * Consent gate overlay for locked features. Under-18 students without an active guardian consent see the
 * feature dimmed and inert with the explanation on top; everyone else gets the children untouched.
 * `locked` comes from the server (consent state is never decided on the client).
 */
export function ConsentGate({ locked, children }: { locked: boolean; children: ReactNode }) {
  if (!locked) return <>{children}</>;
  return (
    <div className="relative" data-testid="consent-gate-wrapper">
      <div aria-hidden="true" inert className="pointer-events-none select-none opacity-40 blur-[2px]">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <ConsentGateCard className="max-w-sm" />
      </div>
    </div>
  );
}
