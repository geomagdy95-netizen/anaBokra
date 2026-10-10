import type { CareerExplanation } from '@anabokra/ai';

import { buildProfileView, splitMatches, toMatchView, type RawResult, type ResultView } from './view';

/** The matches that get an explanation: the top ones plus any surprising ones not already there. */
export function matchesToExplain(result: RawResult) {
  const { top, surprising } = splitMatches(result.matches);
  return [...top, ...surprising.filter((s) => !top.some((t) => t.careerId === s.careerId))];
}

/** Puts a stored result and its explanations together into everything the results screens show. */
export function assembleResultView(result: RawResult, lang: 'ar' | 'en', explanations: CareerExplanation[]): ResultView {
  const { top, more, surprising } = splitMatches(result.matches);
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
