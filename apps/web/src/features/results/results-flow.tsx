'use client';

import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import type { WorldProfile } from '@/features/path/types';

import { Matches } from './matches';
import { ProfileOverview } from './profile-overview';
import { ReadinessCheck, type ReadinessInstrument } from './readiness-check';
import { Reveal } from './reveal';
import { SharePanel } from './share-panel';
import { useRT } from './use-rt';
import type { ResultView } from './view';

type Stage = 'reveal' | 'readiness' | 'main';

/** E1 reveal -> E2 readiness (once) -> E3 overview + E5 matches + E6 share. */
export function ResultsFlow({
  view,
  worldProfile,
  fresh,
  readinessDone,
  readiness,
  partial,
  share = true,
  title = true,
  after,
}: {
  view: ResultView;
  worldProfile: WorldProfile;
  fresh: boolean;
  readinessDone: boolean;
  readiness: ReadinessInstrument;
  partial: boolean;
  /** The share card is rendered on the server from the stored result, so phase 1 (data on the device) hides it. */
  share?: boolean;
  /** False when the screen frame already shows the title (phase 1 app shell). */
  title?: boolean;
  /** Shown at the end of the main view (phase 1: the results rating). */
  after?: ReactNode;
}) {
  const rt = useRT();
  const [stage, setStage] = useState<Stage>(fresh ? 'reveal' : 'main');
  const [done, setDone] = useState(readinessDone);
  const [dismissed, setDismissed] = useState(false);

  const afterReveal = () => {
    setStage(done ? 'main' : 'readiness');
  };
  const finishReadiness = () => {
    setDone(true);
    setStage('main');
  };
  const skipReadiness = () => {
    setDismissed(true);
    setStage('main');
  };

  if (stage === 'reveal') return <Reveal profile={worldProfile} onContinue={afterReveal} />;

  if (stage === 'readiness' && !done) {
    return <ReadinessCheck sessionId={view.sessionId} instrument={readiness} onDone={finishReadiness} onSkip={skipReadiness} />;
  }

  return (
    <div className="flex flex-col gap-8">
      {title && <h1 className="text-2xl font-bold">{rt('overview.title')}</h1>}
      {!done && !dismissed ? (
        <ReadinessCheck sessionId={view.sessionId} instrument={readiness} onDone={finishReadiness} onSkip={skipReadiness} />
      ) : null}
      <ProfileOverview view={view} summary={view.summary} partial={partial} />
      <Matches top={view.top} more={view.more} surprising={view.surprising} />
      {share && <SharePanel />}
      {after}
      <div>
        <Button type="button" variant="ghost" onClick={() => setStage('reveal')} data-testid="replay-reveal">
          {rt('reveal.replay')}
        </Button>
      </div>
    </div>
  );
}
