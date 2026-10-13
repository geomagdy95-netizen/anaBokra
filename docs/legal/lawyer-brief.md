# Brief for Counsel: anaBokra Phase 1

**From:** [Founder name], [anaBokra legal entity name] · [email] · [phone]
**Date:** 11 October 2026 (replaces the earlier briefs of 10 and 11 October)
**What we need:** sign-off on the pilot documents and answers to P1–P9 by **25 October 2026**; answers to L1–L5 by **15 December 2026**.

> **Status, 13 October 2026: counsel agreed. The pilot blocker is closed.** As reported by the founder, counsel agreed to phase 1. On the same day the design was simplified further, so even less reaches anaBokra:
> - no parent step for 15–17, so no SMS code, no national ID and no parent PIN (15–17 accept for themselves);
> - no transfer code through our server (moving phones uses the backup file only);
> - no accounts; a local nickname and an optional app password, both on the phone.
>
> Nothing personal reaches anaBokra's servers. Only opt-in anonymous statistics and opt-in research data at university sessions do, as before. Section 2 describes this final design. The questions in section 4 are kept for the record; those about the parent flow, SMS and the relay no longer apply. **Please file counsel's written confirmation here when it arrives.** P10 (the O\*NET licence) is separate from data protection; confirm it was covered.

## 1. About anaBokra

anaBokra is an Egyptian career guidance app. Users answer questionnaires about their interests (O\*NET Interest Profiler), personality (IPIP Big Five), work values and abilities. The app suggests career groups and careers and shows the routes into them in Egypt. Results are presented as guidance, not a diagnosis.

**Audience:** students and graduates aged 18–25, and **15–17-year-olds, who accept for themselves** (no parent step since 13 Oct 2026). Under-15s are turned away.

**Our aim is to stay outside the licensing regime if the law allows it, without pretending it does.** Personal data therefore stays **on the user's phone, encrypted**. We know encryption alone does not take data outside the law; we want your view on whether this design, as a whole, does.

| Date | Event |
|---|---|
| By 31 Oct 2026 | Partner agreements with 3–5 university career centres or student clubs (Cairo, Alexandria) |
| 15 Nov – 10 Dec 2026 | Pilot sessions at universities (adults); about 300 participants |
| 31 Dec 2026 | Anonymized partner reports |
| 16 Jan 2027 | Public launch, including 15–17 |

**No pilot session runs until you have signed off.**

## 2. How phase 1 works

### On the phone (never sent to anaBokra)
Everything below is **encrypted on the device**:
- profile (nickname, age band, stage, language, optional gender);
- if the user sets one, salted hashes of an app password and its recovery code (the password locks the app; it is optional and never sent);
- questionnaire answers, scores, results and progress;
- what the user accepted.

Scoring runs on the phone.

### Ages 15–17
No parent step (removed 13 Oct 2026). 15–17-year-olds tick their own acceptance; nothing about them or a parent reaches anaBokra.

### What reaches anaBokra's servers (OVH, [country])
| What | Personal data? | Notes |
|---|---|---|
| Content downloads (questions, careers) | Technical data only (IP address) | IP not stored, or kept ≤ 7 days |
| Anonymous statistics (opt-in, chosen by the user) | Intended to be anonymous | One summary per finished assessment: age band, stage, language, top interest areas and career groups, score bands, completion, optional event code. No ID, device identifier or exact time |
| Research data at university sessions (adults, opt-in) | Answers: intended anonymous; readiness pairs: **pseudonymous** | Kept until analysis is done, ≤ 17 Jun 2027 |

No AI, accounts, analytics, advertising, SMS or relayed data. Moving to a new phone uses a passphrase-protected backup file, which never reaches us.

## 3. Documents for review

| # | Document | Needed by |
|---|---|---|
| 1 | Consent texts (EN, AR): `consent-texts.en.md`, `consent-texts.ar.md`. These cover the age question, acceptance (18+ and 15–17), deletion, moving phones, anonymous statistics, and the university sessions | 25 Oct |
| 2 | Partner agreement (EN; AR after your comments): `partner-agreement.en.md` | 25 Oct |
| 3 | Privacy policy (EN, AR) | 25 Oct |
| 4 | Terms of use and the short data notice (EN, AR) | 25 Oct |
| — | Background: our compliance map, section 0b. Its article numbers for the Executive Regulations come from law-firm summaries; we could not verify them against the official Arabic text | — |

## 4. Questions

### Before 25 October (pilot and design)

**P1. Licence.** Given section 2, does anaBokra need a PDPC controller licence or a sensitive-data permit at all, now or at launch? In particular:
- Is data that stays encrypted on the user's device, and never reaches us, processing by anaBokra?
- Does handling a parent's phone number only to send a code make us a controller of personal data?
- Is briefly relaying encrypted data that we cannot read processing?

**P2. Ages 18–20.** Can users aged 18–20 accept the terms and consent to the opt-ins themselves, given full civil capacity at 21? If not, we will start at 21 for adults.

**P3. Parent consent for 15–17.** *No longer applies: the parent step was removed on 13 Oct 2026.* The Executive Regulations reportedly require consent mechanisms approved by the Center for children.
- Is our mechanism acceptable: an SMS code, the national ID number checked on the device, name, relationship, a declaration, and a PIN?
- Does it need the Center's approval when no data reaches us?
- Must the parent be 21+ (Civil Code) or 18+?

**P4. National ID number.** *No longer applies: no national ID is asked for since 13 Oct 2026.* Is it lawful and proportionate to ask for the parent's national ID number when it is checked and stored only on the device and never reaches us? Would you require it, recommend it, or advise against it?

**P5. OVH without a transfer consent.** *Since 13 Oct 2026 there is no SMS verification and no relay; the parts about them no longer apply.* OVH has no Egyptian data centre. Is it enough that our OVH server holds only:
- content;
- anonymous statistics;
- briefly relayed encrypted data;
- one-way hashes of phone numbers?

Must the parent-phone verification run in Egypt? If any of these counts as a transfer, which exception or permit applies?

**P6. Anonymous and pseudonymous data.**
- Are the statistics summaries anonymous (outside the PDPL), including for 15–17-year-olds?
- Are the research answer sets anonymous, with 60–100 participants per event code?
- What follows for the pseudonymous readiness pairs?

**P7. University partners.** Does a partner have any role under the PDPL when it receives only anonymized reports? Are research or ethics approvals, Ministry of Higher Education or CAPMAS approvals needed for the research opt-in?

**P8. Psychological questionnaires.** Do any Egyptian rules on psychological practice or testing apply to offering interest and personality questionnaires to the public, including minors, with "guidance, not diagnosis" framing?

**P9. Deletion and quotes.**
- Anonymous data can't be deleted on request. Pseudonymous readiness pairs can be, using the code on the phone. Is that enough?
- May we quote participants anonymously with their consent?

**P10. O\*NET licence.** The interest questionnaire uses the 60 items of the O\*NET Interest Profiler Short Form (US Department of Labor, USDOL/ETA). We have modified it: a 1–5 scale instead of a checklist, an Arabic translation, one adapted item, and the items split across 10 short tasks. The O\*NET Tools Developer License appears to require, for modified tools:
- an attribution and modification notice shown to users ("…has modified all or some of this information. USDOL/ETA has not approved, endorsed, or tested these modifications."), on launch screens for a reasonable period and in the README;
- a validation study before the modified tool is introduced.

Does that licence apply to us, or only the general CC BY 4.0 licence of the O\*NET database? Is a pilot with opt-in research data the "introduction", or part of the validation? Where must the notice appear in the app?

### Before 15 December (public launch)

**L1. Acceptance.** Is the single tick (for adults, and for 15–17 since 13 Oct 2026) a valid acceptance of the terms (Consumer Protection Law, e-signature)?

**L2. Technical data.** IP addresses on the content server: is not storing them, or keeping them ≤ 7 days, enough? Does the server's location matter?

**L3. Formalities.** Do we need a DPO or a processing register for phase 1?

**L4. Under 15.** We turn under-15s away at an age question, without verification. Is that enough?

**L5. Breach.** A lost phone exposes only that user's own encrypted data. Do we have any breach duties for it? What applies to our servers' data (hashes, statistics, research data)?

### Later (not for now)
Accounts or server storage, AI explanations, and school pilots with minors. These are covered in our compliance map, sections 1–5.

## 5. What we have already done to reduce risk

- No accounts, names, emails, phone numbers, ID numbers, SMS or AI.
- Answers and results stay on the phone, encrypted.
- Statistics and research data are opt-in and designed to be anonymous; the only pseudonymous data is the opt-in readiness pairs, deleted by 17 June 2027.
- Moving phones uses a passphrase-protected backup file that never reaches us; nothing is relayed through our server.
- Partners receive anonymized group reports only.
- No advertising or marketing.
