'use client';

import { Share, Smartphone, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { promptInstall, useInstallMode } from './install';

const DISMISSED = 'anabokra.installHint.dismissed';

function wasDismissed() {
  try {
    return typeof window !== 'undefined' && localStorage.getItem(DISMISSED) === '1';
  } catch {
    return false;
  }
}

/**
 * "Add to your home screen": a button where Chrome offers its prompt, the Share steps on iPhone, and
 * nothing once installed or where it can't be installed. On Home it can be closed (remembered on this
 * phone); in Account it always shows.
 */
export function InstallHint({ dismissible = false }: { dismissible?: boolean }) {
  const t = useTranslations('Pwa');
  const mode = useInstallMode();
  // Read on the first client render; the server and hydration render nothing (useInstallMode), so
  // the markup always matches.
  const [dismissed, setDismissed] = useState(() => dismissible && wasDismissed());

  if (mode === 'installed' || mode === 'none' || dismissed) return null;

  const close = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED, '1');
    } catch {
      // storage blocked: hidden until the page reloads
    }
  };

  return (
    <section className="surface relative flex gap-3" data-testid="install-hint">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
        <Smartphone className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-1 pe-8">
        <h2 className="font-bold">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('body')}</p>
        {mode === 'ios' ? (
          <>
            <p className="flex flex-wrap items-center gap-1 pt-1 text-sm font-medium">
              {t.rich('iosSteps', { share: () => <Share className="inline size-4 text-primary" aria-label={t('shareButton')} /> })}
            </p>
            <p className="text-xs text-muted-foreground">{t('iosKeep')}</p>
          </>
        ) : (
          <Button size="sm" className="mt-2" onClick={() => void promptInstall()} data-testid="install">
            {t('install')}
          </Button>
        )}
      </div>
      {dismissible && (
        <button onClick={close} aria-label={t('dismiss')} className="absolute end-1 top-1 grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground">
          <X className="size-5" aria-hidden />
        </button>
      )}
    </section>
  );
}
