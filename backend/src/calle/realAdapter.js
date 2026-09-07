// REAL CALL-E ADAPTER
//
// Uses the official @call-e/calle TypeScript/JS server SDK
// (https://www.npmjs.com/package/@call-e/calle, docs at
// https://docs.heycall-e.com/). This module was written against the
// SDK's actual shipped type declarations -- CalleClient, calls.create,
// calls.createAndWait -- not invented. See README section
// "CALL-E integration" for exactly what was verified and how.
//
// @call-e/calle is an ESM-only package; this backend is CommonJS, so
// it is loaded with a dynamic import(), same technique used by the
// community reference implementation (apps/typescript/ai-front-desk)
// in the CALL-E awesome-phone-call-agents repo.

const { RECALL_RESULT_SCHEMA, buildRecallCallTask, validateAssessment } =
  require("./schema");

const CALLE_DEFAULT_BASE_URL = "https://api.heycall-e.com";
const WAIT_OPTIONS = { timeoutMs: 5 * 60 * 1000, intervalMs: 5000 };

function isConfigured() {
  return Boolean(process.env.CALLE_API_KEY);
}

function maskPhone(phone) {
  if (!phone || phone.length < 6) {
    return "•••";
  }
  return `${phone.slice(0, 4)}*****${phone.slice(-4)}`;
}

// Places one real outbound learning-recall phone call and waits for
// CALL-E to return the final structured result. Throws on any
// failure -- callers must mark the recall_session as 'failed' rather
// than fabricate a result (see the Skill's own Error Handling
// section: "do not falsely report that the call occurred").
async function runRealCall({
  subject,
  phoneNumber,
  learnerName,
  previousScore,
  weakAreas,
  idempotencyKey,
}) {
  if (!isConfigured()) {
    throw new Error(
      "Real CALL-E mode requires CALLE_API_KEY. Set MOCK_CALL_E=true for development."
    );
  }

  if (!phoneNumber) {
    throw new Error(
      "A phone number is required for a real CALL-E call."
    );
  }

  if (!/^\+[1-9]\d{6,14}$/.test(phoneNumber)) {
    throw new Error(
      "Phone number must be in E.164 format (e.g. +15555550123)."
    );
  }

  const { CalleClient } = await import("@call-e/calle");

  const client = new CalleClient({
    apiKey: process.env.CALLE_API_KEY,
    baseUrl: process.env.CALLE_BASE_URL || CALLE_DEFAULT_BASE_URL,
  });

  const task = buildRecallCallTask({
    topic: subject.name,
    studyContext: subject.description || subject.name,
    learnerName,
    previousScore,
    weakAreas,
  });

  console.log(
    `[calle:LIVE] placing recall call | topic="${subject.name}" phone=${maskPhone(phoneNumber)}`
  );

  const call = await client.calls.createAndWait(
    {
      task,
      // region/locale are optional routing/language *hints* per the
      // real SDK schema -- they are not required, and Synora doesn't
      // actually know the learner's region or spoken-language
      // preference independent of their phone number. The E.164
      // phone number itself already encodes the country calling
      // code, so we deliberately omit these rather than hardcoding a
      // value (e.g. "US") that would be wrong for, say, an Indian
      // (+91) learner.
      recipients: [{ phones: [phoneNumber] }],
      resultSchema: RECALL_RESULT_SCHEMA,
      metadata: { app: "synora", subject_id: String(subject.id) },
    },
    { idempotencyKey, ...WAIT_OPTIONS }
  );

  if (call.status !== "completed" || !call.structuredResult) {
    const reason =
      call.failureMessage ||
      call.summary ||
      `Call ended with status "${call.status}" and no structured result.`;
    throw new Error(reason);
  }

  const assessment = validateAssessment(call.structuredResult);

  return {
    assessment,
    callProviderId: call.id,
    transcriptSummary: call.summary || null,
  };
}

module.exports = { runRealCall, isConfigured, maskPhone };
