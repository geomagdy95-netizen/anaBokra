> **DRAFT — not legal advice — must be reviewed by Egyptian counsel before use.**
>
> Consent mechanisms for children's data must be approved by the Personal Data Protection Center (Executive Regulations, as reported — see `compliance-map.md`). Do not ship these screens until counsel confirms approval status. [Square brackets] = placeholders.

# anaBokra Consent Texts

**Text version:** consent-0.1-draft (stored with every consent record together with the privacy policy version).

**Design rules for all screens** (for Product/Engineering)
- All checkboxes are **unticked by default**. Required boxes must all be ticked to continue. Optional boxes never block anything (PDPL Art. 12: participation must not depend on data beyond what is necessary).
- Show the privacy policy and children's notice by link before the checkboxes; keep each screen in the guardian's chosen language (Arabic or English).
- Record for each consent: route (A/B/C), method (OTP / account / school form), guardian name, relationship, WhatsApp number (hashed copy plus encrypted copy), timestamp (UTC and Cairo), policy version, text version, each checkbox value, IP address [only if counsel approves], teen identifier, consent expiry date, and withdrawal data.
- Consent is valid for [24 months] or until withdrawn; we ask again before it expires.

---

## 1. Route A — WhatsApp invite to the parent
*(Sent from the anaBokra WhatsApp Business number when the teen taps "Ask my parent". Needs a pre-approved WhatsApp template. Transactional only — no marketing.)*

**Template (English):**
> Hello. This is anaBokra, a career guidance platform for teens.
> **{{teen_nickname}}** asked us to contact you. We need your permission, as parent or legal guardian, before {{teen_nickname}} can take our assessments.
> Please read what data we use and decide here: {{consent_link}}
> The link works for 7 days and only for you. You will receive a one-time code to confirm it is you. If you do not know {{teen_nickname}}, or do not want this, just ignore this message. We will not send you any marketing.

**Template (Arabic):**
> مرحبًا. معكم «أنا بكرة»، منصة للإرشاد المهني للمراهقين.
> طلب منا **{{teen_nickname}}** التواصل معكم. نحتاج إلى إذنكم بصفتكم ولي الأمر أو الوصي القانوني قبل أن يجري {{teen_nickname}} التقييمات لدينا.
> يرجى الاطلاع على البيانات التي نستخدمها واتخاذ قراركم من هنا: {{consent_link}}
> الرابط صالح لمدة 7 أيام ولكم وحدكم، وسيصلكم رمز تحقق لمرة واحدة لتأكيد هويتكم. وإذا كنتم لا تعرفون {{teen_nickname}} أو لا ترغبون في ذلك فتجاهلوا هذه الرسالة. لن نرسل لكم أي رسائل تسويقية.

**Reminder (once, after 3 days):** "Reminder: {{teen_nickname}} is waiting for your decision on anaBokra. {{consent_link}} (expires in 4 days)." Then stop. If no response after 7 days, the link expires and the teen is told.

**OTP message:** "{{code}} is your anaBokra verification code. Do not share it. It expires in 5 minutes."

**After consent (to parent):** "Thank you. You gave anaBokra permission for {{teen_nickname}} on {{date}}. You can see a summary or withdraw at any time: {{family_link}}."

---

## 2. Parent consent screen — Routes A and B
*(Shown after OTP verification. In Route A the parent has no account yet; in Route B it is shown inside the family account for each teen added.)*

### Title: Your permission for {{teen_nickname}}

**Step 1 — Who you are**
Name: [______]  Relationship: ( ) Mother ( ) Father ( ) Legal guardian ( ) Other: [____]
WhatsApp number (verified): {{number}}

**Step 2 — In short** (always visible, before the checkboxes)
- {{teen_nickname}} wants to use anaBokra to explore careers. The questions are about interests, personality, work values and abilities.
- We will collect: name or nickname, date of birth, governorate, school and curriculum, WhatsApp number, answers, results and an AI-written explanation of the results.
- The answers are treated as **sensitive data** (PDPL Art. 1 and 12).
- You will see a **summary** only. You will never see the raw answers.
- We do not sell data, show ads or send marketing to teens.
- You can **withdraw** any time. We then stop and delete the data.
- This is guidance, **not a diagnosis**.
- Full details: [Privacy Policy] · [Children's Data Notice] · [Terms of Use].

**Step 3 — Please tick to confirm** (all required unless marked optional)

- [ ] **1. Guardian.** I confirm that I am {{teen_nickname}}'s parent or legal guardian, that I am 18 or older, and that I have the authority to give this permission.
- [ ] **2. Sensitive data.** I give my explicit written consent for anaBokra to collect and process {{teen_nickname}}'s personal data, including his or her answers and results, which are sensitive personal data, for the purposes described: running the assessments, producing career matches, opportunities and a roadmap, and managing this consent.
- [ ] **3. AI explanation.** I agree that scores and match labels (without name, phone number, date of birth, school or governorate) are sent to an AI service (Claude, Anthropic, USA) to write explanations.
- [ ] **4. Storage and transfer outside Egypt.** I agree that data is stored on servers in Europe (OVH, [country]) and processed by the service providers listed in the Privacy Policy, some of them outside Egypt.
- [ ] **5. Summary view.** I understand that I will see a summary of the results and not the raw answers, and that {{teen_nickname}} is told what I can see.
- [ ] **6. I have read** the Privacy Policy and the Children's Data Notice (version {{version}}), and I understand I can withdraw my consent at any time.
- [ ] **7. Optional — usage analytics.** I agree that {{teen_nickname}}'s use of the app is measured in a pseudonymous way to improve anaBokra (no advertising, no tracking on other sites). I can say no and everything still works.

**Buttons:** [ I agree and continue ] [ I do not agree ]

If "I do not agree" or the link expires: "No problem. {{teen_nickname}} can keep using the teaser. No assessment data will be collected. You can change your mind at any time."

**Confirmation screen:** "Thank you. Your permission is recorded on {{date}} (valid until {{expiry}}). You can see the summary, change or withdraw your permission here: {{family_link}}."

---

## 3. Route B — Family account consent
*(Parent creates the account first, then adds teens.)*

### 3.1 Create the family account
Title: **Create your anaBokra family account**
Fields: parent full name; WhatsApp number (verified by OTP); language.
- [ ] I am a parent or legal guardian, aged 18 or over, and I accept the [Terms of Use].
- [ ] I have read the [Privacy Policy] (what data we hold about me as a parent: name, WhatsApp number, consent records and the family account).
Text: "We use your details only to run your account, to verify your consent and to show you your teen's summary. We will not send you marketing."

### 3.2 Add a teen
Fields: teen nickname (or name); date of birth; relationship; teen's WhatsApp number (optional; the teen can also be invited by link).
Message to teen (WhatsApp/SMS): "{{parent_name}} added you to anaBokra. Open this link to start: {{link}}. You can only use the teaser until your parent finishes the permission step."

### 3.3 Consent for each teen
Show **Section 2, Step 2 and Step 3** (checkboxes 1 to 7) for each teen separately. Checkbox 1 text changes to: "I confirm that I am this teen's parent or legal guardian…". Add:
- [ ] **8. Family account.** I understand that I can add, remove or withdraw consent for each teen separately from the family account.

If a second guardian disagrees, either guardian's withdrawal is applied immediately **[LAWYER: confirm]**.

---

## 4. Route C — School consent form
*(Phase 2. Two parts: Part 1 signed by the school; Part 2 signed by each guardian, on paper or by e-signature, and kept by the school and uploaded to anaBokra.)*

### Part 1 — School declaration
**School:** [name] · **Governorate:** [__] · **Commercial/ministry registration:** [__] · **Authorized representative:** [name, title]

By signing, the school confirms that:
1. It wishes to offer anaBokra career guidance to the enrolled students listed in [annex / dashboard].
2. It has collected **written, explicit consent from each student's parent or legal guardian** (Part 2 or equivalent), kept a copy, and will give anaBokra a copy or a verified list **before** any student assessment starts. anaBokra will not enable assessments for a student without a recorded consent.
3. It informed the guardians about anaBokra using the attached notice, and told students.
4. Students are not forced to take part, and declining has no effect on their school standing.
5. [Roles: the school and anaBokra act as follows regarding student data — **LAWYER: independent controllers / joint controllers / anaBokra as processor?**]
6. [What the school sees: completion status and a summary of results for enrolled students, never raw answers. Anything more needs a separate guardian checkbox.]
7. The school will tell anaBokra promptly when a guardian withdraws consent or a student leaves, and anaBokra will stop processing and delete data on request or on withdrawal.
8. The school has authority to sign for the institution.

Signature · Name · Title · Date · Stamp

### Part 2 — Guardian consent slip (one per student)
**Student:** [name] **Class:** [__] **School:** [__]

anaBokra is an online career-guidance platform. The school has offered it to students. To take part, your child answers questions about interests, personality, work values and abilities; anaBokra turns the answers into career matches and a roadmap, and an AI writes the explanation from scores only. **These answers are sensitive personal data.** You (and not the school) decide.

Tick each box that you accept:
- [ ] 1. I am the student's parent or legal guardian.
- [ ] 2. I give my explicit written consent for anaBokra to process my child's personal data, including answers and results, for the purposes above.
- [ ] 3. I agree that scores (without identity) are sent to an AI service, and that data is stored in Europe and handled by providers outside Egypt, as the Privacy Policy explains.
- [ ] 4. I agree that the school will see [completion status and a summary of results]. The school will not see raw answers.
- [ ] 5. I understand that I will see a summary through a family account, that I can withdraw consent at any time at [privacy@anabokra.example] or through the school, and that this is guidance and not a diagnosis.
- [ ] 6. Optional — pseudonymous usage analytics to improve the service.

Guardian name: ______ Relationship: ______ National ID/passport no. [only if counsel approves]: ______ WhatsApp number: ______ Signature: ______ Date: ______

Privacy Policy: [link/QR] · Valid for [24 months] or until withdrawn.

---

## 5. Withdrawal confirmation

### 5.1 Screen (after the parent taps "Withdraw")
**Title:** Withdraw permission for {{teen_nickname}}?
"If you withdraw: {{teen_nickname}} can no longer take assessments; we stop using the data and **delete {{teen_nickname}}'s assessment answers, results, profile and AI texts within 30 days**. We keep only a small record that you gave and withdrew consent (for {{retention}} years) as legal proof. Copies in backups disappear within 35 days."
Options: ( ) Withdraw and delete everything ( ) Pause only (keep data for 30 days in case you change your mind, then delete) [Product to decide]
Button: [ Confirm withdrawal ] [ Cancel ]

### 5.2 Confirmation message — to parent (WhatsApp/email)
"Your permission for {{teen_nickname}} on anaBokra was withdrawn on {{date}} at {{time}}. We have stopped processing and will delete the data by {{deletion_date}}. You can give permission again at any time: {{link}}. Reference: {{reference}}. Questions: privacy@anabokra.example."

### 5.3 Message — to teen (in app)
"Your parent withdrew permission. You can still try the teaser. Your results and answers will be deleted by {{deletion_date}}. If you want a copy of your own results first, tell us before then."

### 5.4 Message — to school (Route C)
"Guardian consent for student {{student_ref}} was withdrawn on {{date}}. Please stop sharing this student's data with anaBokra and update your records."

### 5.5 When a teen asks to stop
"We received your request to stop. We will tell your parent that you asked and we will [stop using your data now / ask your parent to confirm within 7 days]. **[LAWYER/Product: when a 15 to 17-year-old asks to delete, do we act immediately?]**"
