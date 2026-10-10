'use client';

import { Bookmark } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

import { useExplorePersonal } from './personal-context';
import type { SavedFailure } from './saved-ref';

/** Save toggle. Signed-out visitors get a sign-in link; consent/storage errors are announced politely. */
export function SaveButton({ saveRef, name, nextPath, compact = false }: { saveRef: string; name: string; nextPath: string; compact?: boolean }) {
  const t = useTranslations('Explore.save');
  const { data, ready, isSaved, toggleSaved } = useExplorePersonal();
  const [error, setError] = useState<SavedFailure | null>(null);
  const [busy, setBusy] = useState(false);
  const active = isSaved(saveRef);

  if (ready && !data.signedIn) {
    return (
      <Button asChild variant="outline" size={compact ? 'sm' : 'default'}>
        <Link href={`/login?next=${encodeURIComponent(nextPath)}`}>
          <Bookmark aria-hidden />
          {t('signIn')}
        </Link>
      </Button>
    );
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant={active ? 'secondary' : 'outline'}
        size={compact ? 'sm' : 'default'}
        aria-pressed={active}
        aria-label={active ? t('removeNamed', { name }) : t('addNamed', { name })}
        disabled={!ready || busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          setError(await toggleSaved(saveRef));
          setBusy(false);
        }}
      >
        <Bookmark aria-hidden className={cn(active && 'fill-current')} />
        {active ? t('saved') : t('save')}
      </Button>
      <p role="status" aria-live="polite" className="text-sm text-destructive empty:hidden">
        {error ? t(`error.${error}`) : ''}
      </p>
    </div>
  );
}
