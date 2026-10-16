# Task pictures: brief for the image agent (Codex)

Every task on an island opens as an illustrated card: a picture on top, the question in a card below. This brief is for whoever makes those pictures (we use the Codex agent). The app already works without them: a missing picture shows a soft placeholder with the island's icon.

## What to make

The full list, with the file name and the prompt for every picture, is in [images.md](images.md) (machine-readable: [images.json](images.json)). It is generated from the task content, so it always matches the app. Work through it **in priority order**:

| Priority | What | How many | Where it shows |
|---|---|---|---|
| 1 | My island (Discover cover, readiness, 10 Discover tasks), the one-time Values card sort, and each of 18 path islands' cover and 3 task covers | 85 | Task cover screens, and every question that has no picture of its own |
| 2 | One picture per "A day in…" moment and per "Try it" situation | 158 | That question |
| 3 | "The real deal" trade-offs and the small puzzles | 144 | That question (optional: they fall back to their task's picture) |

The app picks the most specific picture that exists: question, then task, then island cover, then the placeholder. When all priority 1 images are present, every task screen has contextual art.

Current inventory: **387 pictures total**. **73 are generated and registered**; 314 remain. The app shows emoji tiles on six newer islands until their second atlas is added.

## Style (same for every picture)

Use the reference mock-up in the founder's message (four health cards) as the look. It is built into every prompt in images.md; keep it:

- Warm, painterly digital illustration, soft semi-realistic storybook style, golden light, clean and uncluttered.
- Egypt today: Cairo, the Nile, the Delta, Upper Egypt, the Red Sea. Young Egyptians aged 18 to 25 in modest contemporary clothes. Across the full set, aim for about two thirds male-led images and one third female-led images. Default to one person or a same-gender group; avoid casual mixed-gender groups and close social interaction. When a story genuinely needs men and women at work, keep the exchange formal, brief, and physically respectful. Women may wear hijab where appropriate and should remain represented across professions.
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

## Island atlas (the six newer islands)

The world map uses `apps/web/public/world/career-islands-atlas.webp` (4×3, 1152×864) for the first 12 groups. The six groups added in October 2026 still show an emoji tile. To draw them, make one more image in the same style and save it as `apps/web/public/world/career-islands-atlas-2.webp` (3 columns × 2 rows, 864×576, transparent background), then set `HAS_ATLAS_2 = true` in `apps/web/src/features/world/island-artwork.tsx`.

Order, left to right, top row first: sports, transport, beauty, security, religion, performing.

```text
A 3 by 2 grid of six small isometric diorama islands on a transparent background, same style as the existing career-islands atlas: warm, glossy, toy-like 3D render, golden daylight, each island a round patch of grass and flowers on pale limestone rocks, ringed by shallow turquoise water, with a small wooden dock and steps at the front right, and a few palm or leafy trees. Include one small young Egyptian man in modest contemporary work clothes on each island, shown doing that island's work; no mixed-gender scenes and no social interaction with women:
1. Sports: a small green football pitch with a goal, a running-track curve, a ball and a trophy.
2. Transport: a small airport control tower, a parked plane, stacked shipping containers and a cargo boat at the dock.
3. Beauty: a cosy salon pavilion with a round mirror, a styling chair, hairdryer, brushes and small spa towels and plants.
4. Security: a small fire station with a red fire engine, a watchtower and a shield-shaped emblem with no symbols.
5. Religion: a small mosque with a dome and minaret and a small church with a bell tower side by side, with a shared garden between them.
6. Performing arts: a little theatre stage with red curtains, a spotlight, a microphone stand and theatre masks.
Each island centred in its cell with the same size and spacing as the others. People are small environmental details, not the main landmark. No readable text, letters, numbers, logos or flags anywhere. No frame, no border, no watermark.
```
