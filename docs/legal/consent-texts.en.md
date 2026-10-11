> **DRAFT — not legal advice — must be reviewed by Egyptian counsel before use.**
>
> [Square brackets] = placeholders. **[LAWYER]** = open legal question (see `lawyer-brief.md`).
>
> This version covers **phase 1** for people **aged 18 and over**: the app on the user's own phone, with data kept on the device, and the university pilot sessions. The teen texts (guardian confirmation, school forms) and the phase 2 server texts are in git history.

# anaBokra Consent Texts (phase 1)

**Text version:** consent-0.3-draft

**Design rules for all screens** (for Product/Engineering)
- All checkboxes are **unticked by default**. Required boxes must be ticked to continue. Optional choices never block anything (PDPL Art. 12).
- Each screen links to the Privacy Policy, *Your data, in short* and the Terms of Use, in the language the user chose (Arabic by default).
- Acceptances are stored **on the device only**: that it was given, the date and time, the text version, the policy version, and the research choice. Nothing is sent to anaBokra.

---

## 1. First start

### 1.1 Age question
**Title:** Before we start
"How old are you?"
( ) Under 18 ( ) 18–20 ( ) 21–25 ( ) 26 or older

- **Under 18:** "anaBokra is for ages 18 and up for now. A version for school students is coming. The career library is open to browse in the meantime." The app saves nothing.
- **18 or older:** go to 1.2. The age band is kept on the device (18–20 is kept separate because of the open question on civil capacity at 21). **[LAWYER]**

### 1.2 Acceptance
**Title:** Before you start
- Your answers and results stay on this device. Nothing is sent to anaBokra: no account, no phone number, no AI.
- Anyone who can open the app on this device can see your results. You can delete everything at any time.
- Results are guidance to explore, not a diagnosis.
- Links: [Privacy Policy] · [Your data, in short] · [Terms of Use]

- [ ] I am 18 or older, I accept the Terms of Use and I have read the Privacy Policy (version {{policy_version}}).

**Buttons:** [ Start ] [ Back ]

### 1.3 Delete all my data
**Title:** Delete everything?
"This removes your profile, answers, results, islands and points from this device. It can't be undone, and anaBokra can't recover them, because we never had them."
**Buttons:** [ Delete everything ] [ Cancel ]
After deleting, the app returns to the first-start screen (1.1).

---

## 2. University pilot sessions

### 2.1 Said at the start of each session (by the anaBokra team member)
"Thank you for coming. anaBokra is guidance, not a test, and it has nothing to do with your grades. There are no right or wrong answers. Your answers stay on your phone: we don't ask for your name, number or email. You can skip any question or stop at any time. Near the start, the app will ask whether you want to share your answers anonymously for research. That's completely up to you. If you use a private browser window, your answers will be lost when you close it, so please use a normal window. Results stay on the phone you use today."

### 2.2 Event code
*(Settings or first start → "I'm at an anaBokra session")*
**Title:** Joining a session?
"Enter the code your session organiser gave you. It links your progress to the session report, which shows group results only."
Field: [ event code ]  **Buttons:** [ Join ] [ Skip ]

### 2.3 Research choice
*(Shown once, after the event code is entered. Optional.)*
**Title:** Help us check the Arabic questions? (optional)
- We're checking that the Arabic version of the questions works well for young people in Egypt.
- If you say yes, your answers will be sent **without your name or any ID**, with only the session code, your age band, whether you're a student or graduate, and your language.
- Your readiness answers before and after will be linked by a **random code made on your phone**, so we can see how much they change.
- We'll delete this data once the research is done, by 17 June 2027 at the latest. Results are published only as group statistics.
- Saying no changes nothing in the app.

**Buttons:** [ Yes, I'll help ] [ No, thanks ]

The choice is stored on the device with the text version. It can be changed in *Settings → Research data* until the data is sent. **[LAWYER: is this explicit consent for the linked readiness data? Is a research or ethics approval needed?]**

### 2.4 After sending
If the user opted in, after the last part: "Thank you. Your anonymous answers were sent. They can't be traced back to you, so they can't be removed later." [Product: the linked readiness record can be deleted on request using the random code on the phone, from *Settings → Research data*.]
