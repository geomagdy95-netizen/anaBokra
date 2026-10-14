# Games instead of some questions: prototypes

Status: **in Discover since 15 Oct 2026, before the psychologist's review** (founder's decision), and on `/en/dev/games` to try alone (a switch there previews the comparison with 1,000 sample players).

**In Discover:** each game is the last step of a task: pattern logic in task 3, quick numbers in task 5, Gone fishing in task 6, turn the shape in task 7, remember the path in task 9. While the assessment is open, a task with a game is done only once the game is played. Once a result exists, games are optional extras ("Play the game" on the task), so a Discover finished before the games doesn't go backwards; a game played then shows on the island but doesn't change the stored result. The first full play of each game is kept on the phone with the journey (moves with a backup, deleted with the profile); "Your strengths from the games" on my island lists them. The 12 strength questions stay: until a game has 100 players to compare with, the self-rating is the only score for its ability.

## Why

A first session asks about 140 answers. Games can't replace everything:

- **Mental abilities: games are better than questions.** Today we ask 12 "how strong are you at…" questions, and self-ratings of ability are weak (young people tend to rate themselves by school marks). Short tasks measure the ability itself.
- **Traits such as patience, persistence, risk and planning: games help, but only as extras.** How someone plays one game predicts how they behave in general only loosely. We show it as "how you played", never as a label, and keep the personality questions.
- **Interests and values: games can't help.** Liking something is a preference, so we have to ask. These remain the strongest guide to field fit. They can be shortened instead (a validated short form of the interest profiler, to confirm).

## The five prototypes

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

### 3. Quick numbers (number sense)

| | |
|---|---|
| What the player does | Number patterns and short sums with a "?" to fill; four options. Practice item with feedback, then eight items. No words, so Arabic and English players see the same thing (maths reads left to right in both). |
| Items | Generated: level 1, an adding sequence; level 2, a doubling or alternating sequence; level 3, a percentage of an amount; level 4, a sequence whose steps grow, or a two-step sum (a × b − c). Wrong options are real slips (doing the minus first, adding instead of subtracting, the previous step repeated). Tested on 300 seeds per level. |
| Measures | As pattern logic: right answers by level, hardest level solved, times. |

### 4. Turn the shape (spatial thinking)

| | |
|---|---|
| What the player does | A shape made of squares; which of four is the same shape turned? The other three are its mirror image turned. Practice item with feedback, then eight items. |
| Items | Random shapes of 4 to 7 squares with no symmetry at all (every turn looks different and none matches its mirror, so exactly one option can be right; tested on 150 seeds per level). |
| Measures | As pattern logic. |

### 5. Remember the path (working memory)

| | |
|---|---|
| What the player does | Tiles on a 3×3 board light up one after another; tap them in the same order. Starts at 3 tiles and grows by one after each success; two misses in a row at the same length end the game (Corsi-style span). |
| Measures | Span (longest path repeated), trials, right answers. |
| Player sees | The longest path they remembered. |

## Time, points and comparing with other players

- **Time:** the three puzzle games have a clock for the whole game: pattern logic 3:00, quick numbers 2:30, turn the shape 2:00. It starts after the practice item. Puzzles left when time runs out count as not right. Remember the path has no clock (the path itself gets harder), and Gone fishing is about time already.
- **Points:** a right answer earns as many points as its level (1 to 4; 20 at most). Remember the path scores the longest path repeated (0 to 9). Gone fishing has **no points and no ranking**: waiting longer isn't "better", so it shows how the player chose to play.
- **Compared with other players:** the share of players who scored lower (ties count half), against players of the same age band when at least **100** of them have played, otherwise against everyone, otherwise not shown ("your place shows once 100 people have played"). Wording, in five plain bands: "Among the top 10%", "In the top 25%", "Above the middle: higher than 62% of players", "Around the middle", "Below most players this time" (with "one game is only one view of a strength"); a scale from lower to higher scores marks where the player is. The player sees "5 of 8 right" and right answers from easy to hardest; the level-weighted points are only used for the comparison. Only a player's first play counts.
- **Where the comparison comes from:** players who opted in to anonymous statistics send one record per game: game, version, points, age band (no identity, no exact time, like the other anonymous records). The server publishes only the counts of players per score (`/api/stats/norms`, table `anon_game_scores`, view `anon_game_norms`); the phone works out the place itself.
- **All games together:** a "Your strengths from the games" card lists logic, numbers, spatial thinking, memory and patience, each with its place on the scale (or "not played yet"), and says how they count. On the island it belongs with the profile (my island → results); in the pilot research upload, each first play goes with the other opt-in answers.
- **In the assessment:** the place among other players (0 to 1) becomes the measured part of an ability: pattern logic → logical, quick numbers → numerical, turn the shape → spatial. The engine blends it with the self-rating at the instrument's performance weight (now 70% game, 30% self-rating), so the game counts more than the self-rating but doesn't replace it. Memory has no ability in the current model yet. Verbal, creative and manual stay self-rated. This switches on when the games join Discover and the comparison has 100 players.

## How we would check them (pilot)

1. Players do the game **and** the existing questions (opt-in research data, as now).
2. **Pattern logic:** reliability across items; whether scores relate as expected to school track and the self-rated reasoning strength; how hard each level really is (target: about 90% right at level 1, about 40% at level 4).
3. **Patience:** test–retest on a second play; relation to the conscientiousness items.
4. Only games that pass count towards results, from launch. Until then they are extras.

## Questions for the psychologist

1. Do these four ability games (reasoning, number sense, spatial, working memory) cover what matters for our 12 fields? A quick-sorting attention game is possible, but speed tasks depend on the phone, so we left it out.
2. Are the time limits right (3:00, 2:30, 2:00 for 8 puzzles), and is a 70/30 blend of game and self-rating right?
3. Patience: are six rounds enough? Should the delays or the rewards change?
4. How should game results be worded? We show points, time, a "Top 10% / 25% / half" badge and a share above a quarter, and an encouraging line below it. Is showing a comparison to teenagers at all acceptable to you?
5. Can the interest questions move to the validated short form (about 30 items instead of 60)? This ties to the O\*NET licence question.
