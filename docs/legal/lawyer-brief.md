# Brief for Counsel: anaBokra Phase 1

**From:** [Founder name], [anaBokra legal entity name] · [email] · [phone]
**Date:** 10 October 2026
**What we need:** sign-off on the school pilot documents and answers to questions P1–P10 by **25 October 2026**; answers to L1–L5 by **15 December 2026**.

## 1. About anaBokra

anaBokra is an Egyptian career guidance app for secondary students. Students answer questionnaires about their interests (O\*NET Interest Profiler), personality (IPIP Big Five), work values and abilities. The app suggests career groups and careers, and lets them explore study routes in Egypt. Results are presented as guidance, not as a diagnosis.

We have redesigned the first phase so that **personal data stays on the device**, to limit processing until we hold the licenses needed for a server-based service (phase 2).

| Date | Event |
|---|---|
| By 31 Oct 2026 | Pilot agreements signed with 3–5 private schools in Cairo and Alexandria |
| 1–19 Nov 2026 | Consent forms go home and come back; IDs assigned |
| 22 Nov – 17 Dec 2026 | Student sittings at the schools (grades 10–11, up to about 300 students) |
| 31 Dec 2026 | All tablets wiped; anonymized reports delivered to schools |
| 16 Jan 2027 | Public launch of the phone app |

**No consent form goes to parents and no student session runs until you have signed off.**

## 2. How phase 1 works

### 2.1 School pilot (Nov–Dec 2026)

- Students use **tablets owned by anaBokra**, brought to the school on visit days. Tablets are encrypted, locked to the app (kiosk mode), and can be wiped remotely.
- anaBokra prepares random **student IDs and PINs**. The school assigns them to students whose parents signed the consent form, and keeps the **ID ↔ name list and the signed forms at the school**. anaBokra receives only each student's ID, grade and the parent's optional choices. **anaBokra never receives names.**
- On the tablet, under the ID only: grade, secondary track, language, optional gender (used only for Arabic grammar), questionnaire answers, scores, career matches, choices in the app, a short readiness check before and after, and feedback surveys.
- Results go home as a **printed card** (ID only). The school receives an **anonymized group report**; the counselor receives a copy of a student's card only if the parent ticked that box.
- **What leaves the tablets:**
  1. totals per school and grade (no individual data);
  2. with the parent's optional research consent, **answer sets with no ID** (tagged with school code, grade and language);
  3. with the same consent, **readiness answers before and after linked by a random key** (not the student ID). This is pseudonymous.
- **Retention:** tablets wiped by 31 Dec 2026; a withdrawn student's data deleted within 31 days after the school visit at which we receive the withdrawal; research data deleted once the analysis is finished, no later than 17 Jun 2027.
- **Not used:** AI, WhatsApp, accounts, analytics, any transfer of personal data abroad. The upload server's location is still to be decided (section 4, P6).

### 2.2 Phone app (from 16 Jan 2027)

- No account, no phone number, no email, no AI.
- Profile, answers, scoring, results and progress are stored and computed **on the user's device**. anaBokra does not receive them.
- The app downloads content (questions, careers, study routes) from our server, which receives standard technical request data (IP address, browser type).
- Users under 18 must hand the device to a parent or guardian, who confirms on the device before anything is saved. **Nothing is uploaded for users under 18.**
- Users can delete everything on the device at any time.

## 3. Documents for review

In priority order. Arabic versions are included where marked.

| # | Document | Needed by |
|---|---|---|
| 1 | Parent/guardian consent form for the pilot (EN, AR): `school-consent-form.en.md`, `school-consent-form.ar.md` | 25 Oct |
| 2 | School pilot agreement (EN; AR to follow after your comments): `pilot-agreement.en.md` | 25 Oct |
| 3 | Consent texts, section 2 (school declaration, student agreement, withdrawal messages) (EN, AR): `consent-texts.en.md` | 25 Oct |
| 4 | Privacy policy, section 6 (school pilot) (EN, AR): `privacy-policy.en.md` | 25 Oct |
| 5 | Consent texts, section 1 (phone app screens) | 15 Dec |
| 6 | Privacy policy (rest), terms of use, children's data notice (EN, AR) | 15 Dec |
| — | Background: our compliance map (section 0b covers phase 1). Its article numbers for the Executive Regulations come from law-firm summaries; we could not verify them against the official Arabic text | — |

## 4. Questions

### Before 25 October (school pilot)

**P1. License.** Given the pilot design in 2.1, does anaBokra need a PDPC controller license, or a permit for sensitive data, before the first school visit on 22 November? If so, may the pilot start while the application is under review? Does the fee exemption up to 100,000 records also exempt us from the license itself?

**P2. Roles.** For the pilot, are the school and anaBokra separate controllers, joint controllers, or is the school the controller and anaBokra its processor? What must the pilot agreement say as a result?

**P3. Consent.**
- Is the paper form valid **explicit written consent** under Art. 12 for sensitive (psychological) data of students aged 15–17?
- We ask for guardian consent for everyone under 18, even though the Executive Regulations reportedly allow 15–18-year-olds or their guardian to consent. Is that right?
- Is it enough that the signed forms stay at the school?

**P4. Anonymous and linked data.**
- Are the answer sets with no ID or key (school code, grade, language) anonymous, and so outside the PDPL, given cohorts of 50–100 students per school?
- The readiness data linked by a random key is pseudonymous. What obligations follow from that, and is keeping it until 17 Jun 2027 acceptable?

**P5. Withdrawal.** Our forms say a withdrawn student's data is deleted within 31 days after the school visit at which we receive the request. Does this conflict with the 6-working-day response period in Art. 32? What wording do you recommend?

**P6. Hosting.** Must the server that receives the uploads in 2.1 be in Egypt? If it is abroad, do anonymous uploads or the linked readiness data count as a cross-border transfer?

**P7. Lost tablet.** If a tablet holding pseudonymous pilot data is lost, is that a notifiable breach (Art. 7)? What should our runbook say?

**P8. School approvals.** Does a private school need Ministry of Education or district permission to run this activity in class? Do the questionnaires need CAPMAS approval?

**P9. Psychological questionnaires.** Do any Egyptian rules on psychological practice or testing apply to offering interest and personality questionnaires to minors with "guidance, not diagnosis" framing? Please review the disclaimers in the terms of use (section 2) and the consent form (section 1).

**P10. Quotes.** May we use anonymous student quotes in reports and marketing with the parent's consent? Should that be a separate tick box on the form?

### Before 15 December (phone launch)

**L1. Phone mode.** Does the PDPL apply to anaBokra at all when personal data never leaves the user's device? Is the on-device guardian confirmation (consent texts 1.2) needed, sufficient, or should it be different? Should it record the guardian's name on the device?

**L2. Age.** Is 15 the right minimum age? How should we treat ages 18–20, given that the Civil Code puts full capacity at 21? Can a 15–17-year-old accept the terms of use, or only the guardian?

**L3. Technical data.** When the app downloads content, our server receives IP addresses. If we do not store them, or keep them for no more than 7 days, is anything further required? Does a content server outside Egypt matter?

**L4. Consumer and e-signature law.** Is a checkbox on the device a valid acceptance by the guardian? Is anything required under the Consumer Protection Law for a free app?

**L5. Formalities.** For phase 1, do we need to appoint and register a DPO, or keep a formal processing register?

### Not for now (phase 2)

Accounts, WhatsApp sign-in, an AI vendor, storage in Europe, and parent and school accounts are planned for phase 2. They are covered in our compliance map, sections 1–5. We will come back to you with them once phase 1 is settled.

## 5. What we have already done to reduce risk

- No names, national ID numbers, dates of birth, phone numbers or school grades are collected in the pilot.
- The ID ↔ name list and the consent forms never leave the school.
- No AI, no analytics, no advertising and no marketing.
- No transfer of personal data abroad is planned for phase 1.
- Nothing is saved before consent. Nothing is uploaded for under-18s on the phone app.
- Short, fixed retention periods, with all tablets wiped by 31 December 2026.
- Public schools are deferred to a later round.
