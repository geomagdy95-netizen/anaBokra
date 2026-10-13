# Task pictures: brief for the image agent (Codex)

Every task on an island opens as an illustrated card: a picture on top, the question in a card below. This brief is for whoever makes those pictures (we use the Codex agent). The app already works without them: a missing picture shows a soft placeholder with the island's icon.

## What to make

The full list, with the file name and the prompt for every picture, is in [images.md](images.md) (machine-readable: [images.json](images.json)). It is generated from the task content, so it always matches the app. Work through it **in priority order**:

| Priority | What | How many | Where it shows |
|---|---|---|---|
| 1 | My island (Discover cover, readiness, 10 Discover tasks); each path island's cover and its 3 task covers | 60 | Task cover screens, and every question that has no picture of its own |
| 2 | One picture per "A day in…" moment and per "Try it" situation | 114 | That question |
| 3 | "The real deal" trade-offs and the small puzzles | 97 | That question (optional: they fall back to their task's picture) |

The app picks the most specific picture that exists: question, then task, then island cover, then the placeholder. Priority 1 alone already gives every screen a picture.

## Style (same for every picture)

Use the reference mock-up in the founder's message (four health cards) as the look. It is built into every prompt in images.md; keep it:

- Warm, painterly digital illustration, soft semi-realistic storybook style, golden light, clean and uncluttered.
- Egypt today: Cairo, the Nile, the Delta, Upper Egypt, the Red Sea. Young Egyptians aged 18 to 25, a natural mix of men and women, some women in hijab, modest clothes.
- Small violet (#7025B5) and apricot (#FFA366) accents; otherwise natural warm colours.
- **No readable text, letters, numbers, logos or signs**: the app is in Arabic and English, so words in a picture would be wrong for half the users.
- No watermark, frame or border.
- Keep one look across all pictures: same light, same painting style, same kind of faces. If a picture drifts, redo it.

## Format

- **Square, 1024 × 1024** (anything from 768 square up is fine; non-square pictures get centre-cropped).
- PNG (or JPG/WebP).
- **Composition:** the main subject in the middle. The top eighth stays calm (the step counter and close button sit over it), and the bottom tenth is covered by the card. On phones the picture is shown wider than tall, so the left and right edges are cropped a little. On the cover screen it is shown taller than wide, so the top and bottom are cropped instead.

## Where to save, and how to check

1. Save each picture at the exact path given in images.md, under `apps/web/art-src/`, for example `apps/web/art-src/tasks/health/health_day_1.png`. This folder is not committed (originals are large).
2. Run:
   ```sh
   pnpm --filter web art:build
   ```
   This converts new pictures to 1024² WebP in `apps/web/public/art/`, rewrites the list of available pictures (`apps/web/src/features/art/manifest.json`), ticks them off in images.md, prints progress per priority, and warns about unknown names, small or non-square images.
3. Look at them in the app. With the dev server running (`pnpm --filter web dev`), open `/en/dev/paths` (or `/ar/dev/paths`), pick an island, press **Task** on any task, then **Start**. Check that faces and hands look right, that nothing important sits under the counter at the top or the card at the bottom, and that the picture matches the question.
4. Run the tests: `pnpm --filter web exec vitest run src/features/art`.
5. Commit `apps/web/public/art/**`, `apps/web/src/features/art/manifest.json` and `docs/art/images.md`. Do not commit `apps/web/art-src/`.

## Rules

- Do not change task content, prompts or code to fit a picture. If a prompt is unclear or a scene could be culturally off, note it in your summary rather than guessing.
- To replace a picture, save a new file at the same path and run the build again (the app's cache is refreshed by the content hash).
- Keep the people believable and respectful: no stereotypes, no one shown as less able, nothing that could embarrass a family looking over a young person's shoulder.
