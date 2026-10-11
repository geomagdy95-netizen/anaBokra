> **DRAFT — not legal advice — must be reviewed by Egyptian counsel before use.**

# anaBokra Compliance Map (MX-07)

**Prepared:** 2026-10-09 · **Updated:** 2026-10-11 (phase 1 section 0b: adults 18+) · **Audience:** anaBokra founders, product/engineering, Egyptian counsel · **Status:** working draft, research done from secondary English sources (see section 6). **No primary Arabic text of the Executive Regulations was available to the author.**

## 0. Read this first

1. **Deadline is imminent.** The Executive Regulations (ER) were issued by Ministerial Decision No. 816 of 2025, formally published 1 Nov 2025 (Official Gazette No. 244 supplement "A"), publicly released 25 Dec 2025. The statutory one-year compliance window (Issuance Law Art. 6) is reported to end **31 Oct / 1 Nov 2026** (sources differ by a day). Today is 9 Oct 2026.
2. **The Personal Data Protection Center (PDPC)** launched its licensing portal in 2026 and issued guidelines (Data Protection Principles; Data Subject Consent, v1.1, 26 Jan 2026). No adequacy ("whitelist") of countries had been published as of ~10 Sept 2026 (reported).
3. anaBokra processes **children's data** (always "sensitive" under PDPL Art. 1), plus **psychological** data (also in the "sensitive" definition), exports data to **Europe and the USA**, and targets **minors with an AI component**. This is the highest-scrutiny profile under the law. Penalties for sensitive-data and cross-border breaches: prison of at least 3 months and fines EGP 500,000 to 5,000,000 (Arts. 41, 42), with managers personally liable (Art. 47), doubling on repeat (Art. 48).

**Citation convention.** "Law Art. X" = Personal Data Protection Law No. 151 of 2020 (the "accompanying law"), article numbers as in the English translation by Andersen Egypt. "Issuance Art. X" = the issuing law's articles. "ER Art. X" = Decision 816/2025; **ER article numbers come from law-firm summaries and are unverified against the official text.**

---

## 0b. Phase 1 design (updated 11 Oct 2026) — read this before the tables below

Sections 1–5 and 7 below were written for the **server design** (accounts, WhatsApp sign-in, consent routes A/B/C, AI explanations, storage in Europe), which is now a later phase. **Phase 1** (university pilot Nov–Dec 2026, public launch 16 Jan 2027) works like this:

- **On the device, encrypted, never sent to anaBokra:** profile, answers, scoring, results, islands, points, acceptance records, and for 15–17 the parent's details (name, relationship, national ID number, last 3 phone digits, PIN hash).
- **Ages:** 18+ accept for themselves; **15–17 need a parent or guardian** who verifies their phone by SMS code, enters their national ID (checked on the device: format, date of birth, governorate, check digit, adult and old enough), declares guardianship, accepts the terms and sets a parent PIN. Under-15s are turned away.
- **Reaches the server (OVH):**
  - content requests;
  - the parent's phone number, only to send the code, not stored (a one-way hash is kept ≤ 24 h for rate limiting);
  - opt-in anonymous statistics;
  - opt-in research data at university sessions (adults);
  - encrypted device-transfer payloads anaBokra cannot read, deleted within 10 minutes.
- **Not in phase 1:** accounts, server storage of personal data, AI, analytics, advertising.

### Phase 1 status of each obligation in section 1

| # | Obligation | Phase 1 status | Open question for the lawyer |
|---|---|---|---|
| 11, 9 | Controller licence; sensitive data | anaBokra receives no answers, results or ID numbers. It handles parent phone numbers briefly, opt-in anonymous statistics, opt-in pseudonymous readiness pairs (adults), and ciphertext it can't read | Is any licence needed? Is on-device or relayed encrypted data "processing" by anaBokra? |
| 1, 6, 7 | Consent; children; guardian verification | **15–17:** parent SMS code + national ID checked on the device + declaration + PIN. Adults accept for themselves | Is this an acceptable mechanism? Does it need Center approval when no data reaches us? Parent 21+ or 18+? |
| 8 | Data before consent | Nothing is saved before acceptance or parent consent | — |
| — | National ID collection | Checked and stored only on the device, encrypted; never uploaded | Lawful and proportionate? |
| 22 | Civil capacity (18 vs 21) | Ages 18–20 accept for themselves; age band kept on the device | Can 18–20 consent? |
| 14, 15 | Cross-border; processors | OVH holds no answers or IDs; parent phone numbers pass through for SMS | Is OVH acceptable without transfer consent? Must SMS verification run in Egypt? |
| 2, 18 | Retention | Research data ≤ 17 Jun 2027; phone hashes ≤ 24 h; relay ≤ 10 min; on-device data deleted by the user (parent PIN for 15–17) | Acceptable? |
| 3, 4 | Rights | The user controls on-device data. Anonymous data can't be traced. Readiness pairs deletable via the code on the phone | Enough? |
| 10 | No profiling of children | Matching runs on the device; nothing about a child reaches anaBokra except opt-in anonymous statistics | Are anonymous statistics from 15–17s acceptable with parent opt-in? |
| 16, 17 | Security; breach | Encryption on the device; no identifiable data held centrally except readiness pairs | Breach duties? |
| 12, 13 | Register; DPO | Not appointed | Required? |
| 19, 20 | Marketing; AI | None | — |
| 24 | University partners | Anonymized reports only | Partner role? Research/ethics approvals? |
| 26 | Psychological testing rules | Unchanged | Rules for questionnaires offered to the public and minors? |
| 27 | Consumer and e-signature law | On-device ticks | Valid acceptance? |

### Phase 1 data register

| Category | Fields | Subjects | Where | anaBokra sees it? | Retention |
|---|---|---|---|---|---|
| App data | profile, answers, results, progress, acceptance | Users 15+ | User's device, encrypted | **No** | Until the user deletes it |
| Parent details (15–17) | name, relationship, national ID, last 3 phone digits, PIN hash | Parents/guardians | User's device, encrypted | **No** | Until deleted |
| Phone verification | phone number (transient), code hash, one-way phone hash | Parents/guardians | Verification service + SMS provider [Egypt] | Transiently | Code 10 min; hash ≤ 24 h; number not stored |
| Content requests | IP address, browser type | App users | Content server (OVH) | Technical only | [not stored / ≤ 7 days] |
| Anonymous statistics | age band, stage, language, top areas/groups, score bands, completion, event code | Opt-in users | Stats server (OVH) | Not identifiable | Kept |
| Research answer sets | item answers, event code, age band, stage, language | Opt-in adults at sessions | Stats server (OVH) | Not identifiable | ≤ 17 Jun 2027 |
| Readiness pairs | readiness before/after, random code, event code | Opt-in adults at sessions | Stats server (OVH) | Pseudonymous | ≤ 17 Jun 2027 |
| Transfer relay | encrypted payload, transfer code | Users moving phones | Relay (OVH) | **No** (ciphertext only) | ≤ 10 min |

---

## 1. Obligations map (full; written for the phase 2 server design)

| # | Obligation | Source (article) | What anaBokra does | Where in product | Open question for the lawyer |
|---|---|---|---|---|---|
| 1 | Explicit consent for any collection, processing or disclosure unless the law allows otherwise | Law Art. 2(1), 6(1); ER Art. 2 (consent mechanism must be notified; Center-approved) | All processing is consent-based; consent is explicit, per purpose, recorded with method, identity, time, policy version | Consent screens (A/B/C), consent record table | Does our consent flow need the **Center's prior approval** of the "consent mechanism"? Has the PDPC published an approved template (consent guidelines v1.1)? |
| 2 | Purpose limitation, accuracy, retention only as long as necessary | Law Art. 3 | Purposes listed in policy; retention table (section 4); deletion jobs | Privacy policy s.4-5, s.9; backend retention jobs | Are our proposed retention periods defensible, especially the 5-year consent-record period and 24-month inactivity rule? |
| 3 | Data subject rights: information, access, withdrawal, correction/deletion, restriction, breach notice, objection to processing or its outcomes | Law Art. 2 (rights 1-6) | Rights listed in policy; Settings → My data; request handling process | Privacy policy s.11-12; account settings; DPO inbox | Can a **15-17-year-old exercise rights alone**, or only via the guardian? Our draft allows both. |
| 4 | Respond to requests within 6 working days; no fee for breach notification right; fee cap EGP 20,000 for other rights | Law Art. 32, Art. 2 (last para.), Art. 10 (access requests procedure) | We commit to 6 working days and no fee | DPO workflow, ticket SLA | May we charge no fee at all? Anything required in the written form of requests (Art. 10: written, verify documents)? |
| 5 | Complaints to the Center; decision in 30 working days; comply within 7 | Law Art. 33 | Policy points to the PDPC complaint route | Privacy policy s.11, s.15 | None |
| 6 | **Children's data = sensitive; parent/guardian consent required** | Law Art. 1 (def.), Art. 12; ER Art. 15 (reported: under 15 explicit written guardian consent with defined scope and duration, withdrawable; 15-18 consent from child **or** guardian "under mechanisms set by the Center") | anaBokra requires guardian consent for **every user under 18** (stricter than ER minimum for 15-17). Three consent routes. Before consent: teaser + onboarding only | Routes A/B/C; consent gate on assessments | (a) Is requiring guardian consent for 15-17 lawful/advisable vs allowing the teen to consent? (b) What are the Center's **mechanisms** for ages 15-18? (c) Consent **duration** (ER requires scope/duration for under 15): is 24 months OK? |
| 7 | Verify guardian identity | Law Art. 12; ER Art. 15; Child Law (age proof by official document, Art. 3 in the translation) | Route A: WhatsApp OTP to guardian number; B: account with OTP; C: school collects signed forms | Consent gate; school form | Is **WhatsApp OTP** sufficient proof the person is the *legal* guardian? Do we need ID checks? Do we need a second-guardian rule? |
| 8 | **Collecting minors' data before consent** | Law Art. 12 (child's data consent), Art. 3 | Pre-consent collection limited to nickname, date of birth/age band, teen and parent WhatsApp numbers; teaser stores no answers | Onboarding; teaser | **Top risk.** Is even this minimal pre-consent collection lawful? Should we collect only the parent's number until consent? |
| 9 | **Sensitive data: license/permit + written explicit consent**; security policies | Law Art. 12, 13, 26 (permit for sensitive data), 41 (penalty); ER Art. 14 (reported: license/permit, written consent in paper or electronic form, necessity, no harm, Center security standards, secure e-records of consent and deletion requests) | Treat all assessment data and all minors' data as sensitive; written (electronic) explicit consent; encryption and access control | Consent screens; DB design (separate consent store) | (a) Do **assessment answers** (interests, Big Five, values, abilities) fall in "mental/psychological health" data (Art. 1)? We assume yes. (b) Which **license type** and fee tier? (c) Is an e-checkbox + OTP "written" consent? Law Art. 11 / ER on digital evidence? |
| 10 | **Child activity data minimisation; no profiling/tracking/behavioral monitoring** | Law Art. 12 (para. 4: participation in game/competition/activity cannot be conditional on more data than necessary); ER Art. 14(5) (reported: no classification, tracking or behavioral monitoring of children) | Optional analytics box; pseudonymous; no session replay; no ad profiling | Consent checkbox 7; PostHog config | Is an **assessment that produces a "career profile"** itself "profiling"? Is PostHog analytics on minors permitted at all? Safe design? |
| 11 | Controller license/permit (all controllers; fee-exempt up to 100,000 records) | Law Art. 4(10), 26, 45 (penalty); ER Art. 3, 19 (reported) | Apply via PDPC portal [status: not started] | Corporate compliance | Is a license required even when fees are exempt (≤100,000 records)? Timing vs 31 Oct 2026? May we operate during review (Center decides within 90 days; silence = rejection, Law Art. 27)? |
| 12 | Register of data processing (controller's record) | Law Art. 4(9) | Data inventory in section 3 below seeded; to be maintained | Internal register (to build) | Format required by the Center? |
| 13 | **Data Protection Officer**: appoint, register, publish; qualified; ER detail | Law Art. 8, 9, 39, 40; ER Art. 7-12 (reported: qualifications, Center test, registration, unique code linked to nature/volume of data, annual report) | Appoint [name]; register; publish contact in policy | Privacy policy s.1 | Can a startup appoint an **external/part-time DPO**? Must the DPO be an employee (Art. 8 says "employee within its legal structure")? Which DPO code level fits sensitive children's data? |
| 14 | **Cross-border transfer / storage / sharing abroad**: only to adequate destination, with Center license/permit, and consent | Law Art. 14, 15, 16, 42; ER Art. 16 (reported); Center to publish adequacy list | Disclosed in policy; consent checkbox 4; data stored on OVH Europe; AI call to USA; WhatsApp (Meta); PostHog/Sentry as configured | Consent checkbox 3-4; hosting; vendor list (section 5) | **Top risk.** (a) Do we need a cross-border license **before launch**, and is hosting in Europe a "transfer" (collected in Egypt, stored abroad)? (b) No adequacy list yet; do we need per-vendor permits? (c) Is guardian consent a valid basis (Art. 15 is for non-adequate countries)? (d) Should we host in Egypt instead? |
| 15 | Processors: written contract, instructions, security, deletion, license; foreign processors need Egyptian representative | Law Art. 1 (processor "under formal agreement"), 4(3), 5; ER (representative via Egypt branch/authorized office) | DPAs with OVH, Anthropic, Meta/BSP, PostHog, Sentry [to be signed/checked] | Vendor contracts | Is the foreign vendor's lack of an Egyptian representative **our** problem? Which DPA terms are mandatory? |
| 16 | Security measures for confidentiality, integrity; sensitive-data security policy | Law Art. 4(6), 13 | Encryption, RBAC, audit logs, backups; PII scrubbing in Sentry | Infra, app | Minimum technical standard required by the Center? |
| 17 | **Breach notification**: Center within 72h (immediately if national security); data subject within 3 working days of notifying Center; portal/hotline | Law Art. 7; ER Art. 5 | Incident response runbook [to write]; notify via portal; message parent and teen | Ops runbook | Do we notify the guardian only, or also the minor? |
| 18 | Erase when purpose ends; correct inaccuracies | Law Art. 4(7)-(8) | Retention jobs; deletion on withdrawal (30 days) | Backend | Is our backup lag (35 days) acceptable? |
| 19 | Direct electronic marketing: consent, opt-out, license, 3-year consent records | Law Art. 17, 18, 43; ER Art. 28 | **No marketing** to teens or parents; only transactional WhatsApp messages | WhatsApp templates (transactional only) | Is a reminder message "marketing"? Do "new opportunity" notifications count? |
| 20 | Automated processing/AI: right to object to outcomes; AI training principles and no harm | Law Art. 2(6); ER (AI training reference, reported by Baker McKenzie) | Matches are suggestions; AI gets scores only; processor contract; disclaimer | Results screen disclaimer; policy s.7 | Does using an AI vendor for **children's** results need extra assessment? Confirm Anthropic's no-training/retention terms. |
| 21 | Digital evidence of consent has probative value if technical conditions are met | Law Art. 11; ER (digital evidence article, reported) | Immutable consent log with hashes | Consent store | What technical standard must the consent log meet for court use? |
| 22 | Age of minority | Child Law No. 12/1996 as amended by 126/2008, Art. 3 in the NCCM English translation (child = under 18; verified by ID/birth certificate); Civil Code Art. 44-46 (majority 21; discernment 7; diminished capacity between) | Treat <18 as child for data consent; 18+ self-consent | Age gate at sign-up; Terms s.3 | **Ages 18-20**: Civil Code majority is 21. May an 18-year-old consent? Do we require guardian consent to 21? Also: can a minor 15-17 validly accept the Terms (contract) at all? |
| 23 | Penalties awareness: Art. 36-47 | Law Art. 36 (EGP 100k-1m; 6 months + 200k-2m if for gain/harm), 38 (300k-3m for breaching Art. 4, 5, 7), 41 (sensitive), 42 (cross-border), 45 (license), 47 (manager liability) | Risk register; board awareness | Governance | Exposure of founders personally under Art. 47? Insurance? |
| 24 | Schools (route C): roles, who collects consent, evidence | Law Art. 4 ("where multiple controllers"), 5, 12 | School declaration and guardian slip in consent texts | Phase 2 | Controller / joint controller / processor? Can a school's collection satisfy "written explicit" consent (Art. 12)? Who keeps evidence? Who answers rights requests? |
| 25 | Compliance deadline | Issuance Art. 6; ER publication 1 Nov 2025 | Plan: licenses + DPO + consent mechanism before 31 Oct 2026 | Project plan | Is there any transitional relief for a not-yet-launched product? |
| 26 | Psychological assessment regulation | **Not researched** (e.g., rules on practising psychology, mental-health law) | "Guidance, not diagnosis" disclaimer in Terms s.2 | Terms; results screens | Any Egyptian licensing or professional rules on psychological testing offered online? Wording of disclaimer. |
| 27 | Consumer, e-commerce and e-signature law | **Not researched** | Terms of Use; consent records | Terms | Consumer Protection Law and E-Signature Law (Law 15/2004) implications. Governing law/forum clause for minors. |

---

## 2. Consent route design check (phase 2)

| Route | Evidence of guardian identity | Risk | Mitigation in drafts |
|---|---|---|---|
| A. Teen sends WhatsApp link to parent | Control of WhatsApp number + OTP + self-declared relationship | Teen could use a friend's number | Link expires 7 days; message names the teen; parent can report "not my child"; **LAWYER (row 7)** |
| B. Parent creates family account | OTP + account + adds teen | Lower risk | Same checkboxes per child |
| C. School collects | Signed paper/e-form kept by school | School as proxy; evidence trail | School declaration; anaBokra enables a student only after receiving proof; **LAWYER (row 24)** |

---

## 3. Data inventory — phase 2 server design (not in use in phase 1)

| Category | Fields | Subjects | Purpose | Basis | Sensitive? | Stored in | Shared with | Source |
|---|---|---|---|---|---|---|---|---|
| Identity & contact (teen) | nickname/name, DOB, WhatsApp number | Teens | Account, OTP, age check | Consent (guardian) | **Yes** (child's data) | Supabase on OVH | WhatsApp provider | Teen |
| Profile (teen) | governorate, school, curriculum | Teens | Relevant opportunities | Consent | Yes | Supabase | — | Teen (after consent) |
| Guardian identity | name, WhatsApp number, relationship, consent method | Parents | Verify and record consent | Consent / legal obligation | Not sensitive; linked to child | Supabase (separate consent store) | WhatsApp provider | Parent |
| Assessment answers | interests, Big Five, values, abilities responses | Teens | Scoring | Written consent | **Yes** (child + psychological) | Supabase (restricted) | Never shared raw; parent never sees | Teen |
| Results | scores, matches, roadmap, saved opportunities | Teens | Guidance | Consent | Yes | Supabase | Parent (summary); school (C, per form) | Derived |
| AI explanation text | generated text | Teens | Explanation | Consent | Yes (derived) | Supabase | Anthropic gets scores only (not stored by us in prompts beyond logs [confirm]) | Derived |
| Consent records | method, guardian identity, timestamp, versions, checkbox values, withdrawal | Teens, parents | Proof and management | Legal obligation | Linked to child | Supabase | — | System |
| Usage analytics | events, device, pseudonymous ID | Teens, parents | Product operation | Optional consent | Child's data | PostHog [hosting TBC] | PostHog | System |
| Error logs | stack traces, device, user ID (hashed) | All | Bug fixing | Legitimate-interest-like (Law Art. 6(4)) [LAWYER] | Possibly | Sentry [hosting TBC] | Sentry | System |
| OTP/delivery logs | number, timestamp, status | All | Authentication | Contract | Linked to child | Supabase / provider | WhatsApp provider | System |
| Support messages | free text | All | Support | Consent | Possibly | Email/helpdesk [TBC] | [tool] | User |

---

## 4. Retention table — phase 2 (proposed; all periods need lawyer and business sign-off)

| Data | Retention | Trigger for deletion | Basis for period |
|---|---|---|---|
| Account, profile, answers, results, AI texts | Active account; delete within 30 days of withdrawal or deletion request; delete after 24 months inactivity | Withdrawal, request, inactivity | Law Art. 3, 4(7) |
| Guardian details | Active account, then as consent record | Account end | Law Art. 4(7) |
| Consent records | 5 years after account end | Time | Evidence needs; Law Art. 18 uses 3 years for marketing consent (by analogy); limitation period [LAWYER] |
| Usage analytics | 12 months (pseudonymous) | Time | Law Art. 3(4) |
| Error logs | 90 days | Time | Law Art. 3(4) |
| OTP codes / delivery logs | 5 minutes / 30 days | Time | Minimisation |
| Backups | 35 days rolling | Time | Operational |
| Support messages | 24 months | Time | — |
| Breach register | 5 years [LAWYER] | Time | Law Art. 7 |
| Guardian consent expiry | 24 months, then re-confirm | Time | ER Art. 15 (scope and duration, reported) |

---

## 5. Processors, locations and transfer status — phase 2

| Vendor | Role | Data | Location | Transfer step needed | Status |
|---|---|---|---|---|---|
| OVH (VPS) | Processor | All stored data | Europe [country TBC] | PDPC cross-border license/permit; consent | [to do] |
| Supabase (self-hosted, OVH) | Software only | — | OVH | None additional | — |
| Anthropic (Claude API) | Processor | Scores and labels only | USA | License/permit; DPA; no-training confirmation | [to do] |
| Meta WhatsApp Business (or BSP) | Processor / service | Phone numbers, message content | Global [TBC] | License/permit; check Meta role | [to do] |
| PostHog | Processor | Pseudonymous events | [TBC: self-host vs cloud] | Depends; prefer self-host on OVH | [to decide] |
| Sentry | Processor | Error logs, scrubbed | [TBC] | Depends; scrub PII | [to decide] |

---

## 6. Sources and verification status

**Primary / near-primary (English translation of the law, read in full):**
- Law No. 151 of 2020 (English translation, Andersen Egypt) — https://eg.andersen.com/wp-content/uploads/2025/06/Law-No.-151-OF-2020.pdf — article numbers and fine amounts above come from this text. **Unofficial translation; verify against the Arabic Official Gazette text (Gazette No. 28 bis, 15 July 2020).**
- Civil Code (Law 131 of 1948), English translation, Arts. 44-46 — https://eg.andersen.com/wp-content/uploads/2025/07/Law-no-131-of-1948.pdf — **verified**: majority 21 full Gregorian years (Art. 44); under 7 lacks discernment (Art. 45); discernment but not majority = diminished capacity (Art. 46).
- Child Law No. 12 of 1996 as amended by Law 126 of 2008 (NCCM English text) — https://www.ecoi.net/en/file/local/1421098/1930_1515492448_5a4cb6064.pdf — **verified**: child = person who has not reached 18 complete calendar years; age proved by birth certificate/ID; best interests primary consideration. The definition appears as "Article 3" in this translation (some commentators cite it as Art. 2; confirm numbering).

**Secondary (law-firm summaries of the Executive Regulations):**
- Baker McKenzie, Jan 2026 — https://www.bakermckenzie.com/-/media/files/insight/publications/2026/01/egypt--important-data-protection-update.pdf — read in full: Decision 816/2025; formal publication 1 Nov 2025, public release 25 Dec 2025; grace period to 1 Nov 2026; children: under-15 explicit written guardian consent, 15-18 child or guardian, Center-approved consent mechanisms, no more data than needed and no profiling, tracking or behavioral monitoring of children in games/contests/activities; cross-border license plus consent; DPO rules; breach timelines; AI training principles; license tiers (up to EGP 666,666/yr; 100,000 records exempt from fees).
- Baker McKenzie, Oct 2026 update — https://www.bakermckenzie.com/en/insight/publications/2026/10/egypt-personal-data-protection-law-update — grace period expires 31 Oct 2026; PDPC portal launched; foreign entities need local representative with Egyptian credentials (read via automated summary).
- Consortio Law Firm, ER summary — https://consortiolawfirm.com/egypt-data-protection-law-executive-regulations-2025-english/ — source of the ER article numbers (Arts. 2, 3, 5, 7-12, 14, 15, 16, 19, 28, 31) and Gazette No. 244 supplement A detail (automated summary; **numbers unverified**).
- Chambers, "A First Look" — https://chambers.com/articles/a-first-look-at-egypt-s-personal-data-protection-executive-regulations — corroborates ER Arts. 14, 15, 16, 19, 27, 28, 31 (automated summary).
- Tamimi, "From policy to practice" — https://www.tamimi.com/news/from-policy-to-practice-egypt-issues-executive-regulations-of-the-personal-data-protection-law (search snippet only; page returned a redirect).
- Digital Policy Alert, PDPC Data Subject Consent Guidelines v1.1 (26 Jan 2026) — https://digitalpolicyalert.org/change/18131-data-subject-consent-guidelines (metadata only; guideline text **not read**).
- PDPC portal — https://portal.pdpc.gov.eg/home (not opened).
- Ahram Online, 15 Jan 2015: cabinet approved lowering age of majority to 18 but was not enacted at the time — https://english.ahram.org.eg/News/120441.aspx (no evidence found that it was ever enacted; **unconfirmed**).
- Legal 500 cross-border guide (search result only; reports no PDPC adequacy list published as of 10 Sept 2026) — https://www.legal500.com/guides/hot-topic/strategic-challenges-and-opportunities-in-cross-border-data-transfers-under-egypts-personal-data-protection-regime/

### Could not confirm
1. Official **Arabic text** of the Executive Regulations; all ER article numbers and quoted rules are from secondary summaries.
2. Exact ER wording on children aged 15-18 ("mechanisms set by the Center") and whether any **approved consent mechanism** exists yet.
3. Whether a **license is required below 100,000 records**, or only the fee is waived.
4. Whether the PDPC **adequacy list** exists as of today.
5. Whether the **Civil Code age of majority (21)** was lowered to 18 after 2015; and how it interacts with the PDPL's reference to "child".
6. Content of the PDPC consent and principles **guidelines** (not opened).
7. Egyptian rules on **psychological testing/practice**, consumer protection and e-signature (not researched).
8. Exact **grace period end date** (31 Oct vs 1 Nov 2026).
9. Anthropic, Meta, OVH, PostHog and Sentry **contract terms** (not checked in this ticket).
10. Child helpline number **16000** (from memory, not verified).

---

## 7. Engineering and product to-dos that follow from this map

### Phase 1
1. App: no network calls that carry personal data except parent phone verification; verify with a network audit before launch.
2. Encrypt all on-device data (profile, answers, results, parent details).
3. Age question (under 15 turned away); adult acceptance; parent flow for 15–17 (SMS code, national ID check on the device, declaration, PIN), per consent-texts 1.1–1.3.
4. Phone-verification service: send code via [Egyptian SMS provider], keep only a code hash for 10 minutes and a one-way phone hash ≤ 24 h for rate limits; never store the number.
5. *Delete all my data* (parent PIN for 15–17).
6. Backup file (passphrase) and transfer code (end-to-end encrypted relay, ≤ 10 min).
7. Opt-in anonymous statistics, event code, research opt-in (adults at sessions), upload endpoint storing no IP or device identifier.
8. Content and stats servers: no IP address storage (or ≤ 7 days).

### Phase 2 (server design)

1. Consent gate server-side: no assessment endpoint works without an active consent record.
2. Separate **consent store** (append-only, hashed, time-stamped, policy and text version) and a deletion job honoring the retention table.
3. Pre-consent minimisation: remove governorate/school from onboarding; teaser stores nothing.
4. Analytics: off until consent (and optional checkbox); no session replay; no ad SDKs; scrub PII in Sentry.
5. AI call: strip identifiers; log only hashes; confirm vendor retention/no-training.
6. Parent view API returns summary DTO only (no answer endpoints reachable by parent role).
7. Rights portal: access/export, correct, delete, withdraw; SLA of 6 working days with ticket log.
8. Breach runbook with 72h clock; templates for Center and families.
9. WhatsApp templates: transactional only; opt-out text; no marketing.
10. Register (section 3) kept in repo; DPO signs off on changes.
