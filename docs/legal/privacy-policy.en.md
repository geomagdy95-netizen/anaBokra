> **DRAFT — not legal advice — must be reviewed by Egyptian counsel before use.**
>
> Items in [square brackets] are placeholders or facts to be confirmed by the anaBokra team. Items marked **[LAWYER]** are open legal questions (see `compliance-map.md`).

# anaBokra Privacy Policy

**Version:** 0.1-draft  **Effective date:** [date]  **Language:** English (an Arabic version exists; if they differ, [the Arabic version prevails — LAWYER])

A shorter, teen-friendly version is in the *Children's Data Notice*. This policy is the full version.

## 1. Who we are

anaBokra is operated by **[anaBokra legal entity name]**, [Commercial Register No.], [registered address], Egypt ("anaBokra", "we", "us"). We are the **controller** of the personal data described here under the Egyptian Personal Data Protection Law No. 151 of 2020 (the "PDPL") and its Executive Regulations (Ministerial Decision No. 816 of 2025).

**Data Protection Officer:** [name], registered with the Personal Data Protection Center (the "Center") under code [code]. Contact: [privacy@anabokra.example] · [address] · WhatsApp [number].

## 2. Who this policy is about

- **Teens** (about 15 to 18) who take assessments on anaBokra.
- **Parents or legal guardians** who give consent and see a summary.
- **Schools** that enroll students (when this feature is offered).
- **Visitors** to our website and app.

anaBokra is designed for teens aged 15 and over. We do not knowingly offer the service to anyone under 15.

## 3. The most important points

1. We ask a parent or legal guardian to consent **before** a teen under 18 can take any assessment. A teen can only use a short teaser and the sign-up steps until that happens.
2. Assessment answers are treated as **sensitive personal data**. We use them only to give the teen career guidance.
3. Parents see a **summary**, never the teen's raw answers.
4. We **do not sell** personal data, show advertising, or send marketing messages to teens.
5. Parent or teen can **withdraw consent** at any time.
6. Some of our service providers are outside Egypt (Europe and the USA). We ask for your consent to this and tell you exactly who they are (section 8).
7. Guidance from anaBokra is **not a diagnosis** and not a substitute for a professional (see the Terms of Use).

## 4. What data we collect, why, and on what basis

Our basis for processing is **explicit consent** (PDPL Art. 2 and 6(1)), given in writing for sensitive data and children's data (PDPL Art. 12), or, for adult users, their own consent. For contract-type processing (running the account you asked for) we also rely on PDPL Art. 6(2). **[LAWYER: confirm bases.]**

| Data | Examples | Why we use it | When collected |
|---|---|---|---|
| Identity and contact | Name or nickname, date of birth, WhatsApp number | Create the account, log in by WhatsApp one-time code (OTP), check age, contact the parent | Sign-up |
| Location and school | Governorate, school, curriculum (e.g., Thanaweya Amma, IGCSE, American Diploma) | Show relevant opportunities, universities and tracks | After consent **[Engineering to confirm; see 4.1]** |
| Parent or guardian identity | Name, WhatsApp number, relationship, consent method | Verify and record consent | Consent step |
| Assessment answers | Answers to interests, personality (Big Five), work values and abilities questions | Calculate scores and career matches | After consent |
| Results | Scores, career matches, roadmap, saved opportunities | Show results; build the roadmap | After consent |
| AI-written explanations | Text generated from scores (see section 7) | Explain the results in plain language | After consent |
| Consent records | Method, who consented, time, policy version, withdrawal | Prove and manage consent (PDPL Art. 4 and 11) | Consent step |
| Usage analytics | Pages visited, buttons used, device type (PostHog) | Keep the product working and improve it | See 4.2 |
| Error logs | Technical error details, device and browser type (Sentry) | Find and fix bugs | Always, with personal data removed where possible |
| Messages and support | What you send us | Answer you | When you contact us |

### 4.1 Before consent
Before a parent consents, a teen can only use the teaser (no answers are saved) and the onboarding steps. In this period we collect only what is needed to log the teen in and ask the parent: [nickname, date of birth or age band, teen WhatsApp number, parent WhatsApp number]. We do not ask for governorate, school or any assessment answers until consent is recorded. **[LAWYER: PDPL Art. 12 requires guardian consent for processing children's data; is even this minimal pre-consent collection permitted?]**

### 4.2 Analytics and children
For teens we use analytics only to keep the service working and to find usability problems. We **do not** use analytics to build advertising profiles, to track teens across other websites, or to monitor teens' behavior for any other purpose. The Executive Regulations restrict profiling, tracking and behavioral monitoring of children in activities (reported as ER Art. 14(5); **[LAWYER: confirm text]**). Analytics for teens is switched off until consent is given, uses a pseudonymous ID, and has no session recording [Engineering to confirm]. A separate optional checkbox covers non-essential analytics.

## 5. How we use data

- To run the service: log-in, assessments, results, opportunities and roadmap.
- To record and manage consent, and to contact the parent about consent.
- To keep the service safe, secure and working (including fraud and abuse prevention).
- To improve the service using **aggregated or de-identified** statistics.
- To comply with the law.

We do **not** use personal data for advertising, we do not make decisions about a teen that have legal or similar significant effect, and career matches are suggestions that a teen can ignore. A teen or parent can object to the processing or its outcomes (PDPL Art. 2).

## 6. Parent view

Parents linked to a teen see a **summary**: the teen's top career matches and strengths in plain words, roadmap progress and saved opportunities. Parents **never** see the raw answers, individual question responses or the teen's WhatsApp conversations. The teen can see what the parent sees. **[Product to confirm exact fields.]**

## 7. Artificial intelligence

We use Claude, an AI model from Anthropic, to write the explanation text from the teen's **scores and match labels**. We send Anthropic only what is needed: scores, trait labels and, where useful, an age band. We **do not send** names, WhatsApp numbers, dates of birth, school names or governorate [Engineering to confirm]. Anthropic acts as our processor under a written agreement and [does not use this data to train its models — confirm contract and current Anthropic terms]. AI text can contain errors; it is guidance, not a diagnosis. Our systems must use AI in a way that does not harm the data subject (Executive Regulations, as reported by Baker McKenzie).

## 8. Who receives data, and transfers outside Egypt

We do not sell data. We share it only with:

| Recipient | Role | What | Where |
|---|---|---|---|
| OVH (VPS hosting) | Processor | Everything stored in our database (self-hosted Supabase) | [France/Germany/other — confirm], Europe |
| Anthropic (Claude API) | Processor | Scores and labels for AI text | USA [confirm region] |
| Meta / WhatsApp Business Platform [or BSP name] | Processor / independent service | WhatsApp numbers and the messages we send (OTP, consent link) | [confirm] |
| PostHog | Processor | Pseudonymous usage events | [self-hosted on OVH / EU cloud — confirm] |
| Sentry | Processor | Error logs | [EU / US — confirm] |
| Parent or guardian | Recipient | Summary only | In app |
| School (route C only) | Recipient | [Completion status and summary, only as stated in the school consent form] | In app |
| Authorities | Recipient | Only when required by law or court order | — |

**Transfers outside Egypt.** Egyptian law allows personal data to leave Egypt only with the Center's license or permit, to a destination with adequate protection, and with the data subject's or guardian's consent (PDPL Art. 14–16; ER Art. 16). As of [date], we understand the Center has not yet published a list of adequate countries. **[LAWYER: license status and whether we may operate in the meantime.]** We include a separate consent checkbox for this transfer.

## 9. How long we keep data

See the table below. When a period ends, we delete the data or make it permanently non-identifiable (PDPL Art. 4(7)). **[Periods are proposals — LAWYER/Product to confirm.]**

| Data | Retention |
|---|---|
| Account, profile, assessment answers, results | While the account is active; deleted within 30 days after consent is withdrawn or deletion is requested; deleted after [24] months of inactivity (we warn first) |
| Parent/guardian details | While the teen account is active, then as consent records below |
| Consent records (who, how, when, version, withdrawal) | [5] years after the account ends (to prove consent), kept separately from content |
| Usage analytics | [12] months, pseudonymous; aggregated statistics may be kept |
| Error logs | [90] days |
| OTP codes | Expire after [5] minutes; delivery logs [30] days |
| Backups | Overwritten within [35] days; deleted data is not restored to active use |
| Support messages | [24] months |

## 10. Security

We apply technical and organizational measures to protect data, including encryption in transit and at rest, access control limited to staff who need it, separation of consent records, logging of admin access, and regular backups [Engineering to confirm]. If a breach occurs we will notify the Center within 72 hours and tell affected people within three working days after notifying the Center (PDPL Art. 7).

## 11. Your rights

You (a teen, or a parent for a young child) can ask us to:

- tell you what data we hold and give you a copy;
- correct, update or complete it;
- delete it;
- stop or limit its use;
- withdraw consent at any time (this does not undo earlier lawful use);
- object to the processing or its outcomes;
- tell you about a breach affecting you.

We answer within **6 working days** (PDPL Art. 32). We do not charge a fee. If you are not satisfied, you may complain to the Personal Data Protection Center (PDPL Art. 33) or go to court. To use your rights, write to [privacy@anabokra.example] or use *Settings → My data* in the app. We may need to verify your identity, and for a teen's account we may confirm with the parent.

## 12. Withdrawing consent

A parent can withdraw consent from the family account, from the WhatsApp link, or by email. A teen can also ask us to stop. After withdrawal the teen can use only the teaser, we stop processing, and we delete the data on the schedule above. See the *Consent Texts* for the exact message.

## 13. Cookies and similar technologies

We use only [essential storage (log-in, language)] and, with consent, analytics identifiers. We do not use advertising cookies. [Update after technical review.]

## 14. Changes to this policy

We will tell parents and teens about important changes and, if the change affects consent, ask again. Each consent record stores the policy version.

## 15. Contact and complaints

[privacy@anabokra.example] · [address] · Personal Data Protection Center: [portal.pdpc.gov.eg].
