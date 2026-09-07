# Synora

**Your brain forgets. Synora doesn't.**

Built for **CALL-E: Your Code Is Calling**.

---

## WHAT IS SYNORA?

Synora is an AI learning and memory companion that *calls* learners to test what they actually remember, catches conceptual misconceptions before they calcify, and adapts what gets reviewed and when. It turns a phone call into an active-recall learning assessment.

## THE PROBLEM

Most study tools measure recognition, not recall. A multiple-choice quiz or a flashcard you flip and grade yourself on tells you whether an answer looks familiar -- not whether you can actually explain the idea, and not whether you've quietly mixed up two related concepts. That gap is invisible to the learner until it matters (an exam, an interview, a production incident) and by then it's expensive.

## THE INSIGHT

Making someone explain a concept out loud, in their own words, on a phone call, is a much harder thing to fake than picking an answer from a list. A phone conversation surfaces two things a quiz cannot: partial understanding (you get some of it, but not all) and misconceptions (you're confident, and wrong, in a specific and identifiable way). Synora is built around testing for both.

## HOW SYNORA WORKS

```
Study a topic
     |
Schedule (or start) a recall
     |
CALL-E phone call: Synora asks an open question
     |
Learner explains what they remember
     |
Synora asks one adaptive follow-up
     |
AI evaluation: correct / partial / misconception
     |
Memory state updates (Mastered / Fading / Forgotten / Misconception)
     |
Next review interval adapts
```

## WHY PHONE-BASED ACTIVE RECALL

Text-based quizzing lets a learner reread the question, second-guess, and pattern-match against options. A phone call removes all of that scaffolding: you either can explain the concept in the moment or you can't, and hesitation, hedging, and wrong turns are exactly the signal Synora is listening for. CALL-E is what makes this a real phone conversation rather than a chat window pretending to be one.

## MISCONCEPTION DETECTION

Synora does not just mark an answer right or wrong. Given a learner's explanation, it distinguishes:

- **Correct but incomplete** -- got the core idea, missing detail
- **Uncertain** -- hedging, doesn't commit to an answer
- **Genuine misconception** -- confidently states something that is specifically wrong
- **Strong understanding** -- explains it correctly and completely

The canonical example built into the deterministic evaluator: a learner says *"Hashing encrypts data so it can be decrypted later."* Synora doesn't just say "incorrect" -- it identifies the specific confusion (treating one-way hashing as reversible encryption), states the correct understanding, and asks a follow-up that probes whether the learner can self-correct once given that context.

## MEMORY STATES

Four states, always derived from actual recall-session results, never fabricated:

| State | Meaning |
|---|---|
| **Not assessed** | Default for a brand-new topic. Synora never shows fake progress. |
| 🟢 Mastered | High recall score, no misconception detected |
| 🟡 Fading | Moderate recall score |
| 🔴 Forgotten | Low recall score |
| 🟣 Misconception | A specific misconception was detected -- overrides the score-based state, since a confident wrong belief is more urgent than a low score |

Memory strength shown on the dashboard is the average of *assessed* topics only -- an unassessed topic is excluded, never counted as 0%.

## ARCHITECTURE

```
Synora (React + TS frontend)
        |
        v
Express + SQLite backend
        |
        +--> Recall Service (session orchestration, memory engine)
        |
        +--> CALL-E Adapter
        |        +--> Mock adapter   (dry-run, no network, no credentials needed)
        |        +--> Real adapter   (@call-e/calle SDK -- real outbound call)
        |
        +--> Evaluator
                 +--> Deterministic evaluator (default, zero credentials)
                 +--> LLM evaluator (Anthropic Messages API, optional)
```

- **Frontend**: React 19 + TypeScript + Vite, custom CSS (no UI framework), Lucide icons. Sky/cloud visual identity, Gloock for headings, Mulish for body text.
- **Backend**: Node.js + Express 5 + better-sqlite3 + bcryptjs.
- **Auth**: server-issued bearer tokens (30-day expiry, revocable on logout, cleaned up on expiry). Every request's identity is resolved from the verified token server-side -- never from a client-supplied ID.

## CALL-E INTEGRATION

Real calls go through the official [`@call-e/calle`](https://www.npmjs.com/package/@call-e/calle) npm SDK (`CalleClient`, `client.calls.createAndWait(...)`). This was verified by installing the actual published package and reading its shipped TypeScript declarations directly -- nothing about the SDK's shape is guessed. `backend/src/calle/realAdapter.js`:

- Reads `CALLE_API_KEY` from the environment only; the key is never sent to the frontend and never hardcoded.
- Builds the call's `task` from the `learning-recall-call` Skill's instructions, parameterized with the learner's topic/study context/prior weak areas (`buildRecallCallTask` in `schema.js`).
- Passes a JSON Schema mirroring the Skill's own output contract as `resultSchema`, so CALL-E returns a structured result Synora can use directly.
- Validates the phone number is in E.164 format, but deliberately does **not** hardcode a region or locale (e.g. `"US"`/`"en-US"`) -- those are optional routing/language *hints* in the real SDK, and fabricating a US default would be wrong for, say, a learner with an Indian (+91) number. The E.164 number itself already carries the country code.
- Passes an idempotency key (`{ idempotencyKey }`) through to `createAndWait`, matching the SDK's real `RequestOptions` type.
- Throws (never fabricates a result) if the call doesn't reach `status: "completed"` with a `structuredResult` -- the caller marks the recall session `failed` with the real reason.

## CALL-E SKILL

Synora is built directly on top of the community `learning-recall-call` Skill (`SKILL.md`, `evaluator.py`, `llm_evaluator.py`, `safety.md`). Its call flow (one open question, one adaptive follow-up, then evaluate) and its output field names (`recall_score`, `status`, `concepts_remembered`, `weak_areas`, `misconceptions`, `recommended_next_review`) are used verbatim throughout Synora's database and API -- the Skill was not reimplemented or renamed.

## MOCK MODE

Mock mode is the default and requires **zero credentials**. Since a real outbound call needs an actual phone conversation to happen, mock mode simulates the same call flow as a short, typed, two-turn exchange in the dashboard: Synora asks an opening question, the learner types what they'd say, Synora's real evaluator (deterministic or LLM) scores it and asks one adaptive follow-up, the learner answers again, and the final evaluation, misconception detection, and memory-state update all run for real against the database. Nothing about the evaluation logic is faked -- only the phone call itself is simulated, and the UI always shows a "MOCK CALL-E" badge so this is never ambiguous.

```
MOCK_CALL_E=true       # default
EVAL_MODE=deterministic # default
```

## REAL MODE

```
MOCK_CALL_E=false
CALLE_API_KEY=<your key>
```

Requires the learner's profile to have a phone number and explicit call consent on file (enforced server-side -- a real call is refused with a clear error otherwise). If `CALLE_API_KEY` is missing while `MOCK_CALL_E=false`, Synora fails the request with an explicit 400 and marks the session `failed` -- it never silently pretends a call happened.

**Status: real code implemented and verified against the actual SDK; not live-call tested.** No `CALLE_API_KEY` was available during development, so an actual outbound phone call has not been placed. Do not read anything in this repository as claiming otherwise.

## ENVIRONMENT VARIABLES

See `backend/.env.example`.

| Variable | Default | Purpose |
|---|---|---|
| `MOCK_CALL_E` | `true` | `false` to require the real CALL-E adapter |
| `CALLE_API_KEY` | (none) | required only when `MOCK_CALL_E=false` |
| `CALLE_BASE_URL` | `https://api.heycall-e.com` | override CALL-E's API base URL |
| `EVAL_MODE` | `deterministic` | `llm` to use real AI evaluation |
| `ANTHROPIC_API_KEY` | (none) | required only when `EVAL_MODE=llm` |
| `ANTHROPIC_EVAL_MODEL` | `claude-sonnet-4-5-20250929` | override the model used for LLM evaluation |
| `PORT` | `3000` | backend port |
| `SYNORA_DB_PATH` | `backend/synora.db` | override the SQLite file path (used by the test suite for isolation) |

## INSTALLATION

### WINDOWS COMMANDS

```cmd
cd backend
npm install
copy .env.example .env
npm run dev
```

```cmd
cd frontend
npm install
npm run dev
```

> Note: `better-sqlite3` compiles a native addon on install. If `npm install` fails trying to download Node headers (e.g. behind a restrictive proxy), Node's own installation on Windows already provides what's needed for a normal `npm install` -- this was only an issue in this project's sandboxed development container, not on a standard Windows/Node setup.

## RUNNING THE APP

Backend starts on `http://localhost:3000`, creates `backend\synora.db` automatically on first run. Frontend prints its own URL (typically `http://localhost:5173`).

## TESTING

```cmd
cd backend
npm test
```

Actually run for this submission: **43 passing, 0 failing** (Node's built-in `node --test` runner, zero new test dependency). Covers: signup/duplicate/invalid signup, login/invalid login, logout + token revocation, **expired-token rejection**, **password-hash verification** (never stored in plaintext), cross-user ownership isolation on subjects/recalls/recall-sessions/misconceptions, scheduled recall create/list/cancel, the full mock recall-session flow (opening question → adaptive follow-up → final evaluation), the canonical misconception scenario end-to-end, deterministic-evaluator unit tests, memory-engine unit tests, and real-mode's graceful failure when unconfigured.

Frontend: `npx tsc -b` (TypeScript project build) and `npx vite build` (production build) both pass with zero errors; `npx oxlint` reports 0 warnings / 0 errors across all 8 source files.

## DEMO FLOW

1. Sign up → redirected to Login (a deliberate, explicit "create account, then log in" flow) → log in → dashboard.
2. Add a subject, e.g. **Cryptography** / *"Hashing, encryption, digital signatures, salts."*
3. Click the phone icon on the topic card.
4. Answer: *"Hashing encrypts data so it can be decrypted later."*
5. Answer the adaptive follow-up that Synora asks in response.
6. Watch the memory state update to **Misconception**, the "Needs attention" panel populate with the specific misunderstanding, and the next review shorten to 1 day.

This exact sequence was run live against the running backend during development (see the Final Engineering Report for the actual request/response transcript), including a full round-trip through `POST /api/auth/signup` → `PATCH /api/users/me/consent` → `POST /api/recalls` → `POST /api/recall-sessions` → two `POST /api/recall-sessions/:id/answer` calls → `GET /api/subjects`, `GET /api/misconceptions`, `GET /api/recall-sessions` -- with the resulting rows verified directly in SQLite, not just via API responses.

## SECURITY

- Passwords are hashed with bcrypt; never logged, never stored in plaintext (verified by an automated test that asserts the stored value matches a bcrypt hash pattern).
- Every protected endpoint resolves identity from a server-issued, expiring, revocable bearer token -- never from a client-supplied `userId`. Automated tests assert that one user cannot read or write another user's subjects, scheduled recalls, recall sessions, or misconceptions, including by directly guessing IDs.
- Expired tokens are rejected and cleaned up automatically (tested).
- `CALLE_API_KEY` and `ANTHROPIC_API_KEY` are read from environment variables only, used only inside their respective adapter modules, and never appear in any API response (verified by a source-level grep, not just code review).
- `.gitignore` (root and `backend/`) excludes `.env` and all `.env.*` variants (except `.env.example`), all SQLite database files, `node_modules/`, build output, and OS/editor junk.

## KNOWN LIMITATIONS

- **Real CALL-E has not been live-call tested.** The adapter is real code built against the actual SDK, but no `CALLE_API_KEY` was available in this development environment, so no outbound phone call has actually been placed. Same for the real LLM evaluator and `ANTHROPIC_API_KEY`.
- "Scheduling" a recall records the learner's intent (subject, date, time, repeat) but there is no background scheduler/cron actually dispatching a call at that time -- the learner (or a demo presenter) triggers the call manually via "Start a recall call now." Automatic dispatch at the scheduled time is a natural next step, explicitly out of scope here.
- The deterministic mock evaluator is a transparent heuristic, not real language understanding -- it can still flag the original wrong phrase even if the learner corrects themselves later in the same combined transcript. `EVAL_MODE=llm` does not have this limitation, but has not been live-tested (see above).
- Next-review intervals are a simple, transparent heuristic (misconception/forgotten → 1 day, fading → 3-7 days, mastered → 14-30 days, per the Skill's own suggested values) -- not a scientifically validated spaced-repetition algorithm, and the README does not claim otherwise.

## FUTURE WORK

- A real background dispatcher so scheduled recalls actually place calls at their scheduled time, rather than requiring a manual "start now."
- Live-test the real CALL-E and real LLM-evaluator paths against real credentials, and update this README's status once that happens.
- Tune next-review intervals against real usage data instead of a fixed heuristic.

---

## Repository layout

```
backend/
  src/
    app.js            Express app (routes) -- imported by both server.js and the tests
    server.js          thin entry point (dotenv + app.listen)
    db.js               SQLite schema + connection
    auth.js             session tokens + requireAuth middleware
    memory.js           memory-state derivation + next-review scheduling
    calle/
      schema.js          the Skill's assessment JSON schema + CALL-E task builder
      mockAdapter.js      typed 2-turn call simulation
      realAdapter.js      @call-e/calle SDK integration
      index.js            mock/real factory
    evaluator/
      deterministic.js    JS port of the Skill's evaluator.py
      llm.js               Anthropic Messages API evaluator
      index.js              deterministic/llm factory
  tests/                43 tests, node:test
frontend/
  src/
    lib/api.ts           typed, token-aware API client
    pages/                LandingPage, SignupPage, LoginPage, DashboardPage
submission/
  DEMO_VIDEO_SCRIPT.md
  DEVPOST_DESCRIPTION.md
  PR_DESCRIPTION.md
```
