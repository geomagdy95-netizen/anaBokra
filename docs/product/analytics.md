# Analytics, feedback and crawler protection (phase 1)

Written 16 Oct 2026. Phase 1 keeps every personal detail on the phone (counsel, 13 Oct 2026), so we learn about the journey only from **anonymous, opt-in records** and **feedback the user chooses to send**. No third-party analytics (they would send device identifiers abroad).

## What is collected

All records carry only the age group, stage, language and session code (if entered), plus the ISO week they arrived. No name, phone, ID, device identifier, IP address or exact time. Records can't be linked to each other.

| Record | Sent when | Answers |
|---|---|---|
| Summary (`anon_stats`) | a result is made | Which interests, groups and values come out on top |
| Path check (`anon_path_checks`) | a field is checked | How fields fit people |
| Results rating (`anon_ratings`) | the 1–5 "clear and useful" question | Are results understood |
| Game score (`anon_game_scores`) | first play of each game | Comparison with other players |
| **Milestone** (`anon_steps`) | once per milestone | Where people drop off (Discover tasks 1–10, Discover done, results, field check started, quest started/finished, career chosen, circumstances answered) |
| **Career view** (`anon_career_views`) | once per career page | Which careers people are curious about |
| **Usage** (`anon_usage`) | at most once a day | Which map and page actions people use (dock, search, zoom, tabs, myths, hurdle sources…) |
| **Feedback** (`anon_feedback`) | the user presses Send | Rating, what helped, what was confusing, a short note |

Milestones are worked out on the phone from what it already stores (`journeySteps` in `apps/web/src/lib/local/stats.ts`); usage counts and career views are kept in the browser (`lib/local/usage.ts`) and sent with the next sync, or dropped if statistics are off. Feedback is independent of the statistics switch; its note is cleaned of e-mails, links, @handles and long numbers on the phone and again on the server (`cleanFeedbackText`).

Consent wording: `docs/legal/consent-texts.*.md` §1.6 (extended 16 Oct) and §1.8 (feedback), both flagged for counsel.

## Reading it

Admin → **Insights** (`/admin/insights`, super admin, analyst, assessment lead): the funnel (each step as a share of those who started Discover), most viewed career pages, field checks by band, the results rating, usage counts, and the latest feedback. Filter by session code to see one university session.

Numbers only include people who opted in, so treat them as a sample, not a census.

## Crawler protection

| Layer | Where | What it does |
|---|---|---|
| `robots.txt` | `apps/web/src/app/robots.ts` | Search engines may index public pages; the app, admin, API and dev areas are off-limits; ~45 AI crawlers are disallowed everywhere |
| No-AI signals | `next.config.ts`, `public/.well-known/tdmrep.json` | `X-Robots-Tag: noai, noimageai` and `tdm-reservation: 1` on every response; app screens also `noindex` |
| Active blocking | `apps/web/src/server/bot-guard.ts` via `src/proxy.ts` | 403 for declared AI crawlers and scraping tools (python-requests, Scrapy, headless browsers…) |
| Rate limit | same | 600 page/API requests per IP per minute (static files excluded); 429 above |
| Honeypot | hidden footer link `/ab-trail` | Disallowed in robots.txt and invisible to people; whoever follows it is blocked for a day |
| Terms of use | `docs/legal/terms-of-use.*.md` | Forbids automated collection and AI training; reserves TDM rights (flagged for counsel) |

User-Agents can be faked and the memory limits are per server process, so this stops polite and careless crawlers, not a determined one. Content shipped to the browser (paths, career facts) can still be read from the app bundle.

## Before going live

1. Apply the migration `supabase/migrations/20261016000001_anon_journey_feedback.sql`.
2. Set `NEXT_PUBLIC_SITE_URL` (used in robots.txt).
3. Bot guard settings: on in production by default; `BOT_GUARD=off` disables it, `BOT_RATE_PER_MIN` changes the budget, `BOT_ALLOW_UA` lets an uptime monitor through.
4. **Strongly recommended:** put the site behind a CDN/WAF bot layer (e.g. Cloudflare "Block AI bots" and bot management, or the host's WAF), which catches crawlers that fake their User-Agent. Check with counsel first: such a service sees visitors' IP addresses (personal data) and may process them abroad.
