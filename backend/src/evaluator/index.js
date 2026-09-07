const { evaluateDeterministic } = require("./deterministic");
const { evaluateWithLLM } = require("./llm");

function getEvalMode() {
  const raw = (process.env.EVAL_MODE || "deterministic").toLowerCase();
  return raw === "llm" ? "llm" : "deterministic";
}

function isLLMConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// Returns { assessment, evaluatorMode } so callers always know
// honestly whether a real model or the deterministic fallback
// actually produced the result -- never label a deterministic
// result as "AI evaluation".
async function evaluate({ topic, studyContext, learnerResponse }) {
  const mode = getEvalMode();

  if (mode === "llm" && isLLMConfigured()) {
    const assessment = await evaluateWithLLM({
      topic,
      studyContext,
      learnerResponse,
    });
    return { assessment, evaluatorMode: "llm" };
  }

  const assessment = evaluateDeterministic({
    topic,
    studyContext,
    learnerResponse,
  });
  return { assessment, evaluatorMode: "deterministic" };
}

module.exports = { evaluate, getEvalMode, isLLMConfigured };
