# anaBokra

Career discovery for Egyptian youth. This repo currently holds the **assessment engine** and the **content data** (instruments + career library). The web app, database and admin panel come next.

```
packages/
  engine/    Pure TypeScript scoring + matching (no dependencies, no I/O)
  content/   Instruments (JSON), career catalog, O*NET build script, demo
data/raw/    O*NET source files (git-ignored, see "Career data")
```

## Commands

```bash
pnpm install
pnpm test               # engine + content tests
pnpm typecheck
pnpm demo scientist     # simulated answers → scores → top matches (scientist|helper|builder|leader|creative)
pnpm build:careers      # rebuild careers.generated.json from O*NET
```

## How a result is produced

1. **Score** each instrument (`scoreLikert`, `scoreValues`, `scoreAbilities`). Reverse keys are applied, attention checks are excluded, and a scale is scored only when at least 80% of its items are answered.
2. **Normalize** to 0..1. Until Egyptian norms exist, this is the raw mean rescaled. Once norms are supplied (`Norms`), it becomes a percentile.
3. **Check quality** (`checkQuality`): straight-lining, rushing, failed attention checks. Flags never block results.
4. **Match** (`rankCareers`): `Fit = 0.45·Interests + 0.20·Personality + 0.15·Values + 0.20·Abilities` (0–100).
   - **Interests:** correlation between the user's RIASEC profile and the career's O*NET interest profile.
   - **Personality:** each Big Five trait is weighted by how much it matters in that career (from O*NET Work Styles).
   - **Values:** how much the career offers the things the user values (Theory of Work Adjustment).
   - **Abilities:** penalizes only shortfalls, beyond a 15-point slack, and weighs them by how important the ability is.
   - If a module isn't finished yet, the weights are rescaled over the parts that exist, and `coverage` says how complete the result is.
5. **Explain:** structured `reasons`, `watchOuts` and context `flags` (wrong track, score is a reach, high cost). The UI or AI turns these into Arabic or English text and never changes the scores.

All weights and thresholds live in `DEFAULT_WEIGHTS` and `MATCH_SETTINGS` in `packages/engine/src/matching.ts`.

## Instruments (`packages/content/instruments`)

| File | Source | Items | License |
| --- | --- | --- | --- |
| `interests.json` | O*NET Interest Profiler Short Form | 60 + 1 attention check | CC BY 4.0 |
| `personality.json` | IPIP Big-Five Factor Markers (Goldberg) | 50 + 1 attention check | Public domain |
| `values.json` | O*NET work values / MIQ need structure; card wording by anaBokra | 21 cards | Wording: anaBokra |
| `abilities.json` | Self-ratings by anaBokra; performance items to come from ICAR | 12 (+16 TBD) | anaBokra / public domain |
| `readiness.json` | anaBokra decision-readiness pre/post check | 6 | anaBokra |

The English item wording is verbatim from the sources. **All Arabic text is a draft** in light Egyptian colloquial Arabic, with feminine forms (`arF`) where the grammar needs them. It must go through forward and back translation and the psychologist's review before the pilot.

## Career data

`careers/catalog.json` is the hand-curated list: 82 careers in 12 clusters, with Arabic and English names and their O*NET occupation codes. `careers/careers.generated.json` is built from it plus the O*NET database and holds, for each career:
- RIASEC profile
- Big Five relevance and how distinctive it is
- work-value supply
- required abilities
- Holland code
- job zone
- English description and tasks as a starting point for writing

To rebuild:

```bash
mkdir -p data/raw && cd data/raw
curl -LO https://www.onetcenter.org/dl_files/database/db_31_0_text.zip && unzip db_31_0_text.zip && mv "db_31_0_text" onet31
curl -LO https://www.onetcenter.org/dl_files/database/db_30_0_text.zip && unzip db_30_0_text.zip && mkdir -p onet30 && mv "db_30_0_text/Work Values.txt" onet30/
cd ../.. && pnpm build:careers
```

Notes:

- O*NET 31.0 dropped Work Values, so those come from 30.0.
- When an occupation lacks some data (usually ones added after 2019), the build fills it from O*NET's related occupations and records this as `imputedFromRelated`. Currently 7 cases.
- Careers marked `proxy` have no direct O*NET equivalent: diplomat, military officer, entrepreneur, content creator, banker, auditor, product manager, social media manager.

O*NET data © U.S. Department of Labor, Employment and Training Administration, used under CC BY 4.0 and modified by anaBokra.

## Open items for the psychologist

- [ ] Approve or replace each instrument. Choose IPIP-50 or Mini-IPIP (20 items).
- [ ] Review the Arabic drafts and the cultural adaptation of `ip_A08`.
- [ ] Review the Work Styles → Big Five mapping (`WORK_STYLE_FACTORS` in `build-careers.ts`).
- [ ] Review the ability domain mapping (`ABILITY_ELEMENTS`).
- [ ] Review the profiles of proxy careers.
- [ ] Register with ICAR and select the 16 performance items.
- [ ] Set the starting matching weights.
- [ ] Decide how swipe gestures map onto the 1–5 answer scale.
# anaBokra
# anaBokra
