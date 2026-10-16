'use client';

import { careerById, clusters } from '@anabokra/content';
import { useSearchParams } from 'next/navigation';

import { pathArt } from '@/features/art/task-art';
import { AssessmentProvider, useText } from '@/features/assessment/ui-context';
import type { CareerPage } from '@/features/careers/types';
import { questBeatIds, questPlan, scoreQuest } from '@/lib/journey/career-quest';
import type { JourneyData } from '@/lib/journey/journey';
import { MemoryKv } from '@/lib/local/kv';

import { AppShell } from './app-shell';
import { CareerResultView, QuestChat } from './career-island';
import { useJT } from './use-jt';

/** Sample answers for the first `count` beats: `keen` likes everything, `cool` nothing, `mixed` half. */
function sample(page: CareerPage, count: number, mood: string): Record<string, number> {
  const a: Record<string, number> = {};
  questPlan(page)
    .slice(0, count)
    .forEach((b, n) =>
      questBeatIds(b).forEach((id, i) => {
        const yes = mood === 'keen' || (mood === 'mixed' && (n + i) % 2 === 0);
        a[id] = b.kind === 'tasks' ? (yes ? 1 : 0) : b.kind === 'salary' || b.kind === 'myth' ? 0 : yes ? 3 : mood === 'mixed' ? 2 : 1;
      }),
    );
  return a;
}

/**
 * Dev preview of a career island (L2) for design work and screenshots: `view=quest` shows the chat
 * with the first `answered` beats done, `view=result` the result from sample answers. Nothing is saved.
 */
export function DevCareerClient({ careerId, page }: { careerId: string; page: CareerPage }) {
  return (
    <AssessmentProvider gender={null}>
      <Inner careerId={careerId} page={page} />
    </AssessmentProvider>
  );
}

function Inner({ careerId, page }: { careerId: string; page: CareerPage }) {
  const jt = useJT();
  const tx = useText();
  const q = useSearchParams();
  const career = careerById(careerId)!;
  const name = tx(career.name);
  const mood = q.get('mood') ?? 'mixed';
  if (q.get('view') !== 'result')
    return (
      <QuestChat
        title={jt('career.questTitle', { career: name })}
        art={pathArt(career.cluster)}
        careerName={name}
        beats={questPlan(page)}
        initial={sample(page, Number(q.get('answered') ?? 0), mood)}
        onAnswer={async () => true}
        onDone={() => undefined}
        onClose={() => undefined}
      />
    );
  const result = scoreQuest(page, sample(page, 99, mood), { profileFit: Number(q.get('fit') ?? 62) });
  const data = { rt: { userId: 'dev', device: { kv: new MemoryKv() } }, journey: { v: 1, paths: {}, selectedCareers: q.get('mine') ? [careerId] : [] } } as unknown as JourneyData;
  const group = clusters.find((c) => c.id === career.cluster);
  return (
    <AppShell tab="explore" back="/dev/paths" title={name} subtitle={group ? tx(group.name) : ''} testId="dev-career">
      <div className="flex flex-col gap-5">
        <CareerResultView data={data} page={page} result={result} name={name} groupId={career.cluster} onAgain={() => undefined} onChanged={() => undefined} />
      </div>
    </AppShell>
  );
}
