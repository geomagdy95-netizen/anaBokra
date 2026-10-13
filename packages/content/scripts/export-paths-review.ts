/**
 * Writes docs/review/paths-review.md: every Verify (path) item in English and Arabic, with what it
 * measures and the careers it applies to, for the psychologist to review. Run: pnpm export:paths
 */
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { careers, clusters, paths, type PathTask } from '../src';

const name = (id: string) => careers.find((c) => c.id === id)?.name.en ?? id;
const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const ar = (t: { ar: string; arF?: string }) => cell(t.ar) + (t.arF ? `<br>*(f)* ${cell(t.arF)}` : '');
const who = (ids?: string[]) => (ids?.length ? ids.map(name).join(', ') : 'all careers in the path');

function task(t: PathTask): string[] {
  const out = [`### ${t.title.en} · ${t.title.ar}`, '', `> ${t.intro.en}`, '>', `> ${t.intro.ar}`, ''];
  if (t.kind === 'story') {
    out.push('Answer: not for me (1) · OK (2) · sounds great (3). Measures: enjoyment of everyday activities.', '');
    out.push('| Id | English | Arabic | Applies to | Notes |', '|---|---|---|---|---|');
    for (const i of t.items) out.push(`| ${i.id} | ${cell(i.text.en)} | ${ar(i.text)} | ${who(i.careers)} | |`);
  } else if (t.kind === 'thisOrThat') {
    out.push('Answer: pick A or B. ★ = the side typical of this path. Measures: acceptance of the path\'s realities.', '');
    out.push('| Id | A | B | Applies to | Notes |', '|---|---|---|---|---|');
    for (const i of t.items)
      out.push(`| ${i.id} | ${i.path === 'a' ? '★ ' : ''}${cell(i.a.en)}<br>${ar(i.a)} | ${i.path === 'b' ? '★ ' : ''}${cell(i.b.en)}<br>${ar(i.b)} | ${who(i.careers)} | |`);
  } else {
    out.push('Each item is followed by "Did you enjoy that?" (not really 1 · kind of 2 · loved it 3). Measures: taste for the path\'s problems and work style. Puzzles are never graded.', '');
    for (const i of t.items) {
      out.push(`**${i.id}** (${i.type}) · applies to: ${who(i.careers)}`, '', `- EN: ${i.text.en}`, `- AR: ${i.text.ar}${i.text.arF ? ` · *(f)* ${i.text.arF}` : ''}`, '');
      if (i.type === 'scenario') {
        out.push('| Option (EN) | Option (AR) | Fit (0–1) | Notes |', '|---|---|---|---|');
        for (const o of i.options) out.push(`| ${cell(o.text.en)} | ${ar(o.text)} | ${o.fit} | |`);
      } else {
        out.push('| Option (EN) | Option (AR) | Correct | Notes |', '|---|---|---|---|');
        i.options.forEach((o, k) => out.push(`| ${cell(o.en)} | ${ar(o)} | ${k === i.answer ? '✓' : ''} | |`));
        out.push('', `Shown after answering: ${i.explain.en} · ${i.explain.ar}`);
      }
      out.push('');
    }
  }
  out.push('');
  return out;
}

const lines = [
  '# Path (Verify) items: review pack',
  '',
  'Generated from `packages/content/paths/*.json` by `pnpm --filter @anabokra/content export:paths`. Do not edit by hand: write comments in the Notes columns (or a copy) and we apply them to the JSON.',
  '',
  'Status: **draft**, written from the career pages (4 paths on 12 Oct 2026, the other 8 on 14 Oct), for the psychologist. Design: [discover-verify.md](../product/discover-verify.md) §5. Arabic is Egyptian colloquial; *(f)* marks the feminine form where it differs.',
  '',
  'What to check for every item: is it accurate for Egypt, is it clear at 18–25, is it neutral (no right answer implied where there shouldn\'t be one), does it measure what the column says, and is the Arabic natural.',
  '',
];
for (const p of Object.values(paths)) {
  const group = clusters.find((c) => c.id === p.id)?.name;
  lines.push(`## ${group?.en ?? p.id} · ${group?.ar ?? ''} (\`${p.id}\`, ${p.version})`, '');
  for (const t of p.tasks) lines.push(...task(t));
}
const out = resolve(dirname(fileURLToPath(import.meta.url)), '../../../docs/review/paths-review.md');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, lines.join('\n'));
console.log(`wrote ${out}`);
