import { enjoyId, pathById } from '@anabokra/content';

import type { KvStore } from '@/lib/local/kv';

import { saveVerifyAnswer, saveVerifyResult, scoreVerify } from './verify';

/** Test helper: answers every item of a path and saves its result, as the Verify screen would. */
export async function checkPath(kv: KvStore, profileId: string, pathId: string) {
  const path = pathById(pathId)!;
  const answers: Record<string, number> = {};
  for (const task of path.tasks)
    for (const item of task.items) {
      if (task.kind === 'story') answers[item.id] = 3;
      else if (task.kind === 'thisOrThat') answers[item.id] = 0;
      else {
        answers[item.id] = 0;
        answers[enjoyId(item.id)] = 2;
      }
    }
  for (const [id, v] of Object.entries(answers)) await saveVerifyAnswer(kv, profileId, pathId, id, v);
  const result = scoreVerify(path, answers, { groupFit: 70, careerFits: {} });
  await saveVerifyResult(kv, profileId, result);
  return { answers, result };
}
