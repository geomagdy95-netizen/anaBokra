'use client';

import { BANDS, bandLevel, type Band } from './bands';
import { cn } from './ui';
import { useRT } from './use-rt';

/** Four segments filled up to the band. The band name is always printed next to it, so colour is never the only signal. */
export function BandBar({ band }: { band: Band }) {
  const rt = useRT();
  const level = bandLevel(band);
  return (
    <div className="flex items-center gap-2">
      <div aria-hidden="true" className="flex w-28 gap-1">
        {BANDS.map((b, i) => (
          <span key={b} className={cn('h-2 flex-1 rounded-full', i < level ? 'bg-primary' : 'bg-muted')} />
        ))}
      </div>
      <span className="text-sm font-medium" data-testid="band-label">
        {rt(`bands.${band}`)}
      </span>
    </div>
  );
}
