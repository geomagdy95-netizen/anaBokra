# Glossary: our vocabulary

The words we use for anaBokra's parts, in product talk, on screen (English and the app's Egyptian Arabic) and in the code. When a new idea needs a name, add it here in the same change.

**Conventions**
- **App Arabic is Egyptian colloquial** («عاميّة»). The legal documents use formal Arabic (فصحى).
- **Arabic text with gendered forms has a feminine variant.** Its key ends in `F`, for example `watch` / `watchF`. It's used once the user's gender is known; otherwise the masculine form is shown. Gender is used only for grammar. **Phase 1 doesn't ask for it yet**, so everyone sees the masculine form (open item in [flows.md](flows.md#known-gaps)).
- "**User**" in these documents means the young person. On screen we speak to them directly as "you" (إنت / إنتي).

---

## 1. Product and world

| Term | Meaning | On screen (EN / AR) | In the code |
|---|---|---|---|
| **anaBokra** | The product. "Me tomorrow". | anaBokra / «أنا بكرة» | — |
| **Phase 1** | Pilot (Nov–Dec 2026) and launch (16 Jan 2027). Data stays on the phone; no accounts, no AI. | — | `DATA_MODE = 'local'` |
| **Phase 2** | After the licence and permits: accounts, server storage, parents and schools. | — | `DATA_MODE = 'server'` |
| **Journey** | The assessment as a whole, shown as a path with stations. | Your journey / رحلتك | `/assessment`, `features/assessment/hub.tsx` |
| **Path map** | The 3D (or 2D) landscape on the journey page, with one stop per station. Built. | 3D / 2D | `features/path` |
| **Your world** | The landscape generated from the user's interests, shown at the reveal. Bigger region = stronger interest. | This is your world / ده عالمك | `features/path/generate-world.ts` |
| **Island world** | The planned map of islands (L0–L4) joined by bridges. Prototype only. | — | `/dev/world`, `features/world`, [world spec](../product/world-spec.md) |
| **Core island** (L0) | The user's own island ("me"): profile, results, history. In the prototype, tapping it opens the profile. | — | `CoreIsland` in `world-canvas.tsx` |
| **Group island** (L1) | One island per career group (12). | — | Designed |
| **Career island** (L2) | One island per career inside a selected group. | — | Designed |
| **Progress plan** (L3) / **Career plan** (L4) | What to do now (by stage), and the main route plus backups, for a selected career. | — | Designed |
| **Bridge** | The path to an island, built from phases. Shows exploration progress; it never endorses a career. | — | Designed (`bridges.tsx` draws them in the prototype) |
| **Phase** (of a bridge) | One step block of a bridge: an assessment, a reading, a task. The four questionnaires are the core island's phases. | — | Designed |
| **Upgrade** | A bridge that changes when results are re-scored, shown to the user as an update. | — | Designed |
| **Career group** (= cluster) | One of 12 groups of similar careers: Health & Medicine, Engineering, Technology & Data, Business & Finance, Marketing & Media, Creative & Design, Science & Research, Tourism & Hospitality, Law & Public Service, Education & Social, Skilled Trades & Technical, Agriculture & Food. | e.g. الصحة والطب، الهندسة، التكنولوجيا والبيانات | `cluster`, `packages/content/careers/catalog.json` |
| **Career library** | All 82 careers, each with a page. | Careers | `/careers`, `packages/content/careers` |
| **Discover** | Step 1 of the assessment, on my island: 10 short tasks of interests, strengths and a short personality set that suggest paths. Replaces the stations. | Discover / اكتشف | `/journey`, `lib/journey/discover-plan.ts` |
| **Verify** | Step 2, on a path island: the path's own questions (day, real deal, try it) plus values once, giving fits well / partly / worth rethinking. | — | `packages/content/paths`, `/dev/paths` |
| **Path** | A career-group island checked in Verify; one of the 12 groups. | — | `cluster` |
| **Task** | 5–10 questions in mixed formats; one plank of a bridge. | Task {n} / المهمة {n} | `DiscoverTask`, `PathTask` |
| **Early guess** | Path suggestions after Discover task 4, from interests only, clearly labelled. | Early guess / تخمين أوّلي | `PreviewStage 'early'` |
| **Suggested paths** | The top paths from task 8 on (interests scorable), sharpening to task 10. | Paths suggested for you / مجالات مقترحة ليك | `previewSuggestions`, `rankGroups` |
| **Short personality set** | Mini-IPIP: 20 of the 50 personality statements, 4 per trait, used in Discover (psychologist to confirm). | — | `personalityShort()` |
| **A day as… / The real deal / Try it** | Verify's three tasks: story moments, this-or-that trade-offs, and work situations or small puzzles followed by "did you enjoy that?". Puzzles are taste tests, never graded. | يوم في… / الحقيقة من غير تجميل / جرّب بنفسك | `PathStoryItem`, `PathChoiceItem`, `PathScenarioItem`, `PathPuzzleItem` |
| **Explore** | Universities (137), programs (372) and course providers (42) in Egypt. | Explore | `/explore`, `packages/content/opportunities` |

## 2. Assessment

| Term | Meaning | On screen (EN / AR) | In the code |
|---|---|---|---|
| **Assessment** | The four questionnaires plus "About you". We avoid calling it a "test" (see section 8). | — | `AssessmentService` |
| **Station** | One stop of the journey. In order: interests, personality, values, strengths (abilities), About you. Each unlocks after the one before. | e.g. Interests / الاهتمامات | `STATION_IDS`, `server/assessment/config.ts` |
| **Instrument** | The questionnaire behind a station, with a version. | — | `packages/content/instruments/*.json` |
| **Interests** | 60 activities, swiped like/dislike on a 1–5 scale, plus one attention check. O*NET Interest Profiler Short Form. | Interests / الاهتمامات | `interests.json` |
| **Personality** | 50 statements, 1–5 "describes me". IPIP Big Five markers. | Personality / الشخصية | `personality.json` |
| **Values** (work values) | 21 need-cards sorted into must have (max 7), nice to have, don't care; then the top values are ordered. | Values / القيم | `values.json`, `values-station.tsx` |
| **Strengths** (abilities) | 12 self-ratings of ability domains. The planned ICAR puzzle items aren't in yet. | Strengths / نقط القوة | `abilities.json` |
| **About you** (context) | Optional last stop: stage, then school questions or field of study and year, budget, governorate. | About you / عنك | `context-form.tsx`, `UserContext` |
| **Stage** | Where the user is now: school, university (or institute), graduated. | Where are you now? / إنت في أنهي مرحلة دلوقتي؟ | `STAGES`, `UserContext.stage` |
| **Field of study** | One of 21 groups of Egyptian faculties (Medicine, Commerce, Al-Alsun, Computers and Information, etc.). | What do you study? / بتدرس إيه؟ | `STUDY_FIELDS` |
| **Session** (assessment session) | One run through the stations, from start to result. `full` = all stations; `quick` = interests only (phase 2 taster). Not the same as a **pilot session** (section 6). | — | `SessionKind` |
| **Micro-insight** | A short neutral pause every 8–10 questions: encouragement and progress, never a score. | — | `micro-insight.tsx` (D8) |
| **Attention check** | A question with one right answer, to spot random tapping. | — | `attentionCheck` items |
| **Save queue** | Saves each answer as it's given and retries when the connection or storage comes back. | Saving… / Saved | `save-queue.ts` |
| **Finalize** | Turning the answers into a result. Allowed once at least one questionnaire can be scored ("Skip the rest and see my matches"). | — | `finalize`, `scoreSession` |
| **Teaser** | The 12-card interests taster on the public site, before any sign-up. | — | `/try`, `features/public/teaser.ts` |
| **Retake** | A new assessment, allowed 182 days (about six months) after the last result. | Retake / إعادة التقييم | `RETAKE_AFTER_DAYS` |

## 3. Results and matching

| Term | Meaning | On screen (EN / AR) | In the code |
|---|---|---|---|
| **Result** | Scores, quality flags and career matches for one session. A newer result replaces it as the current one; older ones are kept. | Your results are ready / نتايجك جاهزة | `ResultRecord` |
| **Reveal** | The animated first view of "your world" after finishing. | This is your world / ده عالمك | `reveal.tsx` (E1) |
| **Holland code** | The top 2–3 interest types (R, I, A, S, E, C), e.g. "ISA". | Interests (Holland code) / الاهتمامات (كود هولاند) | `RIASEC` |
| **RIASEC** | The six interest types: Realistic, Investigative, Artistic, Social, Enterprising, Conventional. | — | `RIASEC` |
| **Big Five** | The five personality traits: extraversion, agreeableness, conscientiousness, emotional stability, intellect. | (section title "Strengths", see section 9) | `BIG_FIVE` |
| **Band** | A score shown as low / mid / high instead of a number. | — | `bands.ts`, `toBand` |
| **Coverage** | How complete a result is (share of the four parts that were scored). | — | `coverage` |
| **Quality flags** | Signs a set of answers may not be reliable: straight-lining, low variance, too fast, failed attention check. Never shown as blame. | — | `checkQuality` |
| **Match** | A career ranked against the user's result. 20 are stored: top 5 shown, the next 15 under "more", plus up to 3 surprising ones. | Your top matches / أعلى توافقاتك | `CareerMatch`, `StoredMatch` |
| **Fit** | A match's score, 0–100%. Weights: interests 45%, personality 20%, abilities 20%, values 15%, rescaled over the parts that exist. | {n}% fit / توافق {n}% | `DEFAULT_WEIGHTS` |
| **Surprising match** | A strong match from a group not already in the top matches, to widen horizons. | Surprising matches / توافقات مفاجئة | `surprisingMatches` |
| **Reason** | Why a career fits: an interest, trait, value or ability. | Why it fits / ليه بتناسبك | `Reason` |
| **Watch-out** | A gentle caution: a trait the career may stretch, or an ability gap. | Worth keeping in mind / حاجات تاخد بالك منها | `WatchOut` |
| **Context flag** | A note from "About you". `fieldMatch` (good news, shown with the reasons), `fieldSwitch`, `trackMismatch`, `scoreReach`, `costHigh` (cautions). Context never removes a career. | — | `ContextFlag`, `contextFlags` |
| **Explanation** | The sentences for a match, written from templates in Arabic and English. No AI in phase 1. | — | `packages/ai/src/templates.ts` |
| **Readiness check** | Six statements on how ready the user feels to choose. The pilot's main measure. See [flows.md](flows.md#9-readiness-check). | One last check / سؤال أخير | `readiness.json`, `saveReadiness` |
| **Pre / post** | Readiness before the assessment (baseline) and after results. Only "post" exists in the app today. | — | `ReadinessPhase` |

## 4. Profile and consent (phase 1, on the phone)

| Term | Meaning | On screen (EN / AR) | In the code |
|---|---|---|---|
| **Profile** | The user on this phone: age band, stage, language, optional gender, consent, session code. | — | `LocalProfile` |
| **Age band** | Under 15, 15–17, 18–20, 21–25, 26+. 18–20 is kept apart because full legal capacity is at 21 (open legal question). | How old are you? | `AgeBand` |
| **First start** | Everything before the first question: age, acceptance, parent consent, session code, research question. | Before you start / قبل البداية | `first-start.tsx` |
| **Acceptance** | An adult's own agreement to the terms and privacy policy, ticked on the phone. | — | `ConsentBasis 'adult_self'` |
| **Parent consent** (guardian consent) | For 15–17: the parent or legal guardian verifies their phone with a code, gives their national ID, agrees and sets a PIN. | Your permission for your child to use anaBokra / إذنكم باستخدام ابنكم/ابنتكم «أنا بكرة» | `guardian-consent.tsx`, `'guardian_verified'` |
| **Hand-over** | The screen asking the 15–17-year-old to pass the phone to their parent. | — | step `hand-over` |
| **National ID check** | Checks the 14-digit ID's format, century, birth date and governorate, and the parent's age (21+, and old enough to be the parent). Done on the phone; the ID never leaves it. | — | `lib/national-id.ts` |
| **Parent PIN** | 4–6 digits set by the parent; needed to delete data or change settings on a 15–17 profile. Stored only as a salted hash. | Parent PIN / الرمز السري لولي الأمر | `lib/local/pin.ts` |
| **Consent texts** | The exact wording of every consent screen, with a version (now `consent-0.4-draft`). | — | `docs/legal/consent-texts.*.md`, `CONSENT_TEXT_VERSION` |

## 5. Data on the phone

| Term | Meaning | On screen (EN / AR) | In the code |
|---|---|---|---|
| **On-device runtime** | The assessment service, engine and content running inside the browser, with the phone's storage behind it. | — | `lib/local/runtime.ts` |
| **Device store** | The encrypted key-value store in the browser's IndexedDB (`anabokra`). | — | `lib/local/kv.ts` |
| **Device key** | The AES-256 key that encrypts the device store. Made on the phone and can't be exported. | — | `deviceKey`, IndexedDB `anabokra-key` |
| **Storage warning** | Shown when the browser can't keep data, for example in a private window. | — | `StorageWarning` |
| **Delete all my data** | Removes the profile and everything stored for it from the phone. | Delete everything? / مسح كل حاجة؟ | `delete-data.tsx` |
| **Backup file** | A file of the user's data locked with a passphrase they choose. | Backup file / ملف نسخة احتياطية | `.anabokra`, `sealWithPassphrase` |
| **Passphrase** | What locks a backup file. Without it nobody can open the file, including us. | Passphrase / كلمة المرور | — |
| **Transfer code** + **key** | Moving data directly: an 8-character code and a 16-character key. The data goes through our relay sealed; the key never reaches the server. | Transfer code / رمز نقل | `sealForTransfer`, `/api/transfer` |
| **Relay** | The server part that holds sealed transfer data for up to 10 minutes or until it's collected. | — | `server/transfer/relay.ts` |
| **Restore** | Bringing data in from a backup file or transfer code. Replaces the profile on this phone. | Restore my data / استرجاع بياناتي | `restore-data.tsx` |
| **Bundle** | What a backup or transfer carries: profile, assessment data, and what was already sent. | — | `ProfileBundle` |

## 6. Statistics, pilot and research

| Term | Meaning | On screen (EN / AR) | In the code |
|---|---|---|---|
| **Anonymous statistics** | With opt-in: one coarse summary per result (age band, stage, language, top areas and groups, bands, completion, session code). No ID, no time. | Anonymous statistics / إحصاءات من غير هوية | `stats-summary.ts`, `/api/stats`, `anon_stats` |
| **Pilot** | The university pilot, 15 Nov – 10 Dec 2026. See [pilot plan](../gtm/pilot-plan.md). | — | — |
| **Partner** | A university running pilot sessions with us. | — | `pilot_events.partner` |
| **Pilot session** (event) | One partner session, about 60 minutes. Not the same as an assessment session. | University session / جلسة الجامعة | `PilotEvent` |
| **Session code** (event code) | The partner session's short code, e.g. `CU-FCI-1`. Links totals and research to that session's report. On screen it's always "session code"; in the code it's `eventCode`. | Session code / رمز الجلسة | `EVENT_CODE`, `/api/events/check` |
| **Research opt-in** | An adult's yes to sending research data, offered only when the partner allows research. | Help us check the Arabic questions? / تساعدنا نتأكد من الأسئلة العربي؟ | `consent.research` |
| **Answer set** | A participant's item answers for one result, with the session code, age band, stage and language. No ID, no key. | — | `researchAnswerSetSchema`, `research_answer_sets` |
| **Link code** | A random 26-character code made on the phone that pairs that person's readiness answers before and after. Never on an answer set. Turning research off deletes the readiness records sent with it. | — | `LINK_CODE`, `research_readiness` |
| **Cohort report** | The per-partner report of group results. | — | `docs/gtm/cohort-report-template.md` |

## 7. Engineering

| Term | Meaning | In the code |
|---|---|---|
| **Engine** | Pure scoring and matching: no network, no storage. Runs on the phone and on the server. | `packages/engine` |
| **Content** | Questionnaires, careers, groups, study fields, universities, programs, providers, industries. | `packages/content` |
| **AI package** | Explanation templates (used) and an AI explainer (off in phase 1). | `packages/ai` |
| **Repo** (repository) | The storage port behind the assessment service: on the phone (`LocalAssessmentRepo`), in memory for tests, or Supabase (phase 2). | `AssessmentRepo` |
| **Data mode** | `local` or `server`; see the [README](README.md#two-data-modes). | `lib/data-mode.ts` |
| **Screen code** | The letter-number name of a screen (A1, D7, E2…). See [screens.md](screens.md). | Code comments |
| **Message key** | The name of a piece of UI text in `apps/web/messages/{en,ar}.json`, e.g. `Local.research.title`. | next-intl |

## 8. Words we use and avoid

| Say | Don't say | Why |
|---|---|---|
| assessment, questions, journey | test, exam, score you passed | It's guidance with no right or wrong answers, and nothing to do with grades |
| guidance to explore | diagnosis, verdict, the right career for you | Results suggest; they don't decide (terms of use, consent texts) |
| fit, match | suitability, eligibility | A match is about interests and style, not qualification |
| worth keeping in mind | weakness, problem, you can't | Watch-outs are gentle and never final |
| builds on what you study / moving in usually means extra study | wrong field, not qualified | `fieldSwitch` says a change is possible |
| without your name or any ID; can't be traced back to you | anonymous (alone, in legal text) | Say what is left out, so the claim can be checked |
| stays on this phone, encrypted | 100% secure, nobody can ever see it | Anyone who can open the app on the phone can see the results |
| parent or guardian | parents (only) | Legal guardians count too |
| session code | event code | "Event" is code-only vocabulary |

## 9. Naming issues to settle

| Issue | Today | Proposal |
|---|---|---|
| "Strengths" (نقط القوة) names two things | The abilities station is called **Strengths**, and the results section for **personality** (Big Five) is also titled **Strengths** | Keep "Strengths" for abilities; call the personality section "How you work" / «طريقتك في الشغل» (psychologist to confirm) |
| "Values" vs "Work values" | Station: Values / القيم; results section: Work values / قيم العمل | Use "Work values" everywhere |
| Readiness phases | Code says `pre`/`post`; the pilot plan says baseline / follow-up; the app's after-results check is stored as `post` | Use **baseline**, **after results** and **follow-up** in product talk; decide which one `post` means before the pilot (see [readiness](flows.md#9-readiness-check)) |
| "Session" | Assessment session vs pilot session | Say "assessment" for the first and "pilot session" for the second |
