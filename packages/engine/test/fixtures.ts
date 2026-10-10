import type { CareerForMatching, LikertInstrument, ValuesInstrument, AbilitiesInstrument } from '../src';

export const likert: LikertInstrument = {
  id: 't',
  version: '1',
  kind: 'likert',
  name: { en: 'Test', ar: 'اختبار' },
  source: { name: 'test', url: '', license: '' },
  responseScale: { min: 1, max: 5, labels: [] },
  scales: [
    { id: 'a', name: { en: 'A', ar: 'A' } },
    { id: 'b', name: { en: 'B', ar: 'B' } },
  ],
  items: [
    { id: 'a1', scale: 'a', keyed: 1, text: { en: '', ar: '' } },
    { id: 'a2', scale: 'a', keyed: -1, text: { en: '', ar: '' } },
    { id: 'b1', scale: 'b', keyed: 1, text: { en: '', ar: '' } },
    { id: 'ac', text: { en: '', ar: '' }, attentionCheck: { expected: 5 } },
  ],
};

export const valuesInstrument: ValuesInstrument = {
  id: 'v',
  version: '1',
  kind: 'cardSort',
  name: { en: '', ar: '' },
  source: { name: '', url: '', license: '' },
  buckets: [
    { id: 'must', name: { en: '', ar: '' }, weight: 3 },
    { id: 'nice', name: { en: '', ar: '' }, weight: 2 },
    { id: 'no', name: { en: '', ar: '' }, weight: 1 },
  ],
  cards: [
    { id: 'c_ach', value: 'achievement', text: { en: '', ar: '' } },
    { id: 'c_wc', value: 'workingConditions', text: { en: '', ar: '' } },
    { id: 'c_rec', value: 'recognition', text: { en: '', ar: '' } },
    { id: 'c_rel', value: 'relationships', text: { en: '', ar: '' } },
    { id: 'c_sup', value: 'support', text: { en: '', ar: '' } },
    { id: 'c_ind', value: 'independence', text: { en: '', ar: '' } },
  ],
};

export const abilitiesInstrument: AbilitiesInstrument = {
  id: 'ab',
  version: '1',
  kind: 'abilities',
  name: { en: '', ar: '' },
  source: { name: '', url: '', license: '' },
  selfRatingScale: { min: 1, max: 5, labels: [] },
  selfRatings: (['verbal', 'numerical', 'logical', 'spatial', 'creative', 'manual'] as const).map((d) => ({
    id: `s_${d}`,
    domain: d,
    text: { en: '', ar: '' },
  })),
  performance: [
    { id: 'p1', domain: 'numerical', prompt: { en: '', ar: '' }, options: [], answerIndex: 2 },
    { id: 'p2', domain: 'numerical', prompt: { en: '', ar: '' }, options: [], answerIndex: 0 },
  ],
  performanceWeight: 0.7,
};

const flatAbilities = { level: 0.5, importance: 0.5 };

export function career(
  id: string,
  riasec: [number, number, number, number, number, number],
  cluster = 'x',
): CareerForMatching {
  const [R, I, A, S, E, C] = riasec;
  return {
    id,
    cluster,
    traits: {
      riasec: { R, I, A, S, E, C },
      personality: { extraversion: 0.5, agreeableness: 0.5, conscientiousness: 0.5, emotionalStability: 0.5, intellect: 0.5 },
      values: { achievement: 0.5, workingConditions: 0.5, recognition: 0.5, relationships: 0.5, support: 0.5, independence: 0.5 },
      abilities: {
        verbal: flatAbilities,
        numerical: flatAbilities,
        logical: flatAbilities,
        spatial: flatAbilities,
        creative: flatAbilities,
        manual: flatAbilities,
      },
    },
  };
}
