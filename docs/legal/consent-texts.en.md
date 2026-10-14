> **DRAFT — not legal advice — must be reviewed by Egyptian counsel before use.**
>
> [Square brackets] = placeholders. **[LAWYER]** = open legal question (see `lawyer-brief.md`).
>
> This version covers **phase 1**: the app on the user's own phone, with data **encrypted and kept on the device**; everyone aged 15 or older accepts for themselves (there is no parent step: no personal data reaches anaBokra; counsel agreed, 13 Oct 2026); and the university pilot sessions. The earlier parent-verification texts, the phase 2 server texts and the school-pilot texts are in git history.

# anaBokra Consent Texts (phase 1)

**Text version:** consent-0.8-draft (13 Oct 2026: no parent step, 15–17 accept for themselves; backup file only; optional password. 0.7: anonymous statistics also cover checked paths and the results rating; research covers path answers. 0.8, 15 Oct: anonymous statistics also cover the first score in each Discover game, to compare players)

**Design rules for all screens** (for Product/Engineering)
- All checkboxes are **unticked by default**. Required boxes must be ticked to continue. Optional choices never block anything (PDPL Art. 12).
- Each screen links to the Privacy Policy, *Your data, in short* and the Terms of Use, in the language the user chose (Arabic by default).
- Acceptances and consents are stored **on the device only, encrypted**: what was agreed, when, the text and policy versions, and the anonymous-data choice. Nothing personal is sent to anaBokra.

---

## 1. First start

### 1.1 Age question
**Title:** Before we start
"How old are you?"
( ) Under 15 ( ) 15–17 ( ) 18–20 ( ) 21–25 ( ) 26 or older

- **Under 15:** "anaBokra is for ages 15 and up. The career library is open to browse." The app saves nothing.
- **15 or older:** go to 1.2. The age band is kept on the device; 18–20 stays a separate band.

### 1.2 Acceptance (15 and over)
**Title:** Before you start
- Your answers and results stay on this device, encrypted. Nothing is sent to anaBokra: no account, no AI.
- Anyone who can open the app on this device can see your results, unless you lock it with a password. You can delete everything at any time.
- Results are guidance to explore, not a diagnosis.
- Links: [Privacy Policy] · [Your data, in short] · [Terms of Use]

- [ ] **Required (18+):** I am 18 or older, I accept the Terms of Use and I have read the Privacy Policy (version {{policy_version}}).
- [ ] **Required (15–17), instead:** I am 15–17 years old, I accept the Terms of Use and I have read the Privacy Policy (version {{policy_version}}).
- [ ] **Optional:** Share anonymous statistics to help improve anaBokra (see 1.6).

**Buttons:** [ Start ] [ Back ]

### 1.3 Parent or guardian
No parent step in phase 1 (removed 13 Oct 2026): nothing personal reaches anaBokra, so no parent's details are needed. If accounts or server storage come later, a parent step will be designed again with counsel.

### 1.4 Delete all my data
**Title:** Delete everything?
"This removes the profile, answers, results, islands and points from this device. It can't be undone, and anaBokra can't recover them, because we never had them."
**Buttons:** [ Delete everything ] [ Cancel ]

### 1.5 Moving to a new phone
**Backup file**
"Save a backup file of your anaBokra data. It's locked with a passphrase you choose; without it, nobody can open the file, including us."
- Passphrase: [______] (entered twice, at least 8 characters)
- [ Save backup file ]
On the new phone: *Restore from a backup file* → choose the file → passphrase.

The file never passes through anaBokra; the user carries it to the new phone. (The transfer code through our server was removed on 13 Oct 2026.)

### 1.6 Anonymous statistics (optional)
"If you agree, the app sends anonymous records: one summary when an assessment is finished (age group, stage (student or graduate), language, the top interest areas and career groups, score bands, and how many parts were completed); for each career path you check, the path and how well it fits (fits well, partly, or worth rethinking); if you answer it, your 1–5 rating of whether your results were clear and useful; and, for each game you play, your score the first time you play it (so players can see how they compare). Each record carries only your age group, stage, language and session code (if you entered one). They never include a name, phone number, ID number, device identifier or exact time, can't be linked to each other, and can't be traced back to you. You can turn this off at any time in Settings."
Everyone 15 or older makes this choice themselves.

---

### 1.7 Nickname and password
Shown after acceptance, and in Settings.
- **Nickname:** "It stays on this phone. It doesn't have to be your real name."
- **Lock the app with a password?** "Optional. Without a password, anyone who can open the app on this phone can see your results."
- [ ] Yes, ask for a password when the app opens (at least 6 characters; it stays on this phone).
- **Recovery code**, shown once: "If you forget your password, this code is the only way to reset it. Write it down or take a screenshot, and keep it somewhere safe. We can't recover it for you, because we never see it."
- Only salted hashes of the password and the recovery code are kept, on the device. After 5 wrong tries in a row the app makes the user wait, longer each time. With neither the password nor the code, the only way on is to delete the profile. The password stays on this phone: a backup file doesn't carry it (the backup has its own passphrase).

## 2. University pilot sessions

### 2.1 Said at the start of each session (by the anaBokra team member)
"Thank you for coming. anaBokra is guidance, not a test, and it has nothing to do with your grades. There are no right or wrong answers. Your answers stay on your phone, encrypted: we don't ask for your name or email. You can skip any question or stop at any time. The app will ask whether you want to share anonymous data to help us improve the Arabic questions. That's completely up to you. Please use a normal browser window, not a private one."

### 2.2 Event code
**Title:** Joining a session?
"Enter the code your session organiser gave you. It links your anonymous totals to the session report, which shows group results only."
Field: [ event code ]  **Buttons:** [ Join ] [ Skip ]

### 2.3 Research data (optional, pilot sessions only)
**Title:** Help us check the Arabic questions? (optional)
- In addition to the anonymous statistics (1.6), your individual answers, including the tasks for each path you check, are sent **without your name or any ID**, with only the session code, your age group, stage and language.
- Your readiness answers before and after are linked by a **random code made on your phone**, so we can see how much they change.
- We delete this data once the research is done, by 17 June 2027 at the latest. Results are published only as group statistics.
- Saying no changes nothing in the app.

**Buttons:** [ Yes, I'll help ] [ No, thanks ]

Shown only when the session's partner offers research (some universities may need an approval first). The choice can be changed later under *University session* on the main page. Turning it off stops all uploads and deletes the readiness answers sent from this phone (by its random code); answer sets carry no code and cannot be picked out.
**[LAWYER: is this explicit consent for the linked readiness data? Is a research or ethics approval needed?]**
