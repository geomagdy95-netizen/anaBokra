'use client';

import { careers, clusters, enjoyId, pathById } from '@anabokra/content';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { AssessmentProvider, useText } from '@/features/assessment/ui-context';
import { scoreVerify } from '@/lib/journey/verify';

import { AppShell } from './app-shell';
import { useJT } from './use-jt';
import { Result } from './verify-page';

/** Sample answers: `keen` likes everything and accepts the realities, `cool` the opposite, `mixed` in between. */
function sampleAnswers(pathId: string, mood: string): Record<string, number> {
  const path = pathById(pathId)!;
  const a: Record<string, number> = {};
  let n = 0;
  for (const task of path.tasks)
    for (const item of task.items) {
      const yes = mood === 'keen' || (mood === 'mixed' && n++ % 2 === 0);
      if (task.kind === 'story') a[item.id] = yes ? 3 : mood === 'mixed' ? 2 : 1;
      if (task.kind === 'thisOrThat') a[item.id] = ((item as { path: 'a' | 'b' }).path === 'a') === yes ? 0 : 1;
      if (task.kind === 'tryIt') {
        a[item.id] = 0;
        a[enjoyId(item.id)] = yes ? 3 : 1;
      }
    }
  return a;
}

/**
 * Dev preview of the path result (docs/product/discover-verify.md §5.3) from sample answers, for design
 * work and screenshots: `?path=` a path id, `fit=` the Discover fit 0–100, `mood=` keen | mixed | cool.
 */
export function DevResultClient() {
  return (
    <AssessmentProvider gender={null}>
      <Inner />
    </AssessmentProvider>
  );
}

function Inner() {
  const jt = useJT();
  const tx = useText();
  const q = useSearchParams();
  const [saved, setSaved] = useState(false);
  const pathId = q.get('path') && pathById(q.get('path')!) ? q.get('path')! : 'tourism';
  const fit = Number(q.get('fit') ?? 55);
  const path = pathById(pathId)!;
  const careerFits = Object.fromEntries(careers.filter((c) => c.cluster === pathId).map((c, i) => [c.id, Math.max(0, fit + 12 - i * 5)]));
  const result = scoreVerify(path, sampleAnswers(pathId, q.get('mood') ?? 'mixed'), { groupFit: fit, careerFits });
  const group = clusters.find((c) => c.id === pathId);
  return (
    <AppShell tab="explore" back="/dev/paths" title={group ? tx(group.name) : pathId} subtitle={jt('verify.eyebrow')} testId="dev-result">
      <div className="flex flex-col gap-5">
        <Result path={path} result={result} onAgain={() => undefined} rating={null} saved={saved} onSave={async (on) => setSaved(on)} />
      </div>
    </AppShell>
  );
}
