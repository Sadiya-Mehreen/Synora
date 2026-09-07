const path = require("path");
const os = require("os");
const { test } = require("node:test");
const assert = require("node:assert/strict");

// This file talks to src/memory (and transitively src/db) directly
// rather than through the HTTP app, so it needs its own isolated
// database path just like helpers.js does for the HTTP-level tests.
process.env.SYNORA_DB_PATH = path.join(
  os.tmpdir(),
  `synora-test-memory-${process.pid}-${Date.now()}.db`
);

const { deriveMemoryState, computeNextReviewDate } = require("../src/memory");

test("a misconception always wins regardless of score", () => {
  const state = deriveMemoryState({
    recall_score: 95,
    misconceptions: [{ concept: "x" }],
  });
  assert.equal(state, "misconception");
});

test("high score with no misconception is mastered", () => {
  assert.equal(
    deriveMemoryState({ recall_score: 90, misconceptions: [] }),
    "mastered"
  );
});

test("mid score with no misconception is fading", () => {
  assert.equal(
    deriveMemoryState({ recall_score: 70, misconceptions: [] }),
    "fading"
  );
});

test("low score with no misconception is forgotten", () => {
  assert.equal(
    deriveMemoryState({ recall_score: 20, misconceptions: [] }),
    "forgotten"
  );
});

test("next review date advances by the recommended interval", () => {
  const now = new Date();
  const oneDay = computeNextReviewDate("1 day");
  const thirtyDays = computeNextReviewDate("30 days");

  const diffOne = Math.round((oneDay - now) / (1000 * 60 * 60 * 24));
  const diffThirty = Math.round((thirtyDays - now) / (1000 * 60 * 60 * 24));

  assert.equal(diffOne, 1);
  assert.equal(diffThirty, 30);
});

test("an unrecognized interval falls back to a short, safe default instead of guessing", () => {
  const now = new Date();
  const fallback = computeNextReviewDate("some nonsense string");
  const diff = Math.round((fallback - now) / (1000 * 60 * 60 * 24));
  assert.equal(diff, 1);
});
