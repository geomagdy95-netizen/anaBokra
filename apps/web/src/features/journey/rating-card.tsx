'use client';

import { instruments } from '@anabokra/content';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useText } from '@/features/assessment/ui-context';
import type { JourneyData } from '@/lib/journey/journey';
import { saveRating } from '@/lib/journey/verify';
import { cn } from '@/lib/utils';

import { useJT } from './use-jt';

/**
 * "My results were clear and useful" (pilot plan §7: target 4 out of 5), asked once, right after the
 * first path result and on the profile until answered. Kept on the phone; sent as an anonymous record
 * only with the statistics opt-in. Uses the readiness check's agree scale.
 */
export function RatingCard({ data, onChanged }: { data: JourneyData; onChanged: () => void }) {
  const jt = useJT();
  const text = useText();
  const [value, setValue] = useState<number | null>(null);
  const [state, setState] = useState<'open' | 'saving' | 'thanks' | 'error' | 'later'>('open');
  const { labels, min } = instruments.readiness.responseScale;

  if (state === 'later' || (data.journey.rating && state !== 'thanks')) return null;

  if (state === 'thanks')
    return (
      <p role="status" className="surface text-sm font-medium" data-testid="rating-thanks">
        {jt('rating.thanks')}
      </p>
    );

  const send = async () => {
    if (value === null) return;
    setState('saving');
    try {
      await saveRating(data.rt.device.kv, data.rt.userId, value);
      setState('thanks');
      void import('@/lib/local/stats').then(({ syncStats }) => syncStats(data.rt));
      onChanged();
    } catch {
      setState('error');
    }
  };

  return (
    <section className="surface flex flex-col gap-3 ring-2 ring-primary/30" aria-labelledby="rating-h" data-testid="rating">
      <h2 id="rating-h" className="font-bold">
        {jt('rating.title')}
      </h2>
      <fieldset>
        <legend className="mb-2 text-sm text-muted-foreground">{jt('rating.question')}</legend>
        <div className="grid grid-cols-5 gap-1.5">
          {labels.map((label, i) => {
            const v = min + i;
            const checked = value === v;
            return (
              <label
                key={v}
                className={cn(
                  'flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border px-1 py-1.5 text-center text-[0.7rem] leading-tight has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
                  checked ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-accent',
                )}
              >
                <input type="radio" name="rating" value={v} checked={checked} onChange={() => setValue(v)} className="sr-only" data-testid={`rating-${v}`} />
                <span className="text-base font-semibold tabular-nums" aria-hidden="true">
                  {v}
                </span>
                <span>{text(label)}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {state === 'error' && (
        <p role="alert" className="text-sm text-destructive">
          {jt('rating.error')}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{jt('rating.privacy')}</p>
      <div className="flex gap-2">
        <Button onClick={() => void send()} disabled={value === null || state === 'saving'} data-testid="rating-send">
          {jt('rating.send')}
        </Button>
        <Button variant="ghost" onClick={() => setState('later')}>
          {jt('rating.later')}
        </Button>
      </div>
    </section>
  );
}
