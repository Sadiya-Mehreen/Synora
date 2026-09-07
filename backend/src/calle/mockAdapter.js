// MOCK CALL-E ADAPTER
//
// No real phone call is placed here -- this exists purely so
// development and demoing can continue without CALL-E credentials
// (per the Skill's own "Dry Run" safety requirement). It simulates
// the conversational shape of the learning-recall-call Skill
// (one open question, one adaptive follow-up, then a final
// evaluation) by asking the learner to TYPE what they would say on
// the call, and running their typed answer through Synora's real
// evaluator (deterministic or LLM, see src/evaluator).
//
// This is clearly surfaced to the user as MOCK, never presented as a
// real CALL-E call (see server.js system status + session.mode).

function openingQuestion(subject) {
  return (
    `Hi! This is Synora. You've been studying ${subject.name}. ` +
    `Without looking at your notes, can you explain ${subject.name} ` +
    `to me as if you were teaching it to someone who has never learned it?`
  );
}

// Adaptive follow-up per the Skill's Section 4 guidance: probe a
// weak/misconception area if one was found, otherwise raise the bar
// with an application question.
function followUpQuestion(subject, firstAssessment) {
  if (
    firstAssessment.misconceptions &&
    firstAssessment.misconceptions.length > 0
  ) {
    const misconception = firstAssessment.misconceptions[0];
    return (
      `That's a common mix-up worth double-checking. ${misconception.correct_understanding} ` +
      `Given that, how would you now describe ${misconception.concept.toLowerCase()}?`
    );
  }

  if (firstAssessment.weak_areas && firstAssessment.weak_areas.length > 0) {
    return (
      `Good start. Let's go a bit deeper -- can you say more about ` +
      `${firstAssessment.weak_areas[0].toLowerCase()}?`
    );
  }

  return (
    `Nice, that's solid. One more: can you give a concrete example of ` +
    `when you'd actually use ${subject.name}, or why it matters in practice?`
  );
}

module.exports = { openingQuestion, followUpQuestion };
