// Real "AI evaluation" provider. Used only when EVAL_MODE=llm and
// ANTHROPIC_API_KEY is set. This talks to Anthropic's real, documented
// Messages API (https://docs.claude.com/en/api/messages) -- nothing
// here is invented. If the request fails for any reason, this throws
// rather than silently pretending to succeed with a fake result
// (see honesty rule: never claim "AI evaluation" when it didn't
// actually run).

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

const { validateAssessment } = require("../calle/schema");

function buildPrompt({ topic, studyContext, learnerResponse }) {
  return `You are an educational active-recall evaluator for Synora, an AI learning-memory companion.

Your job is to evaluate what a learner actually remembers, based ONLY on their spoken/typed explanation.

Topic:
${topic}

Study context (the source of truth -- do not introduce facts beyond this):
${studyContext}

Learner response:
${learnerResponse}

Rules:
1. Compare the learner response against the study context only.
2. Do not invent facts that are not supported by the study context.
3. Distinguish uncertainty or forgetting from a genuine misconception.
4. Only record a misconception when the learner's response provides real evidence for it.
5. Be honest about missing concepts.
6. Return ONLY valid JSON, no markdown code fences, no commentary before or after.

Return exactly this structure:

{
  "topic": "${topic.replace(/"/g, '\\"')}",
  "recall_score": 0,
  "status": "strong|good|partial|weak|misconception_detected",
  "concepts_remembered": [],
  "weak_areas": [],
  "misconceptions": [
    {
      "concept": "",
      "student_belief": "",
      "correct_understanding": "",
      "evidence_from_response": ""
    }
  ],
  "confidence": "high|medium|low",
  "summary": "",
  "recommended_next_review": ""
}

Scoring guidance:
90-100 = strong recall
75-89 = good recall
50-74 = partial recall
0-49 = weak recall

Use "misconception_detected" as the status when a genuine misconception is supported by the learner's response, even if that lowers the numeric score.

The recommended review interval should normally be one of: "1 day", "3 days", "7 days", "14 days", "30 days".`;
}

function extractJson(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  return JSON.parse(candidate);
}

async function evaluateWithLLM({ topic, studyContext, learnerResponse }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      "EVAL_MODE=llm requires ANTHROPIC_API_KEY to be set."
    );
  }

  if (!topic || !topic.trim()) {
    throw new Error("topic is required");
  }

  if (!studyContext || !studyContext.trim()) {
    throw new Error("study_context is required");
  }

  if (!learnerResponse || !learnerResponse.trim()) {
    throw new Error("learner_response is required");
  }

  const model = process.env.ANTHROPIC_EVAL_MODEL || DEFAULT_MODEL;

  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: buildPrompt({ topic, studyContext, learnerResponse }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw new Error(
      `Anthropic API request failed (${response.status}): ${bodyText.slice(0, 300)}`
    );
  }

  const data = await response.json();
  const textBlock = (data.content || []).find(
    (block) => block.type === "text"
  );

  if (!textBlock || !textBlock.text) {
    throw new Error("Anthropic API response did not contain text output.");
  }

  let assessment;
  try {
    assessment = extractJson(textBlock.text);
  } catch (error) {
    throw new Error(
      `LLM output was not valid assessment JSON: ${error.message}`
    );
  }

  return validateAssessment(assessment);
}

module.exports = { evaluateWithLLM };
