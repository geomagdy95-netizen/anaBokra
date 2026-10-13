#!/usr/bin/env node
/**
 * Task illustrations (docs/art/README.md).
 *
 *   node scripts/art.mjs list    writes docs/art/images.md and images.json: every picture the app can
 *                                show, with its file name, priority and prompt
 *   node scripts/art.mjs build   converts new pictures from art-src/ to public/art/ (square WebP) and
 *                                rewrites src/features/art/manifest.json from what is in public/art
 *
 * art-src/ holds the full-size originals (PNG/JPG/WebP) and is not committed.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(WEB, '../..');
const SRC = path.join(WEB, 'art-src');
const OUT = path.join(WEB, 'public/art');
const MANIFEST = path.join(WEB, 'src/features/art/manifest.json');
const DOCS = path.join(ROOT, 'docs/art');
const SIZE = 1024;
const QUALITY = 72;

const STYLE =
  'Warm, painterly digital illustration in a soft semi-realistic storybook style, gentle golden light, clean and uncluttered. ' +
  'Set in Egypt today. Young Egyptian people aged 18 to 25, a natural mix of men and women, some women wearing hijab, modest everyday or work clothes. ' +
  'Small accents of violet (#7025B5) and apricot (#FFA366) in clothes or objects; the rest in natural, warm colours. ' +
  'No readable text, letters, numbers, logos or signs anywhere. No watermark, no frame, no border. ' +
  'Square image. Keep the main subject in the middle; the top eighth stays calm (sky, wall or ceiling) because buttons sit there, and the bottom tenth will be covered.';

/** Where each group's pictures happen (the cover sets the scene; tasks reuse it). */
const SETTINGS = {
  tech: 'a bright modern tech office in New Cairo with laptops, whiteboards and plants',
  business: 'a modern office and bank branch in downtown Cairo with meeting rooms and city views',
  engineering: 'a construction site, a factory floor and a design office in an Egyptian new city',
  health: 'a clean, sunny Egyptian hospital with wards, a clinic corridor and palm trees outside the windows',
  media: 'a busy newsroom, a small video studio and a marketing agency in Cairo',
  creative: 'a light-filled design studio with drawings, fabrics, cameras and instruments',
  law: 'an Egyptian courthouse, a law office with shelves of files, and a ministry meeting room',
  education: 'an Egyptian school classroom, a counsellor’s room and a community centre',
  science: 'a university laboratory, a field site in the Eastern Desert and a museum workroom',
  tourism: 'Luxor temples, a Red Sea hotel lobby, a restaurant kitchen and an airport',
  trades: 'a workshop, a factory production line, a car service bay and a rooftop with solar panels',
  agriculture: 'green Nile Delta fields at sunrise, an irrigation canal, a greenhouse and a food lab',
};

const TASK_SCENES = {
  day: (s) => `A typical working moment in ${s}: people busy and focused, seen from close, inviting.`,
  real: (s) => `A young person pausing to think about a big choice, with ${s} in the background; calm and honest, not dramatic.`,
  try: (s) => `Hands-on: a young person trying the work for the first time in ${s}, supported by a colleague.`,
};

const DISCOVER = {
  cover: 'A young Egyptian standing on a small green island at sunrise, looking out at other islands across a calm lavender sea, curious and hopeful.',
  readiness: 'A young Egyptian sitting on a rooftop in Cairo at golden hour with a notebook, thinking calmly about the future.',
  1: 'Warm-up: friends laughing while stretching before a walk along the Nile corniche in the morning.',
  2: 'What lights you up: a young person absorbed in a hobby they love, surrounded by small things they made.',
  3: 'Hands and minds: two hands building a small model next to an open notebook full of sketches.',
  4: 'People and ideas: a small group of students talking around a café table, one explaining an idea with her hands.',
  5: 'Your style: the same young person shown working three ways at once: alone with headphones, in a team, and outdoors.',
  6: 'Halfway there: a path across stepping stones over water, the far island in view, half the stones behind.',
  7: 'A bit deeper: a young person looking into a clear tide pool full of colourful life.',
  8: 'Getting clearer: morning mist lifting over Nile fields, the far bank becoming visible.',
  9: 'Almost there: a young person climbing the last steps up a sunny stairway, a view opening above.',
  10: 'The last piece: hands placing the final piece into a colourful jigsaw map of islands.',
};

function readPaths() {
  const dir = path.join(ROOT, 'packages/content/paths');
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}

/** Every picture the app can use, most important first. */
function images() {
  const list = [];
  const add = (key, priority, scene, uses) => list.push({ key, file: `art-src/${key}.png`, priority, uses, prompt: `${scene} ${STYLE}` });
  add('tasks/discover/cover', 1, DISCOVER.cover, 'My island: Discover tasks without their own picture');
  add('tasks/discover/readiness', 1, DISCOVER.readiness, 'Readiness check');
  for (let n = 1; n <= 10; n++) add(`tasks/discover/task_${n}`, 1, DISCOVER[n], `Discover task ${n}`);
  const names = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/content/careers/catalog.json'), 'utf8')).clusters.map((c) => [c.id, c.name.en]));
  for (const p of readPaths()) {
    const s = SETTINGS[p.id] ?? p.id;
    const where = `Setting: ${names[p.id] ?? p.id} work in Egypt, ${s}.`;
    add(`tasks/${p.id}/cover`, 1, `The world of ${s}, wide and welcoming, with two or three young people at work.`, `${p.id}: fallback for every task`);
    for (const t of p.tasks) add(`tasks/${p.id}/${t.id}`, 1, TASK_SCENES[t.id](s), `${p.id}: “${t.title.en}” cover and questions without their own picture`);
    for (const t of p.tasks)
      for (const i of t.items) {
        if (t.id === 'day') add(`tasks/${p.id}/${i.id}`, 2, `Scene: ${i.text.en} ${where}`, `${p.id}: “${i.text.en}”`);
        else if (t.id === 'try' && i.type === 'scenario') add(`tasks/${p.id}/${i.id}`, 2, `Scene: ${i.text.en} Show the moment just before anyone reacts. ${where}`, `${p.id}: “${i.text.en}”`);
        else if (t.id === 'real') add(`tasks/${p.id}/${i.id}`, 3, `A quiet symbolic scene about this trade-off: ${i.a.en}, or ${i.b.en.charAt(0).toLowerCase() + i.b.en.slice(1)}. Show it without words. ${where}`, `${p.id}: trade-off ${i.id}`);
        else add(`tasks/${p.id}/${i.id}`, 3, `Close-up of hands working through a small practical problem (${i.text.en.replace(/\?$/, '')}); no visible numbers or text. ${where}`, `${p.id}: puzzle ${i.id}`);
      }
  }
  return list;
}

function list() {
  const all = images();
  fs.mkdirSync(DOCS, { recursive: true });
  fs.writeFileSync(path.join(DOCS, 'images.json'), JSON.stringify(all, null, 2) + '\n');
  const have = new Set(Object.keys(readManifest()));
  const lines = [
    '# Task pictures: the list',
    '',
    'Generated by `pnpm --filter web art:list` from the task content. Do not edit by hand. How to make and add pictures: [README.md](README.md).',
    '',
    `${all.length} pictures: ${count(all, 1)} priority 1, ${count(all, 2)} priority 2, ${count(all, 3)} priority 3. ${have.size} done.`,
    '',
  ];
  for (const pr of [1, 2, 3]) {
    lines.push(`## Priority ${pr}`, '');
    for (const i of all.filter((x) => x.priority === pr)) {
      lines.push(`### ${have.has(i.key) ? '✅' : '⬜'} \`${i.file}\``, '', `Used for: ${i.uses}`, '', '```text', i.prompt, '```', '');
    }
  }
  fs.writeFileSync(path.join(DOCS, 'images.md'), lines.join('\n'));
  console.log(`wrote docs/art/images.md and images.json (${all.length} pictures, ${have.size} done)`);
}

const count = (all, p) => all.filter((x) => x.priority === p).length;

function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).files ?? {};
  } catch {
    return {};
  }
}

function walk(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p, base) : [path.relative(base, p)];
  });
}

async function build() {
  const { default: sharp } = await import('sharp');
  const known = new Map(images().map((i) => [i.key, i]));
  const problems = [];
  let converted = 0;
  for (const rel of walk(SRC).filter((f) => /\.(png|jpe?g|webp)$/i.test(f))) {
    const key = rel.replace(/\\/g, '/').replace(/\.(png|jpe?g|webp)$/i, '');
    if (!known.has(key)) {
      problems.push(`unknown name, skipped: art-src/${rel} (see docs/art/images.md for the names)`);
      continue;
    }
    const src = path.join(SRC, rel);
    const out = path.join(OUT, `${key}.webp`);
    if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs) continue;
    const meta = await sharp(src).metadata();
    if (Math.min(meta.width, meta.height) < 768) problems.push(`small (${meta.width}×${meta.height}, want ${SIZE}×${SIZE}): art-src/${rel}`);
    if (Math.abs(meta.width / meta.height - 1) > 0.25) problems.push(`not square (${meta.width}×${meta.height}), centre-cropped: art-src/${rel}`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await sharp(src).rotate().resize(SIZE, SIZE, { fit: 'cover', position: 'centre' }).webp({ quality: QUALITY, effort: 5 }).toFile(out);
    converted++;
  }

  const files = {};
  for (const rel of walk(OUT).filter((f) => f.endsWith('.webp')).sort()) {
    const key = rel.replace(/\\/g, '/').replace(/\.webp$/, '');
    if (!known.has(key)) {
      problems.push(`public/art/${rel} is not used by any task (renamed or removed?)`);
      continue;
    }
    files[key] = createHash('sha1').update(fs.readFileSync(path.join(OUT, rel))).digest('hex').slice(0, 8);
  }
  fs.writeFileSync(MANIFEST, JSON.stringify({ note: 'Generated by `pnpm --filter web art:build` from apps/web/art-src. Do not edit by hand.', files }, null, 2) + '\n');

  const all = [...known.values()];
  const done = (p) => all.filter((i) => i.priority === p && files[i.key]).length;
  console.log(`converted ${converted}; manifest lists ${Object.keys(files).length} pictures`);
  for (const p of [1, 2, 3]) console.log(`  priority ${p}: ${done(p)} of ${count(all, p)}`);
  const next = all.filter((i) => !files[i.key]).slice(0, 5);
  if (next.length) console.log(`next to make:\n${next.map((i) => `  ${i.file}`).join('\n')}`);
  for (const p of problems) console.warn(`! ${p}`);
  list();
}

const cmd = process.argv[2];
if (cmd === 'list') list();
else if (cmd === 'build') await build();
else {
  console.error('usage: node scripts/art.mjs list|build');
  process.exit(1);
}
