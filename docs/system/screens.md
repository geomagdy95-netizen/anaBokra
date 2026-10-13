# Screens

Every screen and route, by **screen code**. The letter is the area; the number is the screen. The codes come from the original screen list and survive in code comments. Codes marked *proposed* are new: the phase 1 on-device screens never had codes. Routes start with `/ar` or `/en`.

**Phase 1 (local mode) shows only the app and the pages it links to**, all in one phone layout: the app shell (T0) with its top bar and bottom tabs. The phase 2 and parked screens below redirect to `/journey` (`src/lib/hidden-routes.ts`); they come back with `NEXT_PUBLIC_DATA_MODE=server`. Developer pages are hidden from every production build.

**Installed app (PWA).** `manifest.webmanifest` starts the installed app at `/journey` (next-intl picks the language). The service worker (`src/app/sw.js/route.ts`, new version on every build) caches the app tabs and their files on install, and every other page and file the first time it loads, so the app opens without internet once it has been loaded. Home and Account show "Add to your home screen" (a button on Chrome / Android, the Share steps on iPhone), and the app asks the browser to keep its storage once there is a profile.

| Area | Letter |
|---|---|
| Public site | A |
| Sign-in and onboarding (phase 2) | B |
| Journey page parts | C |
| Assessment stations | D |
| Results | E |
| Career library | F |
| Explore (universities, programs, providers) | G |
| Parents (phase 2) | J |
| Admin (phase 2) | K |
| Phase 1 on-device screens | L *(proposed)* |
| Model changes, prototypes | MX (work-item numbers) |

## A · Public site

| Code | Screen | Route | Status |
|---|---|---|---|
| A1 | Landing | `/` | Built. Phase 1: one column, one "Start" button to `/journey` (`Public.start` texts) |
| A2–A4 | Teaser: intro, 12 interest cards, RIASEC preview, "save my result" | `/try` | Built (answers stay in the browser); hidden in phase 1 |
| A5 | For parents | `/parents` | Built, describes phase 2 routes; hidden in phase 1 |
| A6 | For schools | `/schools` | Built; school offer parked; hidden in phase 1 |
| A8 | Legal pages (privacy, terms, "Your data, in short") | `/legal/[doc]` | Built (drafts from `docs/legal`). Phase 1: in the app shell (Account tab) |

## L · Phase 1 on-device screens *(proposed codes)*

| Code | Screen | Where | Status |
|---|---|---|---|
| L1 | Age question | `/assessment`, first start | Built |
| L2 | Under 15: not yet | first start | Built |
| L3 | ~~Hand the phone to your parent~~ | — | Removed 13 Oct 2026 |
| L4 | ~~Parent consent~~ | — | Removed 13 Oct 2026 |
| L5 | ~~Thank you, hand the phone back~~ | — | Removed 13 Oct 2026 |
| L6 | Before you start (acceptance: 18+, or 15–17 with their own wording) | first start | Built |
| L7 | Joining a session? | first start, and main page | Built |
| L8 | Help us check the Arabic questions? | after L7 if offered, and main page | Built |
| L9 | Restore my data (backup file) | first start | Built |
| L10 | Settings on my island: nickname and password, anonymous statistics, university session, move to a new phone (backup file), delete all my data | `/journey` footer | Built |
| L11 | Storage warning (private window) | `/assessment` | Built |
| L12 | Choose a nickname, and an optional password | first start, after acceptance (15–17: after the hand-back) | Built |
| L13 | Your recovery code (shown once) | after setting or changing a password | Built |
| L14 | Welcome back: unlock, or reset with the recovery code | any journey tab when locked | Built |
| L15 | Settings: nickname and password (set, change, remove, lock now) | `/journey/account` | Built |

## I · Islands (Discover / Verify) *(proposed codes)*

| Code | Screen | Route | Status |
|---|---|---|---|
| T0 | App shell: top bar and bottom tabs (Home · Explore · Saved · Account) | every journey screen | Built |
| I1 | Home (my island): greeting, map card, readiness, Discover tasks, suggested and checked paths | `/journey` (and `/assessment` redirects here) | Built |
| I7 | Explore: full map or list, search (fields and careers), legend, toast | `/journey/map` (`?island=` opens a sheet) | Built |
| I8 | Island sheet: status, bridge progress, careers, add to my map / remove, save, explore (Verify), review my answers | `/journey/map` | Built |
| I9 | Saved: bookmarked paths, empty state | `/journey/saved` | Built |
| I10 | Account: profile card, nickname and password, language, statistics, session, move phone, delete, legal links | `/journey/account` | Built |
| I2 | A task: one question at a time, mixed formats | `/journey` | Built |
| I3 | Task reward: "Your island grew", early guess or suggestions | `/journey` | Built |
| I4 | Verify a path: values once, day, real deal, try it | `/journey/[path]` | Built (all 12 paths) |
| I5 | Path result: band, reasons, worth keeping in mind, careers ranked | `/journey/[path]` | Built |
| I6 | Readiness baseline and follow-up | `/journey` | Built |

## C and D · Journey and stations

| Code | Screen | Route | Status |
|---|---|---|---|
| D1 | Journey page: path map (3D/2D) and station cards (C3); station intro | `/assessment`, `/assessment/[station]` | Built |
| D2 | Interests: swipe cards | `/assessment/interests` | Built |
| — | Personality: 1–5 statements | `/assessment/personality` | Built (no code in comments) |
| D4 | Values: card sort and ordering | `/assessment/values` | Built |
| — | Strengths: self-ratings | `/assessment/abilities` | Built (no code in comments) |
| D7 | About you | `/assessment/context` | Built |
| D8 | Micro-insight pause | inside stations | Built |
| D9 | Come back later | inside stations | Built |
| D10 | Station complete | inside stations | Built |
| D11 | Attention-check item | inside stations | Built |

## E · Results

| Code | Screen | Route | Status |
|---|---|---|---|
| E1 | Reveal: "This is your world" | `/assessment/result` | Built. Phase 1: E1–E5 sit in the app shell (Home tab) behind the journey gate (first start, unlock) |
| E2 | One last check (readiness) | `/assessment/result` | Built, gaps ([flow 9](flows.md#9-readiness-check)) |
| E3 | Overview | `/assessment/result` | Built |
| E4 | One part in detail (holland, bigFive, values, abilities) | `/assessment/result/[section]` | Built |
| E5 | Matches | `/assessment/result` | Built |
| E6 | Share card | `/assessment/result` | Phase 2 (server-rendered; off in phase 1) |

## F · Career library

| Code | Screen | Route | Status |
|---|---|---|---|
| F1 | All careers: filter, search, sort | `/careers` | Built (fit % needs server mode); hidden in phase 1 |
| F2 | One career | `/careers/[id]` | Built (fit panel needs server mode). Phase 1: in the app shell (Explore tab), opened from Explore, Verify and the results; no favorite, fit or compare |
| F4 | Compare 2–3 careers | `/careers/compare` | Built; hidden in phase 1 |
| F5 | Saved careers | `/careers/favorites` | Phase 2 |

## G · Explore

All hidden in phase 1 (the Explore tab is the island map, I7).

| Code | Screen | Route | Status |
|---|---|---|---|
| G1 | Explore home: list or map, "for your top careers", "near you" | `/explore` | Built (personal parts need server mode) |
| G2 | Search programs, universities, providers | `/explore/search` | Built |
| G3 | One university | `/explore/universities/[id]` | Built |
| G4 | One program, with admission scores by year | `/explore/programs/[id]` | Built |
| G5 | One course provider | `/explore/providers/[id]` | Built |
| G6 | Compare 2–3 programs | `/explore/compare` | Built |
| G7 | Saved opportunities | `/explore/saved` | Phase 2 |

## B and J · Accounts, parents, schools (phase 2)

All hidden in phase 1.

| Code | Screen | Route | Status |
|---|---|---|---|
| — | Sign in, enter code | `/login`, `/verify` | Phase 2 |
| — | Account | `/account` | Phase 2 |
| B7–B8 | Teen asks a parent; follows the status | `/ask-parent` | Phase 2 / Parked |
| B9 | Join a school with a class code; school staff screen | `/school/join`, `/school/admin` | Phase 2 / Parked |
| J1–J2 | Parent opens the link, verifies, agrees | `/consent/[token]` | Phase 2 / Parked |
| J3 | Family page | `/family` | Phase 2 |
| J8 | Withdraw a permission | `/family/settings` | Phase 2 |

## K · Admin (phase 2)

All hidden in phase 1.

| Code | Screen | Route |
|---|---|---|
| K1 | Admin shell (404 for everyone else) | `/admin` |
| K2 | Overview: KPI tiles, assessment funnel | `/admin` |
| K3 | Users list | `/admin/users` |
| K4 | User detail | `/admin/users/[id]` |
| K8 | Assessment analytics: item distributions, skips, timing, reliability | `/admin/assessment` |
| — | Content health | `/admin/content` |
| K18 | Feature flags | `/admin/flags` |
| K21 | Audit log | `/admin/audit` |
| K22 | System health | `/admin/system` |

## Developer pages

| Page | What | Note |
|---|---|---|
| `/dev/local` | On-device check: demo assessment, fill four stations, wipe | Hidden in production builds |
| `/dev/world` | Island-world prototype (MX: islands) | Hidden in production builds |
| `/dev/path` | Path-map prototype (MX-18) | Hidden in production builds |
| `/dev/engine` | Engine and content smoke test | Hidden in production builds |
| `/dev/paths` | Try the draft Verify tasks for all 12 paths (nothing saved) | Hidden in production builds |
