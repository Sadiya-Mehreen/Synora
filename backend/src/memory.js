const db = require("./db");

// Synora's own derived mapping from the Skill's assessment onto the
// four-state model described in the product spec. This mapping is a
// simple, transparent heuristic -- not a scientifically validated
// spaced-repetition algorithm -- and is documented as such.
//
//   misconception detected  -> MISCONCEPTION (always wins, regardless of score)
//   recall_score >= 85      -> MASTERED
//   recall_score >= 60      -> FADING
//   otherwise               -> FORGOTTEN
function deriveMemoryState(assessment) {
  if (assessment.misconceptions && assessment.misconceptions.length > 0) {
    return "misconception";
  }
  if (assessment.recall_score >= 85) {
    return "mastered";
  }
  if (assessment.recall_score >= 60) {
    return "fading";
  }
  return "forgotten";
}

const MEMORY_STATE_DISPLAY = {
  mastered: { status: "Mastered", statusClass: "mastered" },
  fading: { status: "Fading", statusClass: "fading" },
  forgotten: { status: "Forgotten", statusClass: "forgotten" },
  misconception: { status: "Misconception", statusClass: "misconception" },
};

// The Skill recommends next-review intervals as human strings ("1
// day", "3 days", ...). This turns that into an actual calendar date
// for the dashboard, falling back to a short interval if the string
// isn't one of the expected values (never guess a scientifically
// precise number -- see product philosophy: no fake precision).
const INTERVAL_DAYS = {
  "1 day": 1,
  "3 days": 3,
  "7 days": 7,
  "14 days": 14,
  "30 days": 30,
};

function computeNextReviewDate(recommendedNextReview) {
  const days = INTERVAL_DAYS[recommendedNextReview] || 1;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function formatDateShort(date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Applies a finished evaluation to the rest of the system: updates
// the subject's displayed memory state/percentage/last-reviewed/
// next-review, records a misconceptions row for each detected
// misconception, and appends a memory_history entry.
function applyEvaluationResult({ userId, subjectId, sessionId, assessment }) {
  const memoryState = deriveMemoryState(assessment);
  const display = MEMORY_STATE_DISPLAY[memoryState];
  const nextReviewDate = computeNextReviewDate(
    assessment.recommended_next_review
  );

  db.prepare(
    `
    UPDATE subjects
    SET
      percentage = ?,
      status = ?,
      status_class = ?,
      last_reviewed = ?,
      next_review = ?
    WHERE id = ? AND user_id = ?
    `
  ).run(
    assessment.recall_score,
    display.status,
    display.statusClass,
    formatDateShort(new Date()),
    formatDateShort(nextReviewDate),
    subjectId,
    userId
  );

  for (const misconception of assessment.misconceptions || []) {
    db.prepare(
      `
      INSERT INTO misconceptions (
        user_id, subject_id, session_id,
        concept, student_belief, correct_understanding, evidence_from_response
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      userId,
      subjectId,
      sessionId,
      misconception.concept || "",
      misconception.student_belief || "",
      misconception.correct_understanding || "",
      misconception.evidence_from_response || ""
    );
  }

  db.prepare(
    `
    INSERT INTO memory_history (user_id, subject_id, session_id, score, memory_state)
    VALUES (?, ?, ?, ?, ?)
    `
  ).run(userId, subjectId, sessionId, assessment.recall_score, memoryState);

  return { memoryState, display, nextReviewDate: formatDateShort(nextReviewDate) };
}

module.exports = {
  deriveMemoryState,
  MEMORY_STATE_DISPLAY,
  computeNextReviewDate,
  formatDateShort,
  applyEvaluationResult,
};
