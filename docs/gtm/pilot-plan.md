# anaBokra School Pilot Plan (MX-09)

Closed beta, free · 3–5 private schools (Cairo/Alexandria) · grades 10–11 · up to about 300 students in total, set by tablet capacity (section 6) · November to mid-December 2026
Cohort reports by 31 December 2026 · Public launch: 16 January 2027.

> Dates assume a Sunday-to-Thursday school week. Sessions end in mid-December so the pilot avoids first-term exams (usually from around the second week of January) and leaves about four weeks for fixes before launch. Each school's calendar overrides this plan (see Assumptions).

## 1. Goals

| Goal | Why |
|---|---|
| Learn whether students finish and value the experience | Product feedback and fixes before the 16 January launch |
| Collect testimonials and a case study from willing schools | Launch credibility |
| Gather pilot data on the Arabic assessment | Reliability (internal consistency per scale) and preliminary norms. The assessment is **being validated** in this pilot; nothing is claimed as validated yet |
| Test the school delivery model (tablet visits + counselor + cohort report) | Shape the school offer and pricing |

## 2. How data is handled in phase 1

The pilot runs **local-first** on tablets that anaBokra brings. No student uses their own phone, and no personal data goes to a server.

| What | Where it lives | Who can link it to a child |
|---|---|---|
| Student ID ↔ name list | At the school only | The school |
| Answers, results, roadmap, readiness, feedback | On one anaBokra tablet per student, opened with the student's ID + PIN | Nobody at anaBokra (ID only, no names on the tablet) |
| Anonymous answer sets (research consent only) | Uploaded once after the student's last sitting: no ID, no pairing key, tagged only with school code, grade and language | Nobody |
| Readiness before/after (research consent only) | Uploaded with a random pairing key so the two measurements can be matched. The key is never on the answer sets | Only while the tablet still holds the key (until wipe) |
| Totals (consented, started, completed, ratings, top matches) | Uploaded per school and grade | Nobody |

- **No AI** in phase 1. Result explanations come from the engine's reasons and watch-outs.
- **No national ID, phone number, email, date of birth or name** is collected by anaBokra.
- Tablets are encrypted and run the app in kiosk mode.
- **Withdrawal:** a withdrawn student's data is deleted from the tablet within **31 days after the school visit** at which anaBokra receives the withdrawal.
- **All tablets are wiped by 31 December 2026**, after cards are printed and make-ups are done.
- **Anonymous answer sets** are kept until the psychologist's analysis is done, and **at most 6 months after the data freeze (17 June 2027)**. Aggregate results (reliability, norms tables) are kept, since they describe no one.
- Results go home as a **printed results card** (ID only, no name). There is no parent link or online account.
- Data on anaBokra's tablets is still data that anaBokra holds, so the lawyer review in section 3 applies. Nothing leaves Egypt.

## 3. Pre-pilot (now to 31 October)

| Task | Owner | Done by |
|---|---|---|
| Outreach to 10–15 private schools to land 3–5 (see `outreach-templates.md`). Founder's connections first | Founder | 31 Oct |
| **Lawyer brief and sign-off**: consent form, pilot agreement, whether the uploads count as anonymous, the paired readiness data, the 31-day withdrawal period, anaBokra's obligations for data held on its tablets (incl. PDPC license question) | Founder + lawyer | 25 Oct |
| Pilot agreement signed with each school (scope, data promises, report, testimonial permission) | Founder + principal | 31 Oct |
| Tablet kit: currently 6 tablets, charging case, encryption, kiosk mode, remote wipe, offline printer setup. More tablets only raise capacity (section 6) | anaBokra | 31 Oct |
| Pilot build ready on tablets (see `docs/product/world-spec.md`, section 6) | anaBokra | 31 Oct |

**Gate:** no consent form goes home and no session runs until the lawyer has signed off. If sign-off slips, the timeline shifts with it.

Selection criteria: an engaged counselor, a principal who signs off, a quiet room, enough free periods on visit days, grades 10–11 classes with consenting students, both cities if possible. Public schools are deferred to a later round, because they may need Ministry of Education district (and possibly CAPMAS) approval.

## 4. Week-by-week timeline

| Week | Dates | Milestone | Owner |
|---|---|---|---|
| W1 | 1–5 Nov | Kickoff call. Confirm grade 10–11 classes, student counts, **visit days and free periods per visit**. anaBokra works out the number of visits and the student cap for the school (section 6). **Counselor walkthrough** (60 min). Consent forms go home (paper) with a parent message from the principal. | anaBokra + school lead |
| W2 | 8–12 Nov | Consent reminders. Tablet dry run with 5–10 staff or volunteers. | Counselor; anaBokra |
| W3 | 15–19 Nov | **Consent deadline** (end of week). anaBokra gives the school a sheet of random student IDs + PINs. The school assigns them to consenting students, keeps the ID ↔ name list, and returns to anaBokra only **ID, grade and the optional choices** (no names). anaBokra **registers each ID for its visits** (section 6), sends the school a roster per visit, and prints ID slips (ID, PIN, tablet number, visit dates). | Counselor; anaBokra |
| W4–W6 | 22 Nov–10 Dec | **Sitting visits.** Each student does **sitting 1** (parts 1–2 + baseline readiness) on one visit and **sitting 2** (parts 3–4) on a later visit, on the same tablet. At the end of sitting 2 they see their results and rate them ("clear and useful"). anaBokra prints that visit's results cards. Absentees move to the school's make-up visit. | Both |
| W6–W7 | by 17 Dec | **Results session** led by the counselor (one class period) once a class has finished, with the printed cards, which students take home. Counselor gets a copy of a card only where the parent ticked that box. | Counselor; anaBokra supports |
| W7 | 13–17 Dec | **Follow-up visit**: follow-up readiness check + short feedback survey on the tablets. Counselor feedback interview (20 min). Testimonial request. **Uploads complete; data frozen 17 Dec.** | Both |
| Wrap | by 31 Dec | **Tablets wiped 31 Dec.** **Cohort insight report delivered.** Debrief call offered in the first week of January (before exams). | anaBokra |

If a school starts late, its visits shift by up to one week. Anything later moves to a second round after the mid-year break.

## 5. Roles

| | School counselor / coordinator | anaBokra |
|---|---|---|
| Before | Names a lead. Confirms classes, visit days, free periods and room. Distributes and collects consent forms. Assigns IDs and keeps the ID ↔ name list. | Provides one-pager, consent form, parent message, counselor guide, ID + PIN sheet. Registers students for visits and sends the rosters. Prepares the tablets. |
| During visits | Sends each roster group to the room at its period, supervises, makes sure only registered students take part, hands out ID slips, handles attendance. | Brings the tablets, runs every visit, fixes technical issues, rebooks absentees onto the make-up visit. |
| After results | Leads the results session with the printed cards. Flags any distressed student to the school's named escalation contact (section 7). | Prints the cards, trains the counselor, provides talking points, delivers the cohort report. |
| Data | Keeps the signed consent forms and the ID ↔ name list. Passes withdrawals to anaBokra by ID. Never receives individual results unless the parent opted in. | Holds only IDs. Deletes a withdrawn student's data within 31 days after the visit at which the withdrawal is received. Produces the anonymized report. Wipes the tablets by 31 Dec. |
| Principal | Sign-off, communication to parents, permission for testimonial. | Agreement, report debrief. |

## 6. Visits and registration

The plan works with any number of tablets. **The tablet count only sets how many students fit in a visit**, and so how many visits a school needs.

**Registration.** Each visit has its own **roster of registered students**. When the school returns the ID list (W3), anaBokra books every student into:
- a **sitting 1** slot on one visit, and a **sitting 2** slot on a later visit, on the **same tablet** (the tablet holding their profile);
- a place in the **follow-up visit** (W7).

A slot is one tablet for one class period. Before each visit, anaBokra loads that visit's roster, and the tablets only open profiles registered for it.

**Capacity per school:**

- Slots per visit = tablets × free periods that day.
- Each student needs 2 sitting slots. The follow-up takes about 10 minutes, so about 4 students share one tablet per period.
- Visits needed ≈ (2 × students ÷ slots per visit) + 1 make-up visit + 1 follow-up visit.

**Capacity across the pilot:** there are **20 school days** between 22 Nov and 17 Dec. With one anaBokra team, there is one visit per day across all schools. At kickoff anaBokra adds up the visits for all schools. If they don't fit in 20 days, it either caps students per school or adds tablets, and tells each school its cap before consent forms go home.

| Tablets | Free periods per visit | Slots per visit | Students that fit (5 schools) | Students that fit (3 schools) |
|---|---|---|---|---|
| 6 | 6 | 36 | about 180 | about 250 |
| 12 | 6 | 72 | about 300+ | about 300+ |

*Example: 6 tablets, 6 free periods, 40 students → 3 sitting visits (80 slots ÷ 36) + 1 make-up + 1 follow-up = 5 visits.*

**Logistics:**

- **Format:** the assessment has 4 parts of 10–12 minutes. They run as **2 sittings** of about 25 minutes, each inside one 45-minute period with a short intro and wrap-up.
- **Same tablet every time:** a tablet holds several students' profiles, each opened with ID + PIN. If a tablet fails, its students move to another tablet on a later visit and redo the unfinished parts.
- **Before each visit:** tablets charged, kiosk mode on, roster loaded, ID slips sorted by period.
- **Uploads:** at the end of each visit, over anaBokra's own mobile hotspot.
- **Printing:** results cards are printed from the tablets on anaBokra's offline printer after each visit. No copies are kept after printing.
- **Room setup:** quiet room, counselor present, an anaBokra team member at every visit. Short script: "this is not an exam, no right answers, not graded, you may skip any question."
- **Absences:** absentees are rebooked onto the make-up visit. Students who still have not finished keep a partial result; their card says so.
- **Language:** all student-facing text in Arabic and English, Arabic by default. The Arabic version is the one being validated, so answers given in English are reported but excluded from the Arabic reliability and norms analysis.

## 7. Student wellbeing

- Results are framed as guidance, not diagnosis.
- **Each school names an escalation contact** for any distressed student before its first visit. The founder has confirmed this will be in place.
- **anaBokra gives each counselor a verified helpline number** in the counselor guide: [helpline number, verified by the founder]. The founder has confirmed it will be provided.

## 8. Success metrics

| Metric | Target | How measured |
|---|---|---|
| Completion | **At least 70%** of registered students finish all 4 parts | Totals uploaded from the tablets |
| Results rating | **At least 4 out of 5** average on "my results were clear and useful" | On the tablet, right after results (sitting 2) |
| Readiness change | Positive average change in career-decision readiness from baseline (sitting 1) to follow-up (W7). Exact size target set after baseline | The 6-item readiness check (`readiness.json`, draft for the psychologist), 1–5 scale, paired by random key, research-consented students only |
| Counselor satisfaction | At least 4 out of 5 on usefulness, plus a qualitative interview | Survey + interview (W7) |
| School willingness | At least 60% of pilot schools willing to give a testimonial or continue as a partner | Direct ask in W7 |
| Data for validation | As many complete Arabic answer sets with research consent as capacity allows; at least [150] for reliability estimates | Upload count; analysis by the psychologist. Results are preliminary and described as such |

The readiness follow-up comes only one to three weeks after results, so the report describes the change as short-term. Report negative results honestly in the cohort report and internally.

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Lawyer sign-off late | Brief the lawyer now with a narrow scope (section 3). The pilot shifts rather than starting without sign-off. |
| Not enough tablet capacity | Visit-based registration with a per-school cap set at kickoff (section 6). Add tablets to raise the cap. |
| Schools slow to approve or reply | Start outreach now. Use founder's connections. Keep the ask small. Have 10–15 prospects. |
| Low parental consent rate | Parent message from the principal. Short plain-language form. Two weeks to return it. One reminder. Do not pressure students. |
| Exam periods or school events | Confirm the calendar and visit days at kickoff. Finish by mid-December. One make-up visit per school. |
| Tablet lost or stolen | No names on tablets, ID + PIN per profile, device encryption, remote wipe. Count tablets in and out at every visit. |
| Tablet failure or flat battery | Charging case, charge the night before. Students on a failed tablet are rebooked on another tablet and redo only the unfinished parts. |
| Low completion in sitting 2 | Two sittings instead of four, a make-up visit, counselor reminder. |
| Re-identification from uploads | Answer sets carry no ID or key and are uploaded in shuffled batches. Small-group suppression in the report. No gender in uploads. |
| Students misread results as a verdict | Guidance-not-diagnosis framing on the tablet, on the printed card, in counselor training and in the results session. |
| Small samples limit validation | Present as preliminary. Pool data across schools. No validation claims until analysis is done. |
| Solo founder capacity | One visit per day. Psychologist as backup for one day a week. |
| Counselor overload | Counselor tasks limited to consent, the ID list, sending groups to the room and one results session. anaBokra does the rest. |

## 10. Assumptions the founder must confirm

1. School calendars: confirm the visit days avoid exams, trips and holidays in each school.
2. Free periods per visit day in each school (the capacity table assumes 6).
3. Final readiness items (psychologist) and the validation target ([150] answer sets).
4. Whether gender is asked on the tablet (it is only used for Arabic grammar and is never uploaded).
5. The helpline number for the counselor guide.
