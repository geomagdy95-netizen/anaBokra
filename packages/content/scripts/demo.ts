/**
 * End-to-end demo: simulated answers → scores → top career matches with reasons.
 *   pnpm demo [persona]     personas: scientist | creative | helper | builder | leader
 */
import {
  checkQuality,
  interestProfile,
  personalityProfile,
  rankCareers,
  scoreAbilities,
  scoreLikert,
  scoreValues,
  surprisingMatches,
  type ItemResponse,
  type ValueBucket,
  type WorkValue,
} from '@anabokra/engine';
import { careerById, careers, instruments } from '../src';

type Persona = {
  likes: Record<string, number>; // RIASEC letter → typical answer 1..5
  traits: Record<string, number>; // Big Five → typical answer 1..5 for + keyed items
  values: WorkValue[]; // values put in "must have"
  strengths: Record<string, number>; // ability domain → self rating 1..5
};

const personas: Record<string, Persona> = {
  scientist: {
    likes: { R: 2, I: 5, A: 3, S: 2, E: 1, C: 3 },
    traits: { extraversion: 2, agreeableness: 3, conscientiousness: 4, emotionalStability: 4, intellect: 5 },
    values: ['achievement', 'independence'],
    strengths: { verbal: 4, numerical: 5, logical: 5, spatial: 4, creative: 3, manual: 2 },
  },
  creative: {
    likes: { R: 2, I: 3, A: 5, S: 3, E: 3, C: 1 },
    traits: { extraversion: 4, agreeableness: 4, conscientiousness: 2, emotionalStability: 3, intellect: 5 },
    values: ['independence', 'recognition'],
    strengths: { verbal: 4, numerical: 2, logical: 3, spatial: 4, creative: 5, manual: 3 },
  },
  helper: {
    likes: { R: 1, I: 3, A: 3, S: 5, E: 2, C: 2 },
    traits: { extraversion: 4, agreeableness: 5, conscientiousness: 4, emotionalStability: 3, intellect: 3 },
    values: ['relationships', 'support'],
    strengths: { verbal: 5, numerical: 3, logical: 3, spatial: 2, creative: 3, manual: 2 },
  },
  builder: {
    likes: { R: 5, I: 3, A: 2, S: 1, E: 2, C: 4 },
    traits: { extraversion: 2, agreeableness: 3, conscientiousness: 5, emotionalStability: 4, intellect: 3 },
    values: ['workingConditions', 'achievement'],
    strengths: { verbal: 2, numerical: 4, logical: 4, spatial: 5, creative: 3, manual: 5 },
  },
  leader: {
    likes: { R: 2, I: 2, A: 3, S: 3, E: 5, C: 4 },
    traits: { extraversion: 5, agreeableness: 3, conscientiousness: 4, emotionalStability: 4, intellect: 4 },
    values: ['recognition', 'achievement'],
    strengths: { verbal: 5, numerical: 4, logical: 4, spatial: 3, creative: 4, manual: 2 },
  },
};

const name = process.argv[2] ?? 'scientist';
const p = personas[name];
if (!p) throw new Error(`Unknown persona "${name}". Try: ${Object.keys(personas).join(', ')}`);

// Deterministic jitter so answers aren't perfectly flat.
let seed = 7;
const jitter = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280 < 0.3 ? (seed % 2 ? 1 : -1) : 0);
const clamp = (v: number) => Math.min(5, Math.max(1, v));

const interestAnswers: ItemResponse[] = instruments.interests.items.map((i) => ({
  itemId: i.id,
  value: i.attentionCheck ? i.attentionCheck.expected : clamp(p.likes[i.scale!]! + jitter()),
  ms: 2500,
}));
const personalityAnswers: ItemResponse[] = instruments.personality.items.map((i) => {
  if (i.attentionCheck) return { itemId: i.id, value: i.attentionCheck.expected, ms: 3000 };
  const level = p.traits[i.scale!]!;
  return { itemId: i.id, value: clamp((i.keyed === -1 ? 6 - level : level) + jitter()), ms: 3000 };
});
const placements = Object.fromEntries(
  instruments.values.cards.map((c) => [c.id, (p.values.includes(c.value) ? 'must' : c.value === 'support' ? 'no' : 'nice') as ValueBucket]),
);
const selfRatings = instruments.abilities.selfRatings.map((s) => ({ itemId: s.id, value: p.strengths[s.domain]! }));

const interests = interestProfile(scoreLikert(instruments.interests, interestAnswers))!;
const personality = personalityProfile(scoreLikert(instruments.personality, personalityAnswers))!;
const values = scoreValues(instruments.values, placements, p.values)!;
const abilities = scoreAbilities(instruments.abilities, selfRatings, [])!;
const quality = checkQuality(instruments.interests, interestAnswers);

const pct = (x: number) => `${Math.round(x * 100)}`.padStart(3);
console.log(`\nPersona: ${name}`);
console.log(`Holland code: ${interests.code}  (differentiation ${interests.differentiation.toFixed(2)}, consistency ${interests.consistency}/3)`);
console.log(`Interests:    ${Object.entries(interests.scores).map(([k, v]) => `${k}${pct(v)}`).join('  ')}`);
console.log(`Personality:  ${Object.entries(personality).map(([k, v]) => `${k.slice(0, 5)}${pct(v)}`).join('  ')}`);
console.log(`Top values:   ${values.ranking.slice(0, 3).join(', ')}`);
console.log(`Quality:      ${quality.flags.length ? quality.flags.join(', ') : 'ok'}`);

const ranked = rankCareers(
  { interests: interests.scores, personality, values: values.scores, abilities: abilities.scores },
  careers,
);

const describe = (r: (typeof ranked)[number]['reasons'][number]) =>
  r.kind === 'interest' ? `interest ${r.types.join('')}` : r.kind === 'personality' ? r.trait : r.kind === 'value' ? `values ${r.value}` : `${r.domain} ability`;

console.log('\nTop 10 matches');
for (const m of ranked.slice(0, 10)) {
  const c = careerById(m.careerId)!;
  const comps = Object.entries(m.components).map(([k, v]) => `${k.slice(0, 4)} ${Math.round(v!)}`).join(' · ');
  console.log(`  ${m.fit.toFixed(1).padStart(5)}  ${c.name.en.padEnd(38)} ${c.hollandCode}  [${comps}]`);
  console.log(`         why: ${m.reasons.map(describe).join('; ') || '—'}${m.watchOuts.length ? `   watch: ${m.watchOuts.map((w) => (w.kind === 'abilityGap' ? `${w.domain} gap` : `${w.trait} stretch`)).join(', ')}` : ''}`);
}
console.log('\nSurprising matches');
for (const m of surprisingMatches(ranked)) console.log(`  ${m.fit.toFixed(1).padStart(5)}  ${careerById(m.careerId)!.name.en} (${m.cluster})`);
console.log('\nLowest 3');
for (const m of ranked.slice(-3)) console.log(`  ${m.fit.toFixed(1).padStart(5)}  ${careerById(m.careerId)!.name.en}`);
