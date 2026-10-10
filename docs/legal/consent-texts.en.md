> **DRAFT — not legal advice — must be reviewed by Egyptian counsel before use.**
>
> [Square brackets] = placeholders. **[LAWYER]** = open legal question (see `lawyer-brief.md`).
>
> This version covers **phase 1**: the phone app (data kept on the device) and the school pilot (anaBokra tablets). The phase 2 consent routes (WhatsApp invite to the parent, family account, school upload) are not in use; their texts are in git history.

# anaBokra Consent Texts (phase 1)

**Text version:** consent-0.2-draft

**Design rules for all screens** (for Product/Engineering)
- All checkboxes are **unticked by default**. Required boxes must all be ticked to continue. Optional boxes never block anything (PDPL Art. 12: participation must not depend on data beyond what is necessary).
- Each screen links to the Privacy Policy, the Children's Data Notice and the Terms of Use, in the language the user chose (Arabic by default).
- **Phone app:** the confirmation is stored **on the device only**: that it was given, the date and time, the text version and the policy version. Nothing is sent to anaBokra.
- **School pilot:** the signed paper forms stay at the school. anaBokra receives only the student ID, grade and the optional choices.

---

## 1. Phone app — first start

### 1.1 Age question
**Title:** Before we start
"How old are you?"
( ) Under 15 ( ) 15 ( ) 16 ( ) 17 ( ) 18 or older

- **Under 15:** "anaBokra is made for people aged 15 and over. You can look at the career library, but the questions aren't open to you yet." The app saves nothing. **[LAWYER: confirm minimum age and this behaviour.]**
- **15 to 17:** go to 1.2.
- **18 or older:** go to 1.3.

### 1.2 Parent or guardian confirmation (under 18)
**Screen 1 (to the teen):** "Please hand this phone to your parent or guardian. They need to say yes before you start."

**Screen 2 (to the parent or guardian):**
**Title:** Your permission for your child to use anaBokra

**In short** (always visible, before the checkboxes)
- anaBokra helps your child explore careers. They answer questions about their interests, personality, work values and abilities, and get career suggestions and study routes in Egypt.
- **Everything stays on this device.** Answers, results and profile are not sent to anaBokra or anyone else. No account, no phone number, no AI.
- Anyone who can open the app on this device can see the results.
- Results are guidance, **not a diagnosis**, and are not used for any grade or admission.
- You or your child can delete everything at any time from *Settings → Delete all my data*.
- Full details: [Privacy Policy] · [Children's Data Notice] · [Terms of Use]

**Please tick to confirm** (all required)
- [ ] **1. Guardian.** I am this young person's parent or legal guardian, and I am 18 or older.
- [ ] **2. Permission.** I agree that my child uses anaBokra on this device, and that their answers and results are saved on this device only.
- [ ] **3. Terms.** I have read the Terms of Use and the Privacy Policy (version {{policy_version}}) and accept them on my child's behalf.

**Buttons:** [ I agree ] [ Not now ]

- "Not now": "No problem. Nothing has been saved. You can come back to this any time."
- After "I agree": "Thank you. Please hand the phone back to your child." The device stores: confirmed = true, {{date_time}}, consent text version, policy version.

**[LAWYER: (a) whether this on-device confirmation is needed or sufficient when anaBokra does not process the data; (b) whether a guardian's tick counts as written consent; (c) whether we should also ask the guardian's name (kept on the device only).]**

### 1.3 Adults (18 or older)
**Title:** Before you start
- anaBokra keeps your answers and results **on this device only**. Nothing is sent to us.
- Results are guidance, not a diagnosis.

- [ ] I am 18 or older and I accept the [Terms of Use] and have read the [Privacy Policy] (version {{policy_version}}).

**Button:** [ Start ]

### 1.4 Delete all my data
*(Settings → Delete all my data)*
**Title:** Delete everything?
"This removes your profile, answers, results, islands and points from this device. It can't be undone, and anaBokra can't recover them, because we never had them."
**Buttons:** [ Delete everything ] [ Cancel ]
After deleting: the app returns to the first-start screen (1.1). For under-18s, a parent must confirm again before anything is saved.

---

## 2. School pilot

### 2.1 Parent or guardian consent form
The form that goes home with each student is in `docs/gtm/school-consent-form.en.md` (Arabic: `school-consent-form.ar.md`). It has one required consent and two optional choices:
1. **Required:** participation and the data described.
2. **Optional:** research use of answers without any ID, and linking the before/after readiness answers by a random code.
3. **Optional:** a copy of the results card for the school counselor.

### 2.2 School declaration
*(Signed by the principal before consent forms go home. Part of the pilot agreement.)*

**School:** [name] · **Governorate:** [__] · **Registration:** [__] · **Authorized representative:** [name, title]

By signing, the school confirms that:
1. It wishes to offer the anaBokra career guidance pilot to students in grades 10 and 11 between [start date] and [end date].
2. It will give each parent the anaBokra consent form, collect the signed forms, and **keep them at the school**. Only students whose parent signed the required consent will take part.
3. It will give each consenting student one of the random student IDs and PINs prepared by anaBokra, and keep the list matching IDs to names **at the school only**. It will give anaBokra only each student's ID, grade and the parent's optional choices, never names.
4. Students are not forced to take part, and declining has no effect on their school standing.
5. It will tell anaBokra, by student ID, as soon as a parent withdraws consent or a student leaves.
6. It names [staff member] as the contact for any student who is upset during or after the pilot.
7. It understands that it receives only an anonymized group report, and a copy of a student's results card only where the parent ticked that box.
8. [Roles of the school and anaBokra regarding student data — **LAWYER: separate controllers, joint controllers, or school as controller and anaBokra as processor?**]
9. The signatory has authority to sign for the school.

Signature · Name · Title · Date · Stamp

### 2.3 Student agreement
*(Read aloud by the counselor at the start of the first sitting. Each student also confirms on the tablet.)*
"This is guidance, not an exam. There are no right or wrong answers, and it has nothing to do with your grades. You can skip any question or stop at any time. Your name is not on the tablet; only your ID."
- [ ] I understand and I am happy to take part.

If a student does not tick the box, their profile stays closed and the counselor offers them another activity.

### 2.4 Withdrawal
**From the school to anaBokra** (email or WhatsApp to [privacy@anabokra.example]):
"Consent for student ID {{student_id}} at {{school}} was withdrawn on {{date}}."

**anaBokra's confirmation to the school:**
"We received the withdrawal for student ID {{student_id}} on {{date}}. We stopped using this student's data straight away. It will be deleted from the tablet by {{deletion_date}} (within 31 days after our school visit on {{visit_date}}, and no later than 31 December 2026). Anonymous data already sent cannot be traced back to the student, so it cannot be removed. Reference: {{reference}}."

**[LAWYER: compare the 31-day deletion period with the 6-working-day response period in PDPL Art. 32.]**

### 2.5 When a student asks to stop
The student may stop at any time during a sitting; the counselor or the anaBokra team member closes their profile. If the student asks for their data to be deleted, the anaBokra team deletes the profile from the tablet at that visit and tells the school by ID.
