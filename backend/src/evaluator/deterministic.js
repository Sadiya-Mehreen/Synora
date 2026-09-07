// Provider-agnostic, dependency-free "AI evaluation" used when
// EVAL_MODE=deterministic (the default, and the only option that
// works with zero credentials). This is a direct JS port of the
// learning-recall-call Skill's scripts/evaluator.py
// DeterministicRecallEvaluator, so the canonical hackathon demo
// scenario (topic "Hashing vs Encryption", answer mentioning
// "decrypt") produces byte-for-byte the same assessment shape as the
// Python reference implementation.
//
// For any OTHER topic, it falls back to a simple, transparent
// keyword-overlap heuristic. This is intentionally NOT presented as
// real language understanding -- see EVAL_MODE=llm for that.

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 3);
}

function evaluateDeterministic({ topic, studyContext, learnerResponse }) {
  if (!topic || !topic.trim()) {
    throw new Error("topic is required");
  }

  if (!studyContext || !studyContext.trim()) {
    throw new Error("study_context is required");
  }

  if (!learnerResponse || !learnerResponse.trim()) {
    throw new Error("learner_response is required");
  }

  const response = learnerResponse.toLowerCase();
  const context = studyContext.toLowerCase();

  const misconceptions = [];
  const weakAreas = [];
  const conceptsRemembered = [];

  // Deterministic test behavior for the canonical hackathon demo
  // scenario (Skill's evaluator.py DeterministicRecallEvaluator),
  // ported 1:1. This is pattern-based on the response itself rather
  // than gated on an exact topic title, because the product's own
  // demo scenario (spec section 29) names the topic "Cryptography"
  // with a study context mentioning hashing and encryption -- the
  // underlying misconception pattern is what matters, not the title.
  const topicMentionsCrypto =
    /hash|encrypt/.test(context) || /hash|encrypt/.test(topic.toLowerCase());

  if (topicMentionsCrypto) {
    if (response.includes("hash")) {
      conceptsRemembered.push(
        "Hashing is relevant to password-related systems"
      );
    }

    if (response.includes("hash") && response.includes("decrypt")) {
      misconceptions.push({
        concept: "Hashing vs encryption",
        student_belief: "Hashing is reversible encryption.",
        correct_understanding:
          "Hashing is generally one-way, while encryption is designed " +
          "to allow data to be recovered using the appropriate key.",
        evidence_from_response:
          "The learner described hashing as something that can be " +
          "decrypted later.",
      });

      weakAreas.push("Hashing vs encryption");

      return finalize(topic, misconceptions, conceptsRemembered, weakAreas);
    }

    if (conceptsRemembered.length > 0) {
      return finalize(topic, misconceptions, conceptsRemembered, weakAreas);
    }
  }

  // Generic fallback: transparent keyword overlap against the study
  // context. This is a heuristic, not genuine language understanding
  // -- it exists so the deterministic evaluator still produces a
  // sensible, honest result for topics beyond the canonical demo.
  const contextWords = new Set(tokenize(studyContext));
  const responseWords = new Set(tokenize(learnerResponse));

  const overlap = [...contextWords].filter((word) =>
    responseWords.has(word)
  );

  const overlapRatio =
    contextWords.size === 0 ? 0 : overlap.length / contextWords.size;

  if (overlapRatio >= 0.35) {
    conceptsRemembered.push(
      "The learner's explanation shares significant vocabulary with the study context."
    );
  } else if (overlapRatio >= 0.15) {
    conceptsRemembered.push(
      "The learner's explanation shares some vocabulary with the study context."
    );
    weakAreas.push(
      "Several concepts from the study context were not mentioned."
    );
  } else {
    weakAreas.push(
      "The learner's explanation does not overlap much with the study context."
    );
  }

  return finalize(topic, misconceptions, conceptsRemembered, weakAreas);
}

function finalize(topic, misconceptions, conceptsRemembered, weakAreas) {
  let score;
  let status;
  let confidence;
  let nextReview;
  let summary;

  if (misconceptions.length > 0) {
    score = 55;
    status = "misconception_detected";
    confidence = "medium";
    nextReview = "1 day";
    summary =
      "The learner remembers that the topic relates to what they " +
      "studied but appears to hold a specific misconception.";
  } else if (conceptsRemembered.length > 0 && weakAreas.length === 0) {
    score = 80;
    status = "good";
    confidence = "medium";
    nextReview = "3 days";
    summary =
      "The learner demonstrated useful recall of the topic without a " +
      "major misconception being detected.";
  } else if (conceptsRemembered.length > 0) {
    score = 65;
    status = "partial";
    confidence = "medium";
    nextReview = "1 day";
    summary =
      "The learner remembers some of the topic but has notable gaps.";
  } else {
    score = 40;
    status = "weak";
    confidence = "low";
    nextReview = "1 day";
    summary =
      "The learner did not demonstrate enough evidence of " +
      "understanding to establish strong recall.";
  }

  return {
    topic,
    recall_score: score,
    status,
    concepts_remembered: conceptsRemembered,
    weak_areas: weakAreas,
    misconceptions,
    confidence,
    summary,
    recommended_next_review: nextReview,
  };
}

module.exports = { evaluateDeterministic };
