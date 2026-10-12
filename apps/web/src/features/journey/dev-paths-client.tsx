'use client';

import { clusters, paths, type PathTask } from '@anabokra/content';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { AssessmentProvider, useText } from '@/features/assessment/ui-context';
import { cn } from '@/lib/utils';

import { pathSteps } from './steps';
import { TaskRunner } from './task-runner';

/**
 * Dev preview of the draft Verify tasks (docs/review/paths-review.md), so the team and the
 * psychologist can try them on a phone. Answers stay in this page; nothing is saved.
 */
export function DevPathsClient() {
  return (
    <AssessmentProvider gender={null}>
      <Inner />
    </AssessmentProvider>
  );
}

function Inner() {
  const t = useTranslations('DevPaths');
  const tx = useText();
  const ids = Object.keys(paths);
  const [pathId, setPathId] = useState(ids[0]!);
  const [task, setTask] = useState<PathTask | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const path = paths[pathId]!;

  if (task)
    return (
      <TaskRunner
        title={tx(task.title)}
        intro={tx(task.intro)}
        steps={pathSteps(task)}
        initial={answers}
        onAnswer={async (step, value) => {
          setAnswers((a) => ({ ...a, [step.id]: value }));
          return true;
        }}
        onDone={() => setTask(null)}
        onClose={() => setTask(null)}
      />
    );

  const mine = Object.entries(answers).filter(([k]) => k.startsWith(`${pathId}_`));
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 py-6" data-testid="dev-paths">
      <header className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <LocaleSwitcher />
      </header>
      <p className="text-sm text-muted-foreground">{t('intro')}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('pick')}>
        {ids.map((id) => {
          const name = clusters.find((c) => c.id === id)?.name;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={id === pathId}
              onClick={() => setPathId(id)}
              className={cn('rounded-full border px-3 py-1.5 text-sm', id === pathId ? 'border-primary bg-primary text-primary-foreground' : 'bg-card')}
            >
              {name ? tx(name) : id}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {path.version} · {path.status}
      </p>
      <ol className="flex flex-col gap-2">
        {path.tasks.map((tk, i) => (
          <li key={tk.id} className="flex items-center justify-between gap-3 rounded-2xl border p-3">
            <div className="min-w-0">
              <p className="font-medium">
                {i + 1}. {tx(tk.title)}
              </p>
              <p className="text-xs text-muted-foreground">{tx(tk.intro)}</p>
            </div>
            <Button size="sm" onClick={() => setTask(tk)} data-testid={`dev-path-task-${tk.id}`}>
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
