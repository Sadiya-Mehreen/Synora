// This module encodes the OUTPUT CONTRACT of the learning-recall-call
// Skill (see skills/learning-recall-call/SKILL.md in the CALL-E
// community repo). It is intentionally kept in sync with
// evaluator.py / llm_evaluator.py's field names so that:
//
//   - the mock adapter (Synora's own evaluator) and
//   - the real adapter (CALL-E actually running the Skill on a phone
//     call and returning a structuredResult)
//
// produce assessments that look identical to the rest of the app.
//
// Field names on purpose match the Skill's real JSON output
// (recall_score / status / concepts_remembered / weak_areas /
// recommended_next_review), NOT an invented shape.

const VALID_STATUSES = [
  "strong",
  "good",
  "partial",
  "weak",
  "misconception_detected",
];

const VALID_CONFIDENCE = ["high", "medium", "low"];

// JSON Schema handed to CALL-E as `resultSchema` so its own model
// returns a structured result in exactly this shape after a real
// phone call.
const RECALL_RESULT_SCHEMA = {
  type: "object",
  required: [
    "topic",
    "recall_score",
    "status",
    "concepts_remembered",
    "weak_areas",
    "misconceptions",
    "confidence",
    "summary",
    "recommended_next_review",
  ],
  properties: {
    topic: { type: "string" },
    recall_score: { type: "integer", minimum: 0, maximum: 100 },
    status: { type: "string", enum: VALID_STATUSES },
    concepts_remembered: {
      type: "array",
      items: { type: "string" },
    },
    weak_areas: {
      type: "array",
      items: { type: "string" },
    },
    misconceptions: {
      type: "array",
      items: {
        type: "object",
        required: [
          "concept",
          "student_belief",
          "correct_understanding",
          "evidence_from_response",
        ],
        properties: {
          concept: { type: "string" },
          student_belief: { type: "string" },
          correct_understanding: { type: "string" },
          evidence_from_response: { type: "string" },
        },
      },
    },
    confidence: { type: "string", enum: VALID_CONFIDENCE },
    summary: { type: "string" },
    recommended_next_review: { type: "string" },
  },
};

// Builds the CALL-E `task` string for a real phone call. This is the
// learning-recall-call Skill's call flow, restated as an instruction
// to CALL-E's own conversational model, parameterized with this
// learner's topic/context. Nothing here invents CALL-E API behavior --
// `task` is just the plain-text instruction CALL-E's agent follows
// during the call, per the real SDK's `CreateCallInput.task: string`.
function buildRecallCallTask({
  topic,
  studyContext,
  learnerName,
  previousScore,
  weakAreas,
}) {
  const lines = [
    "You are Synora, an AI learning-recall companion, calling to test what the learner actually remembers about a topic they previously studied.",
    "Follow the learning-recall-call skill: introduce yourself briefly, ask one open-ended question that requires the learner to explain the concept in their own words, listen, then ask exactly one adaptive follow-up question based on their answer before ending the call.",
    "Do not ask more than two questions in total. Do not give the answer before the learner attempts recall. Be encouraging, never shame the learner for forgetting.",
    "Distinguish uncertainty or forgetting from a genuine misconception. Only record a misconception when the learner's response provides real evidence for it -- do not invent one.",
    `Topic: ${topic}`,
    `Study context (source of truth -- do not introduce facts beyond this): ${studyContext}`,
  ];

  if (learnerName) {
    lines.push(`Learner name: ${learnerName}`);
  }

  if (typeof previousScore === "number") {
    lines.push(`Previous recall score: ${previousScore}`);
  }

  if (Array.isArray(weakAreas) && weakAreas.length > 0) {
    lines.push(`Previously weak areas to probe: ${weakAreas.join(", ")}`);
  }

  lines.push(
    "At the end of the call, produce the structured assessment described by the provided result schema. Base every field only on what the learner actually said."
  );

  return lines.join("\n");
}

function validateAssessment(assessment) {
  const required = [
    "topic",
    "recall_score",
    "status",
    "concepts_remembered",
    "weak_areas",
    "misconceptions",
    "confidence",
    "summary",
    "recommended_next_review",
  ];

  for (const field of required) {
    if (!(field in assessment)) {
      throw new Error(`Missing required assessment field: ${field}`);
    }
  }

  if (!Number.isInteger(assessment.recall_score)) {
    throw new Error("recall_score must be an integer.");
  }

  if (assessment.recall_score < 0 || assessment.recall_score > 100) {
    throw new Error("recall_score must be between 0 and 100.");
  }

  if (!Array.isArray(assessment.concepts_remembered)) {
    throw new Error("concepts_remembered must be a list.");
  }

  if (!Array.isArray(assessment.weak_areas)) {
    throw new Error("weak_areas must be a list.");
  }

  if (!Array.isArray(assessment.misconceptions)) {
    throw new Error("misconceptions must be a list.");
  }

  if (!VALID_STATUSES.includes(assessment.status)) {
    throw new Error(`Invalid status: ${assessment.status}`);
  }

  if (!VALID_CONFIDENCE.includes(assessment.confidence)) {
    throw new Error(`Invalid confidence: ${assessment.confidence}`);
  }

  return assessment;
}

module.exports = {
  VALID_STATUSES,
  VALID_CONFIDENCE,
  RECALL_RESULT_SCHEMA,
  buildRecallCallTask,
  validateAssessment,
};
