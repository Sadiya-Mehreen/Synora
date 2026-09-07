# Synora

**Your brain forgets. Synora doesn't.**

## Inspiration

Most study tools test recognition, not recall. You can pass a quiz and still not really understand the material -- or worse, hold a confident misconception that a multiple-choice test would never surface. We wanted a tool that tests the way a good tutor does: by making you explain the idea out loud, and listening for where your explanation is actually wrong.

## What it does

Synora is an AI learning-recall companion. You tell it what you're studying; it calls you (through CALL-E) to test what you actually remember. You explain the concept in your own words. Synora asks one adaptive follow-up based on your answer, evaluates the whole exchange, and -- critically -- distinguishes "you forgot" from "you have a specific misconception." It updates a four-state memory model (Mastered / Fading / Forgotten / Misconception) per topic and adapts when it reviews you next, instead of pretending every topic decays on the same fixed schedule.

## How we built it

- **Frontend**: React + TypeScript + Vite, a custom sky/cloud design system (no UI framework).
- **Backend**: Node/Express + SQLite, with real server-issued session tokens (every request's identity comes from a verified token, never a client-supplied ID).
- **CALL-E Skill**: we built around the community `learning-recall-call` Skill's call flow and its exact output contract (`recall_score`, `status`, `concepts_remembered`, `weak_areas`, `misconceptions`, `recommended_next_review`) rather than inventing our own.
- **CALL-E integration**: real calls go through the official `@call-e/calle` SDK -- the Skill's instructions become the call's `task`, and a JSON Schema mirroring the Skill's contract is passed so CALL-E returns a structured result.
- **Mock mode**: since we didn't have live CALL-E credentials during the hackathon, we built a genuinely useful dry-run mode -- a typed 2-turn simulation of the same call flow -- so the whole product (adaptive follow-ups, misconception detection, memory-state updates) is fully demoable and testable without any external dependency. A visible badge always shows whether you're looking at a mock or real result.
- **Evaluation**: a deterministic evaluator (ported directly from the Skill's own reference `evaluator.py`) by default, with an optional real LLM evaluator (Anthropic's Messages API) behind an environment flag.

## Challenges we ran into

Building an honest mock/real split was harder than just hard-coding a demo. We wanted mock mode to be a genuinely useful development and testing tool -- not a fake -- so it had to run the real evaluation logic and produce a real, database-persisted result, just without a live phone call. We also had to be careful that scheduling a recall (recording intent) stayed clearly separate from starting one (actually running the call), since we don't have a background dispatcher in this MVP. During review we caught and fixed a real bug in the real-mode adapter: it had been hardcoding a US region/locale on every outbound call, which would have been wrong for a learner outside the US -- fixed to rely on the phone number's own country code instead of guessing.

## Accomplishments we're proud of

The misconception-detection path is the centerpiece: a learner can give an answer that's *superficially* plausible ("hashing encrypts data so it can be decrypted later") and Synora catches the specific conceptual error, explains the correct understanding, and shortens the next review -- all the way from the phone call through to the dashboard.

## What's next

A real background scheduler to actually dispatch calls at their scheduled time, spaced-repetition tuning based on real usage data instead of a fixed heuristic, and exercising the real CALL-E and real LLM paths against live credentials.
