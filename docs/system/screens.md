# Screens

Every screen and route, by **screen code**. The letter is the area; the number is the screen. The codes come from the original screen list and survive in code comments. Codes marked *proposed* are new: the phase 1 on-device screens never had codes. Routes start with `/ar` or `/en`.

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
| A1 | Landing | `/` | Built |
| A2–A4 | Teaser: intro, 12 interest cards, RIASEC preview, "save my result" | `/try` | Built (answers stay in the browser) |
| A5 | For parents | `/parents` | Built, describes phase 2 routes |
| A6 | For schools | `/schools` | Built; school offer parked |
| A8 | Legal pages (privacy, terms, "Your data, in short") | `/legal/[doc]` | Built (drafts from `docs/legal`) |

## L · Phase 1 on-device screens *(proposed codes)*

| Code | Screen | Where | Status |
|---|---|---|---|
| L1 | Age question | `/assessment`, first start | Built |
| L2 | Under 15: not yet | first start | Built |
| L3 | Hand the phone to your parent | first start | Built |
| L4 | Parent consent (name, ID, phone code, ticks, PIN) | first start | Built |
| L5 | Thank you, hand the phone back | first start | Built |
| L6 | Before you start (adult acceptance) | first start | Built |
| L7 | Joining a session? | first start, and main page | Built |
| L8 | Help us check the Arabic questions? | after L7 if offered, and main page | Built |
| L9 | Restore my data (file or code) | first start | Built |
| L10 | Main-page settings: anonymous statistics, university session, move to a new phone, delete all my data | `/assessment` footer | Built |
| L11 | Storage warning (private window) | `/assessment` | Built |

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
| E1 | Reveal: "This is your world" | `/assessment/result` | Built |
| E2 | One last check (readiness) | `/assessment/result` | Built, gaps ([flow 9](flows.md#9-readiness-check)) |
| E3 | Overview | `/assessment/result` | Built |
| E4 | One part in detail (holland, bigFive, values, abilities) | `/assessment/result/[section]` | Built |
| E5 | Matches | `/assessment/result` | Built |
| E6 | Share card | `/assessment/result` | Phase 2 (server-rendered; off in phase 1) |

## F · Career library

| Code | Screen | Route | Status |
|---|---|---|---|
| F1 | All careers: filter, search, sort | `/careers` | Built (fit % needs server mode) |
| F2 | One career | `/careers/[id]` | Built (fit panel needs server mode) |
| F4 | Compare 2–3 careers | `/careers/compare` | Built |
| F5 | Saved careers | `/careers/favorites` | Phase 2 |

## G · Explore

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
| `/dev/local` | On-device check: demo assessment, fill four stations, wipe | Not hidden in production yet |
| `/dev/world` | Island-world prototype (MX: islands) | Not hidden in production yet |
| `/dev/path` | Path-map prototype (MX-18) | Not hidden in production yet |
| `/dev/engine` | Engine and content smoke test | Not hidden in production yet |
