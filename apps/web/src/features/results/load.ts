import type { CareerMatch } from '@anabokra/engine';

import { assembleResultView, matchesToExplain } from './assemble';
import { explainCareers, genderOf, safeExplain } from './explain';
import type { RawResult, ResultView } from './view';

/** Turns a stored result into everything the results screens show. Server side only (it may call the AI). */
export async function loadResultView(
  result: RawResult,
  lang: 'ar' | 'en',
  gender: 'female' | 'male' | null,
  explain: typeof safeExplain = safeExplain,
): Promise<ResultView> {
  const explanations = await explain({
    matches: matchesToExplain(result) as unknown as CareerMatch[],
    careers: explainCareers(),
    locale: lang,
    gender: genderOf(gender),
    resultId: result.id,
  });
  return assembleResultView(result, lang, explanations);
}
