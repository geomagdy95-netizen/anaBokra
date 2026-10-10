/**
 * Builds careers.generated.json from the curated catalog + O*NET database text files.
 *
 *   pnpm build:careers [--onet <O*NET 31 text dir>] [--values <dir containing "Work Values.txt">]
 *
 * Defaults: data/raw/onet31 and data/raw/onet30 at the repo root (see README for download steps).
 * O*NET data © U.S. Department of Labor/ETA, licensed CC BY 4.0.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ABILITY_DOMAINS,
  BIG_FIVE,
  RIASEC,
  WORK_VALUES,
  type AbilityDomain,
  type BigFive,
  type CareerTraits,
  type Riasec,
  type WorkValue,
} from '@anabokra/engine';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return resolve(i > -1 ? process.argv[i + 1]! : fallback);
};
const onetDir = arg('onet', join(root, 'data/raw/onet31'));
const valuesDir = arg('values', join(root, 'data/raw/onet30'));

// ---------------------------------------------------------------------------
// Mappings (O*NET element → anaBokra dimension). Reviewed by the psychologist.
// ---------------------------------------------------------------------------

const INTEREST_ELEMENTS: Record<string, Riasec> = {
  '1.B.1.a': 'R', '1.B.1.b': 'I', '1.B.1.c': 'A', '1.B.1.d': 'S', '1.B.1.e': 'E', '1.B.1.f': 'C',
};

/** O*NET 31 Work Styles (2025 taxonomy) grouped under the Big Five factor they mainly express. */
const WORK_STYLE_FACTORS: Record<string, BigFive> = {
  Innovation: 'intellect',
  'Intellectual Curiosity': 'intellect',
  'Tolerance for Ambiguity': 'intellect',
  Adaptability: 'intellect',
  'Achievement Orientation': 'conscientiousness',
  Perseverance: 'conscientiousness',
  'Attention to Detail': 'conscientiousness',
  Dependability: 'conscientiousness',
  Cautiousness: 'conscientiousness',
  'Leadership Orientation': 'extraversion',
  'Social Orientation': 'extraversion',
  Initiative: 'extraversion',
  'Self-Confidence': 'extraversion',
  Humility: 'agreeableness',
  Sincerity: 'agreeableness',
  Empathy: 'agreeableness',
  Cooperation: 'agreeableness',
  Integrity: 'agreeableness',
  'Stress Tolerance': 'emotionalStability',
  'Self-Control': 'emotionalStability',
  Optimism: 'emotionalStability',
};

const VALUE_ELEMENTS: Record<string, WorkValue> = {
  '1.B.2.a': 'achievement', '1.B.2.b': 'workingConditions', '1.B.2.c': 'recognition',
  '1.B.2.d': 'relationships', '1.B.2.e': 'support', '1.B.2.f': 'independence',
};

const ABILITY_ELEMENTS: Record<string, AbilityDomain> = {
  'Oral Comprehension': 'verbal',
  'Written Comprehension': 'verbal',
  'Oral Expression': 'verbal',
  'Written Expression': 'verbal',
  'Mathematical Reasoning': 'numerical',
  'Number Facility': 'numerical',
  'Deductive Reasoning': 'logical',
  'Inductive Reasoning': 'logical',
  'Information Ordering': 'logical',
  'Problem Sensitivity': 'logical',
  'Spatial Orientation': 'spatial',
  Visualization: 'spatial',
  'Fluency of Ideas': 'creative',
  Originality: 'creative',
  'Manual Dexterity': 'manual',
  'Finger Dexterity': 'manual',
  'Arm-Hand Steadiness': 'manual',
  'Control Precision': 'manual',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readTsv(dir: string, file: string): Record<string, string>[] {
  const path = join(dir, file);
  if (!existsSync(path)) throw new Error(`Missing ${path}. See README → "Career data".`);
  const [header, ...lines] = readFileSync(path, 'utf8').trimEnd().split(/\r?\n/);
  const cols = header!.split('\t');
  return lines.map((l) => {
    const cells = l.split('\t');
    return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? '']));
  });
}

/** occupation → key → list of values */
type Acc = Map<string, Map<string, number[]>>;
function push(acc: Acc, code: string, key: string, v: number) {
  let m = acc.get(code);
  if (!m) acc.set(code, (m = new Map()));
  let a = m.get(key);
  if (!a) m.set(key, (a = []));
  a.push(v);
}
const avg = (xs: number[] | undefined) => (xs?.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);

/** Mid-rank percentile of each occupation's value among all occupations. */
function percentiles(byCode: Map<string, number>): Map<string, number> {
  const vals = [...byCode.values()].sort((a, b) => a - b);
  const n = vals.length;
  const out = new Map<string, number>();
  for (const [code, v] of byCode) {
    let below = 0;
    let equal = 0;
    for (const x of vals) {
      if (x < v) below++;
      else if (x === v) equal++;
    }
    out.set(code, (below + equal / 2) / n);
  }
  return out;
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;

// ---------------------------------------------------------------------------
// Load O*NET
// ---------------------------------------------------------------------------

const occupations = new Map(readTsv(onetDir, 'Occupation Data.txt').map((r) => [r['O*NET-SOC Code']!, r]));
const jobZones = new Map(readTsv(onetDir, 'Job Zones.txt').map((r) => [r['O*NET-SOC Code']!, Number(r['Job Zone'])]));

const interests: Acc = new Map();
for (const r of readTsv(onetDir, 'Career Interest Types.txt')) {
  const k = INTEREST_ELEMENTS[r['Element ID']!];
  if (k && r['Scale ID'] === 'OI') push(interests, r['O*NET-SOC Code']!, k, Number(r['Data Value']));
}

const styles: Acc = new Map();
for (const r of readTsv(onetDir, 'Work Styles.txt')) {
  const f = WORK_STYLE_FACTORS[r['Element Name']!];
  if (f && r['Scale ID'] === 'WI') push(styles, r['O*NET-SOC Code']!, f, Number(r['Data Value']) / 3);
}

/** Percentile of each occupation's relevance per factor, across all occupations with work-style data. */
const styleDistinct = new Map(
  BIG_FIVE.map((f) => {
    const byCode = new Map<string, number>();
    for (const [code, m] of styles) {
      const v = avg(m.get(f));
      if (v !== undefined) byCode.set(code, v);
    }
    return [f, percentiles(byCode)] as const;
  }),
);

const valuesRaw = new Map<WorkValue, Map<string, number>>(WORK_VALUES.map((v) => [v, new Map()]));
for (const r of readTsv(valuesDir, 'Work Values.txt')) {
  const v = VALUE_ELEMENTS[r['Element ID']!];
  if (v && r['Scale ID'] === 'EX') valuesRaw.get(v)!.set(r['O*NET-SOC Code']!, Number(r['Data Value']));
}
const valuesPct = new Map(WORK_VALUES.map((v) => [v, percentiles(valuesRaw.get(v)!)]));

const abilityLv: Acc = new Map();
const abilityIm: Acc = new Map();
for (const r of readTsv(onetDir, 'Abilities.txt')) {
  const d = ABILITY_ELEMENTS[r['Element Name']!];
  if (!d || r['Recommend Suppress'] === 'Y') continue;
  const code = r['O*NET-SOC Code']!;
  if (r['Scale ID'] === 'LV') push(abilityLv, code, d, Number(r['Data Value']));
  if (r['Scale ID'] === 'IM') push(abilityIm, code, d, Number(r['Data Value']));
}
const abilityLevelPct = new Map(
  ABILITY_DOMAINS.map((d) => {
    const byCode = new Map<string, number>();
    for (const [code, m] of abilityLv) {
      const v = avg(m.get(d));
      if (v !== undefined) byCode.set(code, v);
    }
    return [d, percentiles(byCode)] as const;
  }),
);

const tasksByCode = new Map<string, string[]>();
for (const r of readTsv(onetDir, 'Task Statements.txt')) {
  if (r['Task Type'] !== 'Core') continue;
  const list = tasksByCode.get(r['O*NET-SOC Code']!) ?? [];
  if (list.length < 6) list.push(r['Task']!);
  tasksByCode.set(r['O*NET-SOC Code']!, list);
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

interface CatalogCareer {
  id: string;
  cluster: string;
  name: { en: string; ar: string };
  onet: string[];
  proxy?: boolean;
  proxyNote?: string;
}
const catalogPath = join(here, '../careers/catalog.json');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as { careers: CatalogCareer[] };

/** Primary related occupations in O*NET's own order, used to fill gaps for newer occupations. */
const related = new Map<string, string[]>();
for (const r of readTsv(onetDir, 'Related Occupations.txt')) {
  if (!r['Relatedness Tier']!.startsWith('Primary')) continue;
  const list = related.get(r['O*NET-SOC Code']!) ?? [];
  list.push(r['Related O*NET-SOC Code']!);
  related.set(r['O*NET-SOC Code']!, list);
}

const problems: string[] = [];
const imputed = new Map<string, Set<string>>();
const IMPUTE_FROM = 5;

/**
 * Value for an occupation; when O*NET has no data for it (common for occupations added
 * after 2019), the mean of its first related occupations that do have data is used instead.
 */
function lookup(code: string, dimension: string, get: (c: string) => number | undefined): number {
  const direct = get(code);
  if (direct !== undefined) return direct;
  const vals = (related.get(code) ?? []).map(get).filter((v): v is number => v !== undefined).slice(0, IMPUTE_FROM);
  if (!vals.length) {
    problems.push(`${code}: no data for ${dimension}`);
    return NaN;
  }
  let set = imputed.get(code);
  if (!set) imputed.set(code, (set = new Set()));
  set.add(dimension);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function traitsFor(code: string): CareerTraits {
  const riasec = Object.fromEntries(
    RIASEC.map((k) => [k, lookup(code, 'interests', (c) => avg(interests.get(c)?.get(k)))]),
  ) as CareerTraits['riasec'];
  const personality = Object.fromEntries(
    BIG_FIVE.map((f) => [f, lookup(code, 'workStyles', (c) => avg(styles.get(c)?.get(f)))]),
  ) as CareerTraits['personality'];
  const personalityDistinct = Object.fromEntries(
    BIG_FIVE.map((f) => [f, lookup(code, 'workStyles', (c) => styleDistinct.get(f)!.get(c))]),
  ) as CareerTraits['personality'];
  const values = Object.fromEntries(
    WORK_VALUES.map((v) => [v, lookup(code, 'workValues', (c) => valuesPct.get(v)!.get(c))]),
  ) as CareerTraits['values'];
  const abilities = Object.fromEntries(
    ABILITY_DOMAINS.map((d) => {
      const level = lookup(code, 'abilities', (c) => abilityLevelPct.get(d)!.get(c));
      const im = lookup(code, 'abilities', (c) => avg(abilityIm.get(c)?.get(d)));
      return [d, { level, importance: (im - 1) / 4 }];
    }),
  ) as CareerTraits['abilities'];
  return { riasec, personality, personalityDistinct, values, abilities };
}

function averageTraits(list: CareerTraits[]): CareerTraits {
  const n = list.length;
  const mean = (f: (t: CareerTraits) => number) => round3(list.reduce((a, t) => a + f(t), 0) / n);
  return {
    riasec: Object.fromEntries(RIASEC.map((k) => [k, mean((t) => t.riasec[k])])) as CareerTraits['riasec'],
    personality: Object.fromEntries(BIG_FIVE.map((k) => [k, mean((t) => t.personality[k])])) as CareerTraits['personality'],
    personalityDistinct: Object.fromEntries(
      BIG_FIVE.map((k) => [k, mean((t) => t.personalityDistinct![k])]),
    ) as CareerTraits['personality'],
    values: Object.fromEntries(WORK_VALUES.map((k) => [k, mean((t) => t.values[k])])) as CareerTraits['values'],
    abilities: Object.fromEntries(
      ABILITY_DOMAINS.map((d) => [d, { level: mean((t) => t.abilities[d].level), importance: mean((t) => t.abilities[d].importance) }]),
    ) as CareerTraits['abilities'],
  };
}

const careers = catalog.careers.map((c) => {
  for (const code of c.onet) if (!occupations.has(code)) problems.push(`${c.id}: unknown O*NET code ${code}`);
  const traits = averageTraits(c.onet.map(traitsFor));
  const zones = c.onet.map((code) => jobZones.get(code)).filter((z): z is number => z !== undefined);
  const holland = [...RIASEC].sort((a, b) => traits.riasec[b] - traits.riasec[a]).slice(0, 3).join('');
  return {
    id: c.id,
    cluster: c.cluster,
    name: c.name,
    ...(c.proxy ? { proxy: true, proxyNote: c.proxyNote } : {}),
    onet: c.onet.map((code) => ({
      code,
      title: occupations.get(code)?.Title ?? '',
      ...(imputed.has(code) ? { imputedFromRelated: [...imputed.get(code)!] } : {}),
    })),
    hollandCode: holland,
    jobZone: zones.length ? Math.round(zones.reduce((a, b) => a + b, 0) / zones.length) : null,
    seed: {
      descriptionEn: occupations.get(c.onet[0]!)?.Description ?? '',
      tasksEn: tasksByCode.get(c.onet[0]!) ?? [],
    },
    traits,
  };
});

if (problems.length) {
  console.error(`Build failed with ${problems.length} problem(s):\n  ${problems.slice(0, 30).join('\n  ')}`);
  process.exit(1);
}

const out = {
  generatedAt: new Date().toISOString().slice(0, 10),
  sources: {
    onet: 'O*NET 31.0 Database (interests, work styles, abilities, tasks); Work Values from O*NET 30.0',
    license: 'O*NET data © U.S. Department of Labor, Employment and Training Administration — CC BY 4.0. Modified by anaBokra.',
  },
  careers,
};
const outPath = join(here, '../careers/careers.generated.json');
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote ${careers.length} careers → ${outPath}`);
