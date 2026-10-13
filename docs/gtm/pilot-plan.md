# anaBokra University Pilot Plan (MX-09)

Closed beta, free · 3–5 universities or institutes (Cairo/Alexandria) through career centres or student clubs · ages 18–25, students and recent graduates · about 300 participants · November to mid-December 2026
Partner reports by 31 December 2026 · Public launch: 16 January 2027.

> On 11 October 2026 the phase 1 audience changed to **18–25-year-olds**, with **15–17-year-olds allowed from the public launch** (since 13 Oct 2026 they accept for themselves; there is no parent step). The pilot itself is for adults at universities. The school pilot (tablets, ID lists) is parked; see `docs/parked/teens/`.
>
> Dates assume a Sunday-to-Thursday week. Sessions end in mid-December, before most universities' first-term exams (usually January — confirm per partner), and leave about four weeks for fixes before launch.

## 1. Goals

| Goal | Why |
|---|---|
| Learn whether young adults finish and value the experience | Product feedback and fixes before the 16 January launch |
| Collect testimonials and a case study from willing partners | Launch credibility |
| Gather pilot data on the Arabic assessment | Reliability (internal consistency per scale) and preliminary norms for 18–25-year-olds. The assessment is **being validated** in this pilot; nothing is claimed as validated yet |
| Test the university delivery model (career centre + session + partner report) | Shape the university offer and pricing |

## 2. How data is handled in phase 1

Participants use the app on **their own phones**. Everything stays on the phone, **encrypted**; nobody creates an account. Participants can move their data to a new phone with a backup file. Nothing personal reaches anaBokra (counsel agreed, 13 Oct 2026).

| What | Where it lives | Who can link it to a person |
|---|---|---|
| Profile, answers, results, readiness, feedback | On the participant's phone | Nobody at anaBokra |
| Anonymous answer sets (**only if the participant opts in**) | Sent once after the last part: no name, no ID, no key; tagged only with the partner's event code, age band, stage (student or graduate) and language | Nobody |
| Readiness before and after (**same opt-in**) | Sent with a random code made on the phone, so the two answers can be matched. The code is never on the answer sets | Only from that phone, until the app is deleted |
| Anonymous statistics (**only if the participant opts in**): one summary per finished assessment (age band, stage, language, top areas and groups, score bands, completion), with the event code | Sent with no ID, device identifier or exact time | Nobody |

- Participants **consent for themselves** on their phone. Ages 18–20 are an open legal question (Civil Code capacity at 21) that the lawyer must answer before sessions start.
- **Event code:** each partner session gets its own short code (3–20 letters, digits or dashes, for example `CU-FCI-1`); a partner with several sessions gets one code per session. Each code is a row in `pilot_events` with the partner, the dates it can be entered, and whether that partner offers the research opt-in. Entering it links the participant's totals and research data to that partner's report. The app works without one, and a participant can join or leave later from the main page.
- **No AI**, no accounts, no phone numbers, emails or names.
- **Deleting:** *Delete all my data* removes everything from the phone at once. Anonymous data already sent cannot be traced to a person, so it cannot be removed.
- **Retention:** anonymous research data is kept until the analysis is done, and no later than 17 June 2027. Group statistics may be kept.

## 3. Pre-pilot (now to 31 October)

| Task | Owner | Done by |
|---|---|---|
| Outreach to 10–15 career centres, student activity offices and student clubs to land 3–5 (see `outreach-templates.md`) | Founder | 31 Oct |
| **Lawyer brief and sign-off** (`docs/legal/lawyer-brief.md`): in-app texts, partner agreement, the anonymous uploads, ages 18–20 | Founder + lawyer | 25 Oct |
| Partner agreement signed with each partner (`partner-agreement.en.md`) | Founder + partner | 31 Oct |
| Check whether each university needs a research or ethics approval for the research opt-in | Founder + partner | 31 Oct |
| Pilot build ready (see `docs/product/world-spec.md`, section 6) | anaBokra | 31 Oct |

**Gate:** no session runs until the lawyer has signed off. If sign-off slips, the timeline shifts with it.

Selection criteria: an engaged career centre or club lead, a room for 30–60 people with Wi-Fi, a channel to reach students (page, group, mailing list), a mix of faculties and both cities if possible.

## 4. Week-by-week timeline

| Week | Dates | Milestone | Owner |
|---|---|---|---|
| W1 | 1–5 Nov | Kickoff with each partner: session dates, rooms, expected numbers, promotion plan. Staff walkthrough (60 min). Event codes issued. | anaBokra + partner |
| W2 | 8–12 Nov | Promotion through the partner's channels. Dry run with 5–10 students on their own phones (Android and iPhone, including older models). | Partner; anaBokra |
| W3–W5 | 15 Nov – 3 Dec | **Session 1** at each partner (about 60 min): intro, open the app, accept, enter the event code, baseline readiness, **parts 1 and 2**. **Parts 3 and 4** at home within a week, with one reminder through the partner's channel, or in an optional **Session 2**. Participants see their results in the app and rate them. | Both |
| W5–W6 | by 10 Dec | **Results workshop** led by career-centre staff (about 60 min): reading results, exploring the islands, next steps. | Partner; anaBokra supports |
| W7 | 13–17 Dec | The app asks for the follow-up readiness check and a short feedback survey, two weeks after results. Staff interview (20 min). Testimonial request. **Data frozen 17 Dec.** | Both |
| Wrap | by 31 Dec | **Partner reports delivered.** Debrief call offered in the first week of January, before exams. | anaBokra |

## 5. Roles

| | Partner (career centre / club) | anaBokra |
|---|---|---|
| Before | Names a lead. Books the room. Promotes the sessions. Checks whether a research approval is needed. | Provides materials, staff walkthrough, event codes, promotion text. |
| During sessions | Hosts, welcomes participants, sends the one reminder for parts 3–4. | Runs session 1, helps with phones, answers questions. |
| After results | Leads the results workshop. Points anyone who is upset to [student counselling / named contact]. | Provides talking points, delivers the partner report. |
| Data | Receives only the anonymized partner report. | Receives only totals and opt-in anonymous data; never names. |

## 6. Session logistics

- **Format:** the assessment has 4 parts of 10–12 minutes. Session 1 covers parts 1–2 (about 25 minutes of answering) inside a 60-minute slot.
- **Devices:** participants' own phones, in the browser or installed to the home screen. The app works offline once loaded. Bring a mobile hotspot in case the room's Wi-Fi is weak, and [2–3] loaner phones; a loaner's data is deleted at the end of the session.
- **Private browsing:** the app warns when the browser won't keep data; participants should use a normal window.
- **Changing phones:** results stay on the phone they were made on. Say this at the start.
- **Language:** Arabic by default, English available. The Arabic version is the one being validated, so answers given in English are reported but excluded from the Arabic reliability and norms analysis.
- **Wellbeing:** results are framed as guidance, not diagnosis. Each partner names a contact (for example student counselling), and the app shows [a verified helpline number].

## 7. Success metrics

| Metric | Target | How measured |
|---|---|---|
| Completion | **At least 60%** of those who start finish all 4 parts (parts 3–4 are done at home) | Totals per event code |
| Results rating | **At least 4 out of 5** on "my results were clear and useful" | In the app, right after results |
| Readiness change | Positive average change from session 1 to the follow-up. Exact size set after baseline | The readiness check (`readiness.json`, items to be reviewed for students and graduates by the psychologist), paired by random code, opt-in only |
| Partner satisfaction | At least 4 out of 5 on usefulness, plus an interview | Survey + interview (W7) |
| Partner willingness | At least 60% of partners willing to give a testimonial or continue | Direct ask in W7 |
| Data for validation | At least [150] complete Arabic answer sets with opt-in | Upload count; analysis by the psychologist. Results are preliminary |

The follow-up comes two weeks after results, so the report describes the change as short-term. Report negative results honestly.

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Lawyer sign-off late, or 18–20 needs special handling | Brief the lawyer now, with ages 18–20 as the first question. If needed, start with 21–25 and add 18–20 later. |
| Low turnout | Partner promotes; short ask (one hour); results workshop as the hook; [certificate of participation — partner to decide]. |
| Low completion of parts 3–4 at home | One reminder through the partner; optional session 2; resumable progress. |
| A university requires research approval | Ask in W1. If it takes too long, run the session without the research opt-in for that partner. |
| Old or full phones | Dry run on older models; loaner phones; works in the browser without installing. |
| Data lost (private window, phone change) | Warning in the app; say it at the start. |
| Exams or events cut into sessions | Confirm calendars at kickoff; finish by mid-December. |
| Participants misread results as a verdict | Guidance-not-diagnosis framing in the app, at the session and in the workshop. |
| Small samples limit validation | Present as preliminary; pool across partners. |
| Solo founder capacity | One partner session per day; psychologist as backup. |

## 9. Assumptions the founder must confirm

1. Partner list, session dates and room capacity.
2. ~~Event code format and whether a partner can have several sessions.~~ Decided: one code per session, 3–20 letters, digits or dashes (see "Event code").
3. The completion target (60%) and validation target ([150]).
4. Number of loaner phones.
5. The helpline number and each partner's contact for someone who is upset.
6. Readiness items reworded for students and graduates (psychologist).
