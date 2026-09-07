# Add Synora -- AI learning-recall companion built on the `learning-recall-call` Skill

## What this adds

Synora is a full-stack learning app (React/TS frontend, Express/SQLite backend) built around the `learning-recall-call` CALL-E Skill. It calls learners to test what they actually remember about a topic they studied, detects conceptual misconceptions (not just right/wrong), and adapts what gets reviewed next.

This PR adds Synora's writeup and a link to its repository under the appropriate category so other builders can see a complete, non-trivial application of the Skill (persistence, auth, an adaptive two-turn call flow, and a mock/real adapter split for development without live credentials).

## How CALL-E is used

- The `learning-recall-call` Skill's call flow and output contract (`recall_score`, `status`, `concepts_remembered`, `weak_areas`, `misconceptions`, `recommended_next_review`) are used verbatim as Synora's internal data model -- Synora does not reinvent this shape.
- **Real mode** (`MOCK_CALL_E=false`): the official `@call-e/calle` SDK places a real outbound call. The Skill's instructions, parameterized with the learner's topic/study context/weak areas, become the `task` sent to CALL-E; a JSON Schema mirroring the Skill's output is passed as `resultSchema`; the call is awaited via `client.calls.createAndWait(...)`.
- **Mock mode** (default, `MOCK_CALL_E=true`): since no live CALL-E credentials were available during development, a typed 2-turn simulation stands in for the phone call so the rest of the system (evaluation, misconception detection, memory-state updates, adaptive scheduling) can be built, tested, and demoed honestly. The app always shows a visible MOCK/REAL badge and the mode is exposed at `/api/system/status` -- mock results are never presented as real calls.

## What's real vs. what's mocked (honesty statement)

| Piece | Status |
|---|---|
| `learning-recall-call` Skill integration (task/schema construction) | Real, built against the Skill as provided |
| `@call-e/calle` SDK usage | Real code, built against the actual published SDK's types; **not yet exercised against a live account** (no credentials available in the dev environment) |
| Mock call simulation | Real (this is the primary, fully working demo path) |
| Misconception detection, adaptive follow-up, memory-state engine | Real, fully working in mock mode |
| Deterministic evaluator | Real, a JS port of the Skill's own `evaluator.py` |
| LLM evaluator (Anthropic) | Real code; not yet exercised live (no API key available in the dev environment) |

## Verification

43 automated backend tests (`node --test`, zero new test dependency) pass, covering auth, ownership isolation across every user-owned resource, the full mock recall-session flow, and the canonical misconception scenario end-to-end. The same scenario was additionally run manually against the live backend and checked directly in SQLite. Frontend TypeScript build, production build, and lint all pass with zero errors. One real bug was caught and fixed during review: the real adapter originally hardcoded `region: "US"` / `locale: "en-US"` on every call, which the actual SDK schema documents as optional hints -- fixed to omit them so routing isn't wrong for non-US phone numbers.

## Links

- Repository: *(add link)*
- Demo video (<3 min): *(add link)*
- README with setup instructions: `README.md` at the repository root
