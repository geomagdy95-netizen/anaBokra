'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useRenderer } from '@/features/path/capabilities';
import { generateWorld } from '@/features/path/generate-world';
import { PathView, ViewPlaceholder } from '@/features/path/path-view';
import type { WorldProfile } from '@/features/path/types';

import { useRT } from './use-rt';

const PLAY_MS = 3600;

/**
 * E1: the user's generated world, camera pulling back from the landmark to the whole map.
 * 2D fallback and reduced motion show the final frame at once. Skippable at any moment.
 */
export function Reveal({ profile, onContinue }: { profile: WorldProfile; onContinue: () => void }) {
  const rt = useRT();
  const r = useRenderer();
  const world = useMemo(() => generateWorld(profile), [profile]);
  const [skipped, setSkipped] = useState(false);
  const [elapsed, setElapsed] = useState(false);

  const animated = r.ready && r.renderer === '3d' && !r.reducedMotion;
  const playing = animated && !skipped && !elapsed;

  useEffect(() => {
    if (!animated) return;
    const id = window.setTimeout(() => setElapsed(true), PLAY_MS);
    return () => window.clearTimeout(id);
  }, [animated]);

  return (
    <section aria-label={rt('reveal.label')} className="flex flex-1 flex-col gap-4" data-testid="reveal" data-playing={playing}>
      <div className="relative min-h-[55dvh] flex-1 overflow-hidden rounded-xl border bg-muted">
        {r.ready ? (
          <PathView
            world={world}
            progress={4}
            focus={null}
            onFocus={() => {}}
            renderer={r.renderer}
            label={rt('reveal.sceneLabel')}
            reducedMotion={r.reducedMotion}
            onFailure={r.reportFailure}
            intro={playing ? 'play' : 'end'}
          />
        ) : (
          <ViewPlaceholder />
        )}
        {playing && (
          <div className="absolute inset-x-0 top-0 flex justify-end p-3">
            <Button type="button" variant="secondary" size="sm" onClick={() => setSkipped(true)} data-testid="skip-reveal">
              {rt('reveal.skip')}
            </Button>
          </div>
        )}
      </div>
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 text-center">
        {!playing && r.ready ? (
          <>
            <h1 className="text-3xl font-semibold" data-testid="reveal-caption">
              {rt('reveal.caption')}
            </h1>
            <p className="max-w-prose text-muted-foreground">{rt('reveal.sub')}</p>
            <Button size="lg" onClick={onContinue} data-testid="reveal-continue">
              {rt('reveal.continue')}
            </Button>
          </>
        ) : null}
      </div>
    </section>
  );
}
