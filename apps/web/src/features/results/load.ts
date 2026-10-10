import type { CareerMatch } from '@anabokra/engine';

import { explainCareers, genderOf, safeExplain } from './explain';
import { buildProfileView, splitMatches, toMatchView, type RawResult, type ResultView } from './view';

/** Turns a stored result into everything the results screens show. Server side only (it may call the AI). */
export async function loadResultView(
  result: RawResult,
  lang: 'ar' | 'en',
  gender: 'female' | 'male' | null,
  explain: typeof safeExplain = safeExplain,
): Promise<ResultView> {
  const { top, more, surprising } = splitMatches(result.matches);
  const explained = [...top, ...surprising.filter((s) => !top.some((t) => t.careerId === s.careerId))];
  const explanations = await explain({
    matches: explained as unknown as CareerMatch[],
    careers: explainCareers(),
    locale: lang,
    gender: genderOf(gender),
    resultId: result.id,
  });
  const exOf = new Map(explanations.map((e) => [e.careerId, e]));
  const view = (m: (typeof top)[number]) => toMatchView(m, lang, exOf.get(m.careerId));
  return {
    ...buildProfileView(result.scores),
    resultId: result.id,
    sessionId: result.sessionId,
    summary: top[0] ? (exOf.get(top[0].careerId)?.text ?? '') : '',
    top: top.map(view),
    more: more.map(view),
    surprising: surprising.map(view),
  };
}
