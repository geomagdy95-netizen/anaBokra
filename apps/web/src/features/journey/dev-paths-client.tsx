'use client';

import { clusters, paths } from '@anabokra/content';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { discoverArt, pathArt, type ArtChain } from '@/features/art/task-art';
import { useNumberFormat } from '@/features/assessment/primitives';
import { AssessmentProvider, useText } from '@/features/assessment/ui-context';
import { discoverPlan } from '@/lib/journey/discover-plan';
import { cn } from '@/lib/utils';

import { discoverSteps, pathSteps, readinessSteps, type Step } from './steps';
import { TaskRunner } from './task-runner';
import { useJT } from './use-jt';

/**
 * Dev preview of every island task: the draft Verify tasks (docs/review/paths-review.md) and, under
 * "My island", the readiness check and the ten Discover tasks. For the team, the psychologist and the
 * picture work (docs/art). Answers stay in this page; nothing is saved.
 */
export function DevPathsClient() {
  return (
    <AssessmentProvider gender={null}>
      <Inner />
    </AssessmentProvider>
  );
}

interface PreviewTask {
  key: string;
  title: string;
  intro?: string;
  steps: Step[];
  art: ArtChain;
}

const MINE = 'discover';

function Inner() {
  const t = useTranslations('DevPaths');
  const jt = useJT();
  const tx = useText();
  const nf = useNumberFormat();
  const ids = [MINE, ...Object.keys(paths)];
  const [pathId, setPathId] = useState(Object.keys(paths)[0]!);
  const [task, setTask] = useState<PreviewTask | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const tasks: PreviewTask[] =
    pathId === MINE
      ? [
          { key: 'readiness', title: jt('readiness.baselineTitle'), intro: jt('readiness.baselineIntro'), steps: readinessSteps(), art: ['tasks/discover/readiness', ...discoverArt()] },
          ...discoverPlan().map((d) => ({
            key: `task_${d.n}`,
            title: `${jt('task', { n: nf.format(d.n) })} · ${jt(`taskTitles.${d.n}`)}`,
            steps: discoverSteps(d),
            art: discoverArt(d.n),
          })),
        ]
      : paths[pathId]!.tasks.map((tk) => ({ key: tk.id, title: tx(tk.title), intro: tx(tk.intro), steps: pathSteps(tk, pathId), art: pathArt(pathId, tk.id) }));

  if (task)
    return (
      <TaskRunner
        title={task.title}
        intro={task.intro}
        steps={task.steps}
        art={task.art}
        initial={answers}
        onAnswer={async (step, value) => {
          setAnswers((a) => ({ ...a, [step.id]: value }));
          return true;
        }}
        onDone={() => setTask(null)}
        onClose={() => setTask(null)}
      />
    );

  const stepIds = new Set(tasks.flatMap((tk) => tk.steps.map((s) => s.id)));
  const mine = Object.entries(answers).filter(([k]) => stepIds.has(k));
  const path = paths[pathId];
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 py-6" data-testid="dev-paths">
      <header className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <LocaleSwitcher />
      </header>
      <p className="text-sm text-muted-foreground">{t('intro')}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('pick')}>
        {ids.map((id) => {
          const name = id === MINE ? t('mine') : clusters.find((c) => c.id === id)?.name;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={id === pathId}
              onClick={() => setPathId(id)}
              className={cn('rounded-full border px-3 py-1.5 text-sm', id === pathId ? 'border-primary bg-primary text-primary-foreground' : 'bg-card')}
            >
              {typeof name === 'string' ? name : name ? tx(name) : id}
            </button>
          );
        })}
      </div>
      {path && (
        <p className="text-xs text-muted-foreground">
          {path.version} · {path.status}
        </p>
      )}
      <ol className="flex flex-col gap-2">
        {tasks.map((tk, i) => (
          <li key={tk.key} className="flex items-center justify-between gap-3 rounded-2xl border p-3">
            <div className="min-w-0">
              <p className="font-medium">
                {i + 1}. {tk.title}
              </p>
              {tk.intro && <p className="text-xs text-muted-foreground">{tk.intro}</p>}
            </div>
            <Button size="sm" onClick={() => setTask(tk)} data-testid={`dev-path-task-${tk.key}`}>
              {t('task')}
            </Button>
          </li>
        ))}
      </ol>
      {mine.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold">{t('answers')}</h2>
          <pre className="mt-1 overflow-x-auto rounded-xl bg-muted p-3 text-xs" dir="ltr" data-testid="dev-path-answers">
            {JSON.stringify(Object.fromEntries(mine), null, 1)}
          </pre>
        </section>
      )}
    </main>
  );
}
