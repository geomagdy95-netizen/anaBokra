'use client';

import { useMemo } from 'react';

import { DEFAULT_PALETTE } from '@/features/path/palette';
import { generateWorld } from '@/features/path/generate-world';
import { PathSvg } from '@/features/path/path-svg';
import { PRESETS } from '@/features/path/presets';

/** Landing hero: a lightweight 2D render of a sample anaBokra world (no WebGL on the landing page). */
export function HeroWorld({ label }: { label: string }) {
  const world = useMemo(() => generateWorld(PRESETS.creative, 'landing'), []);
  return (
    <div className="aspect-[4/3] overflow-hidden bg-muted/30">
      <PathSvg world={world} progress={2} focus={null} onFocus={() => {}} palette={DEFAULT_PALETTE} label={label} />
    </div>
  );
}
