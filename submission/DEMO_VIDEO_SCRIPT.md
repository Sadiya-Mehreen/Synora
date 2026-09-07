# Synora -- Demo Video Script (target: 2:30-2:50)

## 0:00-0:15 -- Hook
*(Show the landing page: "Your brain forgets. Synora doesn't.")*

**VO:** "You can pass a quiz on something and still not actually understand it. Synora doesn't quiz you -- it calls you, and makes you explain it."

## 0:15-0:35 -- The problem, fast
**VO:** "Multiple choice tests recognition. Flashcards test memorization. Neither tests whether you can actually explain a concept -- or whether you've quietly mixed two ideas up. That gap is where misconceptions live, and they compound."

## 0:35-1:00 -- Sign up + add a subject
*(Screen: sign up, quick cut through login, land on the empty dashboard, add "Cryptography" with description "Hashing, encryption, digital signatures, salts.")*

**VO:** "Add what you're studying. Synora doesn't give you a fake progress bar -- a new topic honestly starts as 'Not assessed.'"

## 1:00-1:45 -- The call (core demo)
*(Click the phone icon on the Cryptography card. The recall-call modal opens with Synora's opening question.)*

**VO:** "Tap to start a recall. Synora asks an open question -- no multiple choice."

*(Type: "Hashing encrypts data so it can be decrypted later.")*

**VO:** "Here's a common, subtle mistake -- describing hashing as reversible encryption."

*(Show the adaptive follow-up question appear, referencing the misconception directly.)*

**VO:** "Synora doesn't just mark it wrong. It asks a targeted follow-up that probes whether this is a real misunderstanding."

*(Answer the follow-up, show the modal transition to the final result: Misconception pill, correct understanding, recall score, next review shortened.)*

**VO:** "And there it is -- not a score, a *diagnosis*. Hashing versus encryption, flagged as a misconception, with the actual correct understanding, and Synora shortens the next review instead of waiting a month to find out this didn't stick."

## 1:45-2:10 -- Dashboard reflects it
*(Cut to dashboard: topic card shows "Misconception" status in purple, "Needs attention" panel shows the misconception, stats row shows 1 under Misconceptions.)*

**VO:** "Everything the call found shows up immediately -- what needs attention, what's fading, what's actually mastered. No fake percentages anywhere Synora hasn't actually tested you."

## 2:10-2:30 -- How it's built
*(Quick cuts: code showing the CALL-E adapter, the MOCK/REAL badge in the navbar, the Skill file.)*

**VO:** "Under the hood, every call follows CALL-E's `learning-recall-call` skill. In mock mode you can see and test the whole loop with zero credentials; flip one environment variable and the exact same flow places a real phone call through CALL-E's API. The badge always tells you honestly which one you're looking at."

## 2:30-2:45 -- Close
*(Back to landing page hero.)*

**VO:** "Your brain forgets. Synora calls you before you do. That's the whole idea."

*(End card: project name, GitHub link, "Built for CALL-E: Your Code Is Calling.")*

---

**Shot list checklist**
- [ ] Landing page hero
- [ ] Signup -> Login -> empty dashboard ("Not assessed" state)
- [ ] Add subject flow
- [ ] Recall call modal: opening question -> typed answer -> adaptive follow-up -> typed answer -> result screen
- [ ] Dashboard after the call: topic status, Needs Attention panel, stats row
- [ ] MOCK/REAL badge close-up
- [ ] (Optional, if real credentials become available before submission) one real outbound call
