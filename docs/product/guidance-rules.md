# Guidance rules: results, rewards, the map and content

Status: rules adopted 12 Oct 2026. They come from an outside review pack, kept only where it fits our design: ages 18–25 plus 15–17 with a parent, data on the phone, Discover and Verify, 12 path islands. They sit beside [discover-verify.md](discover-verify.md) and the [world spec](world-spec.md); where they differ, those two documents decide. Items marked *(psychologist)* need her review.

## 1. What a result may say

Each kind of answer supports one kind of statement. Results never stretch an answer into something it can't show.

| What the user did | We can say | We never say |
|---|---|---|
| Chose an activity or picked "sounds great" | "You'd enjoy activities like…" | That this is their type or their best career |
| Said they enjoyed a Try it task | "You enjoyed this kind of problem" | That they're good at it, or will succeed |
| Got a puzzle right | Nothing about ability; the reaction stays cheerful | "You have a talent for…" |
| Rated themselves strong at something | "You see yourself as strong at…" | That the strength is shown or proven |
| Picked the other side of a reality | "Worth keeping in mind: you'd rather not…" | That the whole path is closed to them |
| Gave many neutral or mixed answers | "No path stands out yet; try a few" | A made-up top match |

- **Keep four things apart:** enjoyment, how a task went, familiarity ("I've done this before") and confidence. One doesn't stand in for another. "You enjoyed it and needed a hint" is not a contradiction.
- **Unknown is not low.** Skipped or unanswered items are missing, never zero and never "neutral". If skipping is ever added to Verify tasks, the path fit must reweight over the parts answered. Today it would fall back to 0.5, but the result only runs once every item is answered.
- **No inference from behaviour:** never from speed, pauses, quitting a task, retries or the phone's performance.
- **One task is one sample.** A day-in-the-life set or two puzzles is a small sample of a path. Wording says "this kind of work", not "this career".

## 2. Rewards and progress

- **XP once per task, on first completion.** Redoing a task, re-verifying a path or reaching the same item from another island adds nothing.
- **Never reward an answer.** No extra XP for liking a path, picking the path's side of a reality, a right puzzle answer, speed, or changing your mind. Keeping or changing a view earns the same.
- **No punishment.** No streaks, no decaying or sinking islands, no broken bridges, no red "unsuitable" marks. Archiving a path keeps its history and shows no failure animation.
- **Finding out a path isn't for you is progress.** The Verify result says so plainly, e.g. "Now you know more about what you'd rather avoid."
- **Returning after a break:** offer "continue" or "try something new", and ask whether old answers still feel true. Never call old answers permanent traits.

## 3. What the map means

| On the map | Means | Never means |
|---|---|---|
| My island | My answers so far | A fixed personality |
| Path island | A group of related careers to explore | One degree, one employer or one ability |
| Bridge plank | A finished task | Ability, admission or permission to look |
| Glowing path | Suggested from my answers, with a "why" | That other paths are closed |
| Distance, size or height of an island | Layout only | A better match or a more prestigious field |

- Every path and career page opens from the map, the list and search, before any bridge is built.
- Mark a path suggested from answers differently from one the user chose themselves.
- A path with little content shows "more tasks coming"; that never lowers its fit.

## 4. Controls and Arabic layout

- **Every drag has a tap alternative.** The swipe cards (buttons and keys) and the values sort (select, then bucket buttons) already have one. New formats must too (WCAG 2.2, SC 2.5.7).
- **Reduced motion:** no required animation; the map falls back to 2D (already built). Completion and saving never wait for an animation.
- **Never colour alone:** states use text or icons as well.
- **RTL:** mirror the layout, but not maps, numbers, charts, media controls or diagrams.
- **Changing language mid-task** keeps the answers. Item ids are shared, so progress doesn't split by language.
- **Feedback is honest:** "could not save" never shows a saved tick.

## 5. Facts about study and work in Egypt

Programmes, admission, costs and qualifications change every year. Every such fact in content carries:

- source (official link), country and intake year;
- date checked and who checked it;
- status: draft, provider-supplied, checked, out of date, disputed or withdrawn;
- what triggers a recheck (new intake, provider update, expiry).

**Unknown stays unknown:** "We haven't checked this programme's current entry requirements. Check the official source before deciding." / «لسه ما اتأكدناش من شروط القبول الحالية للبرنامج ده. راجع المصدر الرسمي قبل ما تقرر.» Last year's cut-off is never shown as current. Interest and admission are always shown apart; a fit says nothing about eligibility.

**Words to keep apart:**

| Term | Meaning |
|---|---|
| Career | Work someone does (physiotherapist) |
| Study field | A subject (computer science) |
| Route | A way in: a degree, a technical institute, an apprenticeship, a certificate, a portfolio |
| Programme | A specific offering by a named institution, with its own admission facts |
| Industry | Where the work happens (a software engineer in a hospital is still a software engineer) |
| Work arrangement | Employee, freelancer, business owner: a filter, not a path |

**Route categories for Egypt** (for the "Routes in" sections; each link needs checking for the career and year):

| Id | Route |
|---|---|
| E01 | University degree |
| E02 | Technological and applied higher education (technological universities) |
| E03 | Higher and intermediate institutes, each checked separately |
| E04 | Technical secondary, including dual and applied-technology schools (mostly relevant to 15–17) |
| E05 | Apprenticeship and structured workplace training |
| E06 | Vocational training and professional certificates: attendance, assessed skills and recognised qualifications are different things |
| E07 | Portfolio and self-directed learning, where the career allows it |
| E08 | Further study, bridging or conversion, only where the arrangement is confirmed |

A short course never replaces a qualification that the career legally requires.

## 6. Careers in more than one path

A career has **one id and one page**, wherever it appears. It has a home group, and other groups can link to it (UX designer: home Technology & Data, also linked from Creative & Design). Answers and results attach to the career once; reaching it through a second island doesn't copy them or add XP. Related careers stay distinct: psychologist, psychiatrist and social worker are different careers, and so are engineer and technician.

## 7. Partners and sponsored content (from launch onward)

- Label it before the user starts: «إعلان» or «برعاية».
- It never changes a fit, a band, the order of suggestions, a reward or bridge progress. A path with no partner is just as explorable.
- Offers live in the "Routes in" and Resources sections, never inside a result.
- Asking for information, applying and enrolling are separate, explicit actions. Nothing is sent to a provider unless the user sends it, and never answers or results.
- An expired or withdrawn offer can't be claimed; the career and route stay.

## 8. Versions

Every task, item and fact has a version. A result keeps the version it was made with. A content change never silently re-scores an old result into a less favourable one; if a flawed item is removed, results that used it are marked and explained. (The world spec's "island upgraded" rule already covers bridges.)

## 9. Try it ideas for other paths *(draft, psychologist)*

These come from the review pack's demo tasks, as candidates when the next paths get Verify content. Each item is followed by "did you enjoy that?", like our existing puzzles. They are easy for 18–25, so harder versions may be needed. The Arabic must be rewritten in Egyptian colloquial.

| Path | Idea | Right answer |
|---|---|---|
| Creative & Design | Three event cards; which one shows **when** the workshop is and **how to register**? | The card with the time and a "Register" button |
| Creative & Design | A poster brief needs title, place and time; pick the 3 cards that meet it (2 decoys: "Best ever!", "500 followers") | Title, place, time |
| Engineering | Order the assembly steps: base before column, column before panel, inspect last | Base → column → panel → inspect |
| Engineering | Quality check: accept pieces 9–11 units long **with** a clear mark (10 marked, 12 marked, 9 unmarked, 11 marked) | 10 and 11 |
| Marketing & Media | Which notice tells new students the time and place without adding a promise? | The plain, factual one |
| Marketing & Media | A survey of 20 students in one class, 12 chose drawing; which sentence does the data support? | "12 of the 20 respondents chose drawing" |
| Technology & Data | Three days of orders and returns; which day had the most orders, and what else would you want to know? | The busiest day, plus "the table can't tell us why" |
| Business & Finance | Three deliveries: one is fast but over budget, one is in budget but late; spot the conflict | No option meets both; ask what matters more |

## 10. For later

- **More groups:** the review pack proposes 18 fields instead of our 12. It splits out transport and logistics, environment and energy, history and culture, sport, and personal services, and moves languages into media. Keep it as a reference when the psychologist regroups (world spec §1.1).
- **Skilled Trades & Technical:** the pack argues technical work shouldn't be a separate island, which can read as lower status. It would show technicians inside each field: electronics technician in Engineering, lab technician in Science. Decide at the regroup.
- **Usability questions for the pilot:** can users explain what a bridge means, tell a career from a study route, change their paths, and spot a sponsored item? Do they believe a result is a final verdict?
