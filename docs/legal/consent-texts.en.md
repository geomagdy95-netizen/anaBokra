> **DRAFT — not legal advice — must be reviewed by Egyptian counsel before use.**
>
> [Square brackets] = placeholders. **[LAWYER]** = open legal question (see `lawyer-brief.md`).
>
> This version covers **phase 1**: the app on the user's own phone, with data **encrypted and kept on the device**; adults 18+ accept for themselves; **15–17-year-olds need a verified parent or guardian**; and the university pilot sessions. The phase 2 server texts and the school-pilot texts are in git history.

# anaBokra Consent Texts (phase 1)

**Text version:** consent-0.5-draft (13 Oct 2026: optional password, 1.2 and 1.7)

**Design rules for all screens** (for Product/Engineering)
- All checkboxes are **unticked by default**. Required boxes must be ticked to continue. Optional choices never block anything (PDPL Art. 12).
- Each screen links to the Privacy Policy, *Your data, in short* and the Terms of Use, in the language the user chose (Arabic by default).
- Acceptances and consents are stored **on the device only, encrypted**: what was agreed, when, the text and policy versions, and the anonymous-data choice. Nothing is sent to anaBokra, except the parent's phone number while the verification code is sent (section 1.3).

---

## 1. First start

### 1.1 Age question
**Title:** Before we start
"How old are you?"
( ) Under 15 ( ) 15–17 ( ) 18–20 ( ) 21–25 ( ) 26 or older

- **Under 15:** "anaBokra is for ages 15 and up. The career library is open to browse." The app saves nothing.
- **15–17:** go to 1.3 (parent or guardian).
- **18 or older:** go to 1.2. The age band is kept on the device; 18–20 is kept separate because of the open question on civil capacity at 21. **[LAWYER]**

### 1.2 Acceptance (18 and over)
**Title:** Before you start
- Your answers and results stay on this device, encrypted. Nothing is sent to anaBokra: no account, no AI.
- Anyone who can open the app on this device can see your results, unless you lock it with a password. You can delete everything at any time.
- Results are guidance to explore, not a diagnosis.
- Links: [Privacy Policy] · [Your data, in short] · [Terms of Use]

- [ ] **Required:** I am 18 or older, I accept the Terms of Use and I have read the Privacy Policy (version {{policy_version}}).
- [ ] **Optional:** Share anonymous statistics to help improve anaBokra (see 1.6).

**Buttons:** [ Start ] [ Back ]

### 1.3 Parent or guardian (15–17)

**Screen 1, to the young person:** "Now it's your parent's or guardian's turn. Please hand them this phone. They need to verify and agree before you start."

**Screen 2, to the parent or guardian:**
**Title:** Your permission for your child to use anaBokra

**In short** (always visible)
- anaBokra helps your child explore careers. They answer questions about their interests, personality, work values and abilities.
- **Everything stays on this device, encrypted.** Answers, results and your details are not sent to anaBokra. No account, no AI.
- To make sure a parent or guardian agrees, we ask you to **verify your phone number with a code** and to give **your national ID number**. Your ID number is checked and stored **on this device only, encrypted**. It is never sent to anaBokra. Your phone number is used only to send the code and is not kept.
- You set a **parent PIN**. It is needed to delete data or change these settings.
- Results are guidance, not a diagnosis, and are not used for any grade or admission.
- Links: [Privacy Policy] · [Your data, in short] · [Terms of Use]

**Your details**
- Full name: [______]
- Relationship: ( ) Mother ( ) Father ( ) Legal guardian
- National ID number (14 digits): [______________] *The app checks the number is valid and that you are an adult. [LAWYER: is collecting this, even on the device only, allowed and proportionate?]*
- Your mobile number: [______] → [ Send code ] → Code: [______] → [ Verify ]
  *Sent by SMS. Your number is not stored after verification.*

**Please tick to confirm** (all required except the last)
- [ ] **1. Guardian.** I am this young person's parent or legal guardian, I am 21 or older, and the details above are true. I understand that giving false details is my responsibility. **[LAWYER: age threshold (18 or 21) and wording of the declaration]**
- [ ] **2. Permission.** I agree that my child uses anaBokra on this device, and that their answers and results, and my details, are saved on this device only, encrypted.
- [ ] **3. Terms.** I have read the Terms of Use and the Privacy Policy (version {{policy_version}}) and accept them on my child's behalf.
- [ ] **4. Optional:** Share anonymous statistics from my child's use to help improve anaBokra (see 1.6).

**Parent PIN:** [____] (4–6 digits, entered twice)

**Buttons:** [ I agree ] [ Not now ]
- "Not now": "No problem. Nothing has been saved."
- After "I agree": "Thank you. Please hand the phone back to your child."

**Checks the app makes on the device before "I agree" is enabled**
- The national ID has 14 digits, a valid century and birth date, a valid governorate code and a valid check digit. [Engineering: confirm the check-digit rule against an official source before launch.]
- The parent's birth date (from the ID) shows them to be at least [21] and at least [15] years older than the child's age band allows.
- The phone code was verified within the last 10 minutes.

**What the device stores (encrypted):** parent name, relationship, national ID number, the last 3 digits of the verified phone number, verification time, text and policy versions, a hash of the parent PIN, and the anonymous-statistics choice.

### 1.4 Delete all my data
**Title:** Delete everything?
"This removes the profile, answers, results, islands and points from this device. It can't be undone, and anaBokra can't recover them, because we never had them."
- For 15–17 profiles, the **parent PIN** is required.
**Buttons:** [ Delete everything ] [ Cancel ]

### 1.5 Moving to a new phone
**Option A: backup file**
"Save a backup file of your anaBokra data. It's locked with a passphrase you choose; without it, nobody can open the file, including us."
- Passphrase: [______] (entered twice; for 15–17 profiles, the parent PIN is also required)
- [ Save backup file ]
On the new phone: *Restore from a backup file* → choose the file → passphrase.

**Option B: transfer code**
"Move your data with a one-time code. Your data is locked on this phone before it leaves, passes through our server in a form we can't read, and is deleted from the server after 10 minutes or once received."
- Old phone: [ Create transfer code ] → shows an 8-character code and a 16-character key (for 15–17 profiles, after the parent PIN). The key never reaches the server.
- New phone: *I have a transfer code* → enter the code and the key.
**[LAWYER: is briefly relaying encrypted data that anaBokra cannot read "processing" under the PDPL?]**

### 1.6 Anonymous statistics (optional)
"If you agree, the app sends one anonymous summary when an assessment is finished: age group, stage (student or graduate), language, the top interest areas and career groups, score bands, and how many parts were completed. It never includes a name, phone number, ID number, device identifier or exact time, and can't be traced back to you. You can turn this off at any time in Settings."
For 15–17, the parent makes this choice (1.3, box 4).

---

### 1.7 Nickname and password
Shown after acceptance (for 15–17, after the parent hands the phone back), and in Settings.
- **Nickname:** "It stays on this phone. It doesn't have to be your real name."
- **Lock the app with a password?** "Optional. Without a password, anyone who can open the app on this phone can see your results."
- [ ] Yes, ask for a password when the app opens (at least 6 characters; it stays on this phone).
- **Recovery code**, shown once: "If you forget your password, this code is the only way to reset it. Write it down or take a screenshot, and keep it somewhere safe. We can't recover it for you, because we never see it."
- Only salted hashes of the password and the recovery code are kept, on the device. After 5 wrong tries in a row the app makes the user wait, longer each time. With neither the password nor the code, the only way on is to delete the profile (a 15–17 profile needs the parent PIN for that). The password stays on this phone: a backup file or transfer doesn't carry it (the backup has its own passphrase).

## 2. University pilot sessions

### 2.1 Said at the start of each session (by the anaBokra team member)
"Thank you for coming. anaBokra is guidance, not a test, and it has nothing to do with your grades. There are no right or wrong answers. Your answers stay on your phone, encrypted: we don't ask for your name or email. You can skip any question or stop at any time. The app will ask whether you want to share anonymous data to help us improve the Arabic questions. That's completely up to you. Please use a normal browser window, not a private one."

### 2.2 Event code
**Title:** Joining a session?
"Enter the code your session organiser gave you. It links your anonymous totals to the session report, which shows group results only."
Field: [ event code ]  **Buttons:** [ Join ] [ Skip ]

### 2.3 Research data (optional, pilot sessions only)
**Title:** Help us check the Arabic questions? (optional)
- In addition to the anonymous statistics (1.6), your individual answers are sent **without your name or any ID**, with only the session code, your age group, stage and language.
- Your readiness answers before and after are linked by a **random code made on your phone**, so we can see how much they change.
- We delete this data once the research is done, by 17 June 2027 at the latest. Results are published only as group statistics.
- Saying no changes nothing in the app.

**Buttons:** [ Yes, I'll help ] [ No, thanks ]

Shown only when the session's partner offers research (some universities may need an approval first). The choice can be changed later under *University session* on the main page. Turning it off stops all uploads and deletes the readiness answers sent from this phone (by its random code); answer sets carry no code and cannot be picked out.
**[LAWYER: is this explicit consent for the linked readiness data? Is a research or ethics approval needed?]**
