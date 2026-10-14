# Games instead of some questions: prototypes

Status: **prototypes**, 14 Oct 2026, for the psychologist. Try them on a phone at `/en/dev/games` or `/ar/dev/games` (dev builds only). Nothing is saved, and nothing feeds results yet.

## Why

A first session asks about 140 answers. Games can't replace everything:

- **Mental abilities: games are better than questions.** Today we ask 12 "how strong are you at…" questions, and self-ratings of ability are weak (young people tend to rate themselves by school marks). Short tasks measure the ability itself.
- **Traits such as patience, persistence, risk and planning: games help, but only as extras.** How someone plays one game predicts how they behave in general only loosely. We show it as "how you played", never as a label, and keep the personality questions.
- **Interests and values: games can't help.** Liking something is a preference, so we have to ask. These remain the strongest guide to field fit. They can be shortened instead (a validated short form of the interest profiler, to confirm).

## The two prototypes

### 1. Pattern logic (reasoning)

| | |
|---|---|
| What the player does | A 3×3 grid of shapes with the last square missing; pick the one that completes it from four. One practice item with feedback, then eight items, easy to hard, with no feedback and no clock. About 2–3 minutes. |
| Items | Our own, generated from rules (no copyrighted test material). Four features (how many, shape, colour, fill), three values each. A feature either changes along the row, changes down the column, or forms a Latin square (each value once per row and column). Level 1: one feature follows a rule; level 2: two (row and column); level 3: two, one a Latin square; level 4: three. Every wrong option differs from the answer in exactly one feature, so only checking every rule finds it. The same seed gives the same items (tested on 200 seeds per level). Shapes and fill carry the meaning as well as colour, for colour-blind players. |
| Measures | Right answers (overall and per level), hardest level solved, time per item (median and total). |
| Player sees | Kind words and the level reached, never a mark or a percentage. |

### 2. Gone fishing (patience)

| | |
|---|---|
| What the player does | Six rounds. A small fish (1) now, or wait a few seconds for a big one (3); the wait is 4, 8, 6, 12, 10 and 15 seconds. While waiting they can stop and take the small one. About a minute. |
| Design | Waiting costs only time, with no risk, so the choice reflects patience rather than gambling (risk would need its own game). "No right or wrong way to play" is said up front. |
| Measures | Times they chose to wait, waits completed, waits given up and how far they got, longest wait completed, decision time per round, fish caught. |
| Player sees | How many fish they caught. |

## How we would check them (pilot)

1. Players do the game **and** the existing questions (opt-in research data, as now).
2. **Pattern logic:** reliability across items; whether scores relate as expected to school track and the self-rated reasoning strength; how hard each level really is (target: about 90% right at level 1, about 40% at level 4).
3. **Patience:** test–retest on a second play; relation to the conscientiousness items.
4. Only games that pass count towards results, from launch. Until then they are extras.

## Questions for the psychologist

1. Which abilities matter most for our 12 fields? Proposed next games: number sense, turning shapes (spatial), remembering sequences (working memory), quick sorting (attention).
2. Is "no clock" right for pattern logic, or should we use a soft time limit per item?
3. Patience: are six rounds enough? Should the delays or the rewards change?
4. How should game results be worded for players (strengths only; never "impatient")?
5. Can the interest questions move to the validated short form (about 30 items instead of 60)? This ties to the O\*NET licence question.
