'use client';

import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

import { usePersonal, type FavoriteFailure } from './personal-context';

/**
 * Favorite toggle. Signed-out visitors get a sign-in link instead; a guardian-consent refusal or a
 * storage error is explained in a polite live region, never as a crash.
 */
export function FavoriteButton({ careerId, name, nextPath, compact = false }: { careerId: string; name: string; nextPath: string; compact?: boolean }) {
  const t = useTranslations('Careers.favorite');
  const { data, ready, isFavorite, toggleFavorite } = usePersonal();
  const [error, setError] = useState<FavoriteFailure | null>(null);
  const [busy, setBusy] = useState(false);
  const active = isFavorite(careerId);

  if (ready && !data.signedIn) {
    return (
      <Button asChild variant="outline" size={compact ? 'sm' : 'default'}>
        <Link href={`/login?next=${encodeURIComponent(nextPath)}`}>
          <Heart aria-hidden />
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
          setError(await toggleFavorite(careerId));
          setBusy(false);
        }}
      >
        <Heart aria-hidden className={cn(active && 'fill-current')} />
        {active ? t('saved') : t('save')}
      </Button>
      <p role="status" aria-live="polite" className="text-sm text-destructive empty:hidden">
        {error ? t(`error.${error}`) : ''}
      </p>
    </div>
  );
}
