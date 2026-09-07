const { test } = require("node:test");
const assert = require("node:assert/strict");

const { evaluateDeterministic } = require("../src/evaluator/deterministic");

const topic = "Cryptography";
const studyContext = "Hashing, encryption, digital signatures, salts.";

test("detects the canonical hashing/decryption misconception", () => {
  const result = evaluateDeterministic({
    topic,
    studyContext,
    learnerResponse: "Hashing encrypts data so it can be decrypted later.",
  });

  assert.equal(result.status, "misconception_detected");
  assert.equal(result.misconceptions.length, 1);
  assert.equal(result.misconceptions[0].concept, "Hashing vs encryption");
  assert.equal(result.recommended_next_review, "1 day");
});

test("does not fabricate a misconception when there is no evidence for one", () => {
  const result = evaluateDeterministic({
    topic,
    studyContext,
    learnerResponse:
      "Hashing takes an input and produces a fixed-size irreversible digest, used for password storage. Encryption is reversible with the right key.",
  });

  assert.equal(result.misconceptions.length, 0);
  assert.equal(result.status, "good");
});

test("a mostly-empty or unrelated answer scores weak, not a fabricated pass", () => {
  const result = evaluateDeterministic({
    topic,
    studyContext,
    learnerResponse: "I don't really remember, something about computers.",
  });

  assert.equal(result.status, "weak");
  assert.equal(result.misconceptions.length, 0);
});

test("throws on missing topic/context/response instead of guessing", () => {
  assert.throws(() =>
    evaluateDeterministic({ topic: "", studyContext, learnerResponse: "x" })
  );
  assert.throws(() =>
    evaluateDeterministic({ topic, studyContext: "", learnerResponse: "x" })
  );
  assert.throws(() =>
    evaluateDeterministic({ topic, studyContext, learnerResponse: "" })
  );
});

test("every returned assessment matches the Skill's required shape", () => {
  const result = evaluateDeterministic({
    topic,
    studyContext,
    learnerResponse: "Hashing is one-way, encryption is reversible.",
  });

  for (const field of [
    "topic",
    "recall_score",
    "status",
    "concepts_remembered",
    "weak_areas",
    "misconceptions",
    "confidence",
    "summary",
    "recommended_next_review",
  ]) {
    assert.ok(field in result, `missing field: ${field}`);
  }
});
