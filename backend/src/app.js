const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");

const db = require("./db");
const { issueToken, revokeToken, requireAuth } = require("./auth");
const calle = require("./calle");
const evaluator = require("./evaluator");
const memory = require("./memory");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Synora backend is running 🚀",
  });
});

// =====================================================
// SIGNUP
// =====================================================

app.post("/api/auth/signup", async (req, res) => {
  try {
    const {
  name,
  email,
  password,
  phoneNumber,
  callConsent,
} = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters.",
      });
    }

    const existingUser = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(email);

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const consentGranted = Boolean(callConsent);

const result = db
  .prepare(
    `
    INSERT INTO users (
      name,
      email,
      password,
      phone_number,
      call_consent,
      call_consent_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `
  )
  .run(
    name,
    email,
    hashedPassword,
    phoneNumber || null,
    consentGranted ? 1 : 0,
    consentGranted ? new Date().toISOString() : null
  );

    const userId = Number(result.lastInsertRowid);
    const token = issueToken(userId);

    res.status(201).json({
      message: "Account created successfully.",
      token,
      user: {
        id: userId,
        name,
        email,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);

    res.status(500).json({
      message: "Something went wrong while creating your account.",
    });
  }
});

// =====================================================
// LOGIN
// =====================================================

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const user = db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email);

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const token = issueToken(Number(user.id));

    res.json({
      message: "Login successful.",
      token,
      user: {
        id: Number(user.id),
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      message: "Something went wrong while logging in.",
    });
  }
});

// =====================================================
// LOGOUT
// =====================================================

app.post("/api/auth/logout", requireAuth, (req, res) => {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1].trim() : null;

  if (token) {
    revokeToken(token);
  }

  res.json({ message: "Logged out." });
});

// =====================================================
// CURRENT USER / CONSENT
// =====================================================

app.get("/api/users/me", requireAuth, (req, res) => {
  try {
    const user = db
      .prepare(
        `
        SELECT
          id,
          name,
          email,
          phone_number AS phoneNumber,
          call_consent AS callConsent,
          call_consent_at AS callConsentAt
        FROM users
        WHERE id = ?
        `
      )
      .get(req.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json({
      user: {
        ...user,
        callConsent: Boolean(user.callConsent),
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);

    res.status(500).json({ message: "Could not load your profile." });
  }
});

app.patch("/api/users/me/consent", requireAuth, (req, res) => {
  try {
    const { phoneNumber, callConsent } = req.body;
    const cleanPhone = phoneNumber ? String(phoneNumber).trim() : null;
    const consentGranted = Boolean(callConsent);

    const current = db
      .prepare("SELECT call_consent, call_consent_at FROM users WHERE id = ?")
      .get(req.userId);

    if (!current) {
      return res.status(404).json({ message: "User not found." });
    }

    // Only stamp a fresh consent timestamp the moment consent turns
    // on. If it was already on, keep the original grant time.
    const consentAt = consentGranted
      ? current.call_consent_at || new Date().toISOString()
      : current.call_consent_at;

    db.prepare(
      `
      UPDATE users
      SET phone_number = ?, call_consent = ?, call_consent_at = ?
      WHERE id = ?
      `
    ).run(cleanPhone, consentGranted ? 1 : 0, consentAt, req.userId);

    res.json({
      message: "Consent preferences updated.",
      user: {
        phoneNumber: cleanPhone,
        callConsent: consentGranted,
        callConsentAt: consentAt,
      },
    });
  } catch (error) {
    console.error("Update consent error:", error);

    res.status(500).json({ message: "Could not update consent preferences." });
  }
});

// =====================================================
// SYSTEM STATUS (mock vs real -- never hide this from the user)
// =====================================================

app.get("/api/system/status", (req, res) => {
  const calleStatus = calle.getCallEStatus();

  res.json({
    callE: {
      mode: calleStatus.mockMode ? "mock" : "real",
      realAdapterConfigured: calleStatus.realAdapterConfigured,
    },
    evaluator: {
      mode: evaluator.getEvalMode(),
      llmConfigured: evaluator.isLLMConfigured(),
    },
  });
});

// =====================================================
// SUBJECTS
// =====================================================

// GET all subjects for a user
app.get("/api/subjects/:userId", requireAuth, (req, res) => {
  try {
    const userId = Number(req.params.userId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        message: "Invalid user ID.",
      });
    }

    // The URL still carries :userId for a minimal frontend diff, but
    // identity is never trusted from the client -- it must match the
    // authenticated session.
    if (userId !== req.userId) {
      return res.status(403).json({
        message: "You can only view your own subjects.",
      });
    }

    const subjects = db
      .prepare(
        `
        SELECT
          id,
          name,
          description,
          percentage,
          status,
          status_class AS statusClass,
          last_reviewed AS lastReviewed,
          next_review AS nextReview
        FROM subjects
        WHERE user_id = ?
        ORDER BY created_at ASC
        `
      )
      .all(userId);

    res.json({
      subjects,
    });
  } catch (error) {
    console.error("Get subjects error:", error);

    res.status(500).json({
      message: "Could not load subjects.",
    });
  }
});

// CREATE a subject
app.post("/api/subjects", requireAuth, (req, res) => {
  try {
    const { name, description = "" } = req.body;

    // Identity comes only from the verified session token -- any
    // userId the client might send in the body is ignored.
    const numericUserId = req.userId;
    const cleanName = String(name || "").trim();
    const cleanDescription = String(description || "").trim();

    if (!cleanName) {
      return res.status(400).json({
        message: "Subject name is required.",
      });
    }

    const result = db
      .prepare(
        `
        INSERT INTO subjects (
          user_id,
          name,
          description,
          percentage,
          status,
          status_class,
          last_reviewed,
          next_review
        )
        VALUES (
          ?,
          ?,
          ?,
          NULL,
          'Not assessed',
          'learning',
          'Not yet',
          'Schedule a recall'
        )
        `
      )
      .run(
        numericUserId,
        cleanName,
        cleanDescription
      );

    const subject = db
      .prepare(
        `
        SELECT
          id,
          name,
          description,
          percentage,
          status,
          status_class AS statusClass,
          last_reviewed AS lastReviewed,
          next_review AS nextReview
        FROM subjects
        WHERE id = ?
        `
      )
      .get(Number(result.lastInsertRowid));

    res.status(201).json({
      message: "Subject created successfully.",
      subject,
    });
  } catch (error) {
    console.error("Create subject error:", error);

    res.status(500).json({
      message: "Could not create subject.",
    });
  }
});

// =====================================================
// SCHEDULED RECALLS
// =====================================================

// GET all recalls for a user
app.get("/api/recalls/:userId", requireAuth, (req, res) => {
  try {
    const userId = Number(req.params.userId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        message: "Invalid user ID.",
      });
    }

    if (userId !== req.userId) {
      return res.status(403).json({
        message: "You can only view your own scheduled recalls.",
      });
    }

    const recalls = db
      .prepare(
        `
        SELECT
          scheduled_recalls.id,
          scheduled_recalls.subject_id AS subjectId,
          subjects.name AS topicName,
          scheduled_recalls.date,
          scheduled_recalls.time,
          scheduled_recalls.repeat
        FROM scheduled_recalls
        INNER JOIN subjects
          ON subjects.id = scheduled_recalls.subject_id
        WHERE scheduled_recalls.user_id = ?
        ORDER BY
          scheduled_recalls.date ASC,
          scheduled_recalls.time ASC
        `
      )
      .all(userId);

    res.json({
      recalls,
    });
  } catch (error) {
    console.error("Get recalls error:", error);

    res.status(500).json({
      message: "Could not load scheduled recalls.",
    });
  }
});

// CREATE a scheduled recall
app.post("/api/recalls", requireAuth, (req, res) => {
  try {
    const {
      subjectId,
      date,
      time,
      repeat = "Once",
    } = req.body;

    const numericUserId = req.userId;
    const numericSubjectId = Number(subjectId);

    if (
      !Number.isInteger(numericSubjectId) ||
      numericSubjectId <= 0
    ) {
      return res.status(400).json({
        message: "Invalid subject ID.",
      });
    }

    if (!date || !time) {
      return res.status(400).json({
        message: "Date and time are required.",
      });
    }

    const subject = db
      .prepare(
        "SELECT id, user_id, name FROM subjects WHERE id = ?"
      )
      .get(numericSubjectId);

    if (!subject) {
      return res.status(404).json({
        message: "Subject not found.",
      });
    }

    if (Number(subject.user_id) !== numericUserId) {
      return res.status(403).json({
        message: "You cannot schedule a recall for this subject.",
      });
    }

    const result = db
      .prepare(
        `
        INSERT INTO scheduled_recalls (
          user_id,
          subject_id,
          date,
          time,
          repeat
        )
        VALUES (?, ?, ?, ?, ?)
        `
      )
      .run(
        numericUserId,
        numericSubjectId,
        date,
        time,
        repeat
      );

    const recall = db
      .prepare(
        `
        SELECT
          scheduled_recalls.id,
          scheduled_recalls.subject_id AS subjectId,
          subjects.name AS topicName,
          scheduled_recalls.date,
          scheduled_recalls.time,
          scheduled_recalls.repeat
        FROM scheduled_recalls
        INNER JOIN subjects
          ON subjects.id = scheduled_recalls.subject_id
        WHERE scheduled_recalls.id = ?
        `
      )
      .get(Number(result.lastInsertRowid));

    res.status(201).json({
      message: "Recall scheduled successfully.",
      recall,
    });
  } catch (error) {
    console.error("Create recall error:", error);

    res.status(500).json({
      message: "Could not schedule recall.",
    });
  }
});

// CANCEL a scheduled recall
app.delete("/api/recalls/:id", requireAuth, (req, res) => {
  try {
    const recallId = Number(req.params.id);

    if (!Number.isInteger(recallId) || recallId <= 0) {
      return res.status(400).json({ message: "Invalid recall ID." });
    }

    const recall = db
      .prepare("SELECT id, user_id FROM scheduled_recalls WHERE id = ?")
      .get(recallId);

    if (!recall) {
      return res.status(404).json({ message: "Recall not found." });
    }

    if (Number(recall.user_id) !== req.userId) {
      return res.status(403).json({
        message: "You can only cancel your own scheduled recalls.",
      });
    }

    db.prepare("DELETE FROM scheduled_recalls WHERE id = ?").run(recallId);

    res.json({ message: "Recall cancelled." });
  } catch (error) {
    console.error("Cancel recall error:", error);

    res.status(500).json({ message: "Could not cancel recall." });
  }
});

// =====================================================
// RECALL SESSIONS -- the core CALL-E-powered experience
// =====================================================
//
// MOCK mode: an interactive, typed 2-turn simulation of the phone
// call (opening question -> adaptive follow-up -> final evaluation),
// evaluated by Synora's own evaluator (deterministic or LLM).
//
// REAL mode: a single real outbound call placed and conducted
// entirely by CALL-E per the learning-recall-call Skill instructions,
// synchronously awaited via the official @call-e/calle SDK.

function serializeEvaluationRow(row) {
  if (!row) return null;
  return {
    recallScore: row.recall_score,
    status: row.status,
    understanding: row.understanding,
    memoryState: row.memory_state,
    conceptsRemembered: JSON.parse(row.concepts_remembered || "[]"),
    weakAreas: JSON.parse(row.weak_areas || "[]"),
    misconceptions: JSON.parse(row.misconceptions || "[]"),
    confidence: row.confidence,
    summary: row.summary,
    followUpQuestion: row.follow_up_question,
    recommendedNextReview: row.recommended_next_review,
    evaluatorMode: row.evaluator_mode,
  };
}

function getOwnedSubject(subjectId, userId) {
  const subject = db
    .prepare(
      "SELECT id, user_id, name, description, percentage FROM subjects WHERE id = ?"
    )
    .get(subjectId);

  if (!subject || Number(subject.user_id) !== userId) {
    return null;
  }

  return subject;
}

function getRecentWeakAreas(subjectId) {
  const rows = db
    .prepare(
      `
      SELECT concept FROM misconceptions
      WHERE subject_id = ? AND resolved = 0
      ORDER BY created_at DESC
      LIMIT 3
      `
    )
    .all(subjectId);

  return rows.map((row) => row.concept);
}

function persistFinalEvaluation({ userId, subjectId, sessionId, assessment, evaluatorMode }) {
  const memoryState = memory.deriveMemoryState(assessment);

  db.prepare(
    `
    INSERT INTO evaluations (
      session_id, recall_score, status, understanding, memory_state,
      concepts_remembered, weak_areas, misconceptions, confidence,
      summary, recommended_next_review, evaluator_mode
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    sessionId,
    assessment.recall_score,
    assessment.status,
    assessment.status,
    memoryState,
    JSON.stringify(assessment.concepts_remembered || []),
    JSON.stringify(assessment.weak_areas || []),
    JSON.stringify(assessment.misconceptions || []),
    assessment.confidence,
    assessment.summary,
    assessment.recommended_next_review,
    evaluatorMode
  );

  const memoryResult = memory.applyEvaluationResult({
    userId,
    subjectId,
    sessionId,
    assessment,
  });

  db.prepare(
    `
    UPDATE recall_sessions
    SET status = 'completed', ended_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `
  ).run(sessionId);

  return memoryResult;
}

function buildSessionResponse(sessionId) {
  const session = db
    .prepare(
      `
      SELECT
        recall_sessions.id,
        recall_sessions.status,
        recall_sessions.mode,
        recall_sessions.failure_reason AS failureReason,
        recall_sessions.created_at AS createdAt,
        recall_sessions.ended_at AS endedAt,
        subjects.id AS subjectId,
        subjects.name AS subjectName,
        subjects.percentage AS subjectPercentage,
        subjects.status AS subjectStatus,
        subjects.status_class AS subjectStatusClass,
        subjects.next_review AS subjectNextReview
      FROM recall_sessions
      INNER JOIN subjects ON subjects.id = recall_sessions.subject_id
      WHERE recall_sessions.id = ?
      `
    )
    .get(sessionId);

  if (!session) return null;

  const questions = db
    .prepare(
      `
      SELECT
        recall_questions.id,
        recall_questions.sequence,
        recall_questions.question_text AS text,
        learner_answers.answer_text AS answerText
      FROM recall_questions
      LEFT JOIN learner_answers
        ON learner_answers.question_id = recall_questions.id
      WHERE recall_questions.session_id = ?
      ORDER BY recall_questions.sequence ASC
      `
    )
    .all(sessionId);

  const evaluationRow = db
    .prepare("SELECT * FROM evaluations WHERE session_id = ?")
    .get(sessionId);

  return {
    session,
    questions,
    evaluation: serializeEvaluationRow(evaluationRow),
  };
}

// START a recall session
app.post("/api/recall-sessions", requireAuth, async (req, res) => {
  const { subjectId, scheduledRecallId } = req.body;
  const numericSubjectId = Number(subjectId);

  if (!Number.isInteger(numericSubjectId) || numericSubjectId <= 0) {
    return res.status(400).json({ message: "Invalid subject ID." });
  }

  const subject = getOwnedSubject(numericSubjectId, req.userId);

  if (!subject) {
    return res.status(404).json({ message: "Subject not found." });
  }

  const mode = calle.isMockMode() ? "mock" : "real";

  const insertResult = db
    .prepare(
      `
      INSERT INTO recall_sessions (
        user_id, subject_id, scheduled_recall_id, status, mode, started_at
      )
      VALUES (?, ?, ?, 'calling', ?, CURRENT_TIMESTAMP)
      `
    )
    .run(
      req.userId,
      numericSubjectId,
      scheduledRecallId ? Number(scheduledRecallId) : null,
      mode
    );

  const sessionId = Number(insertResult.lastInsertRowid);

  try {
    if (mode === "mock") {
      const question = calle.mockAdapter.openingQuestion(subject);

      db.prepare(
        `INSERT INTO recall_questions (session_id, sequence, question_text) VALUES (?, 1, ?)`
      ).run(sessionId, question);

      db.prepare(
        `UPDATE recall_sessions SET status = 'in_progress' WHERE id = ?`
      ).run(sessionId);

      return res.status(201).json(buildSessionResponse(sessionId));
    }

    // REAL MODE
    if (!calle.realAdapter.isConfigured()) {
      db.prepare(
        `UPDATE recall_sessions SET status = 'failed', failure_reason = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).run("CALLE_API_KEY is not configured on the server.", sessionId);

      return res.status(400).json({
        message:
          "Real CALL-E mode is not configured. Set MOCK_CALL_E=true for development, or provide CALLE_API_KEY for a real call.",
        session: buildSessionResponse(sessionId),
      });
    }

    const user = db
      .prepare(
        "SELECT phone_number AS phoneNumber, call_consent AS callConsent, name FROM users WHERE id = ?"
      )
      .get(req.userId);

    if (!user.phoneNumber || !user.callConsent) {
      db.prepare(
        `UPDATE recall_sessions SET status = 'failed', failure_reason = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).run("Phone number and call consent are required.", sessionId);

      return res.status(400).json({
        message:
          "A phone number and explicit call consent are required before a real recall call can be placed.",
        session: buildSessionResponse(sessionId),
      });
    }

    db.prepare(
      `UPDATE recall_sessions SET status = 'in_progress' WHERE id = ?`
    ).run(sessionId);

    const result = await calle.realAdapter.runRealCall({
      subject,
      phoneNumber: user.phoneNumber,
      learnerName: user.name,
      previousScore: subject.percentage,
      weakAreas: getRecentWeakAreas(subject.id),
      idempotencyKey: `synora-session-${sessionId}`,
    });

    db.prepare(
      `UPDATE recall_sessions SET call_provider_id = ? WHERE id = ?`
    ).run(result.callProviderId, sessionId);

    persistFinalEvaluation({
      userId: req.userId,
      subjectId: subject.id,
      sessionId,
      assessment: result.assessment,
      evaluatorMode: "calle-real",
    });

    return res.status(201).json(buildSessionResponse(sessionId));
  } catch (error) {
    console.error("Recall session error:", error);

    db.prepare(
      `UPDATE recall_sessions SET status = 'failed', failure_reason = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(String(error.message || error), sessionId);

    return res.status(502).json({
      message: "The recall call could not be completed.",
      reason: error.message,
      session: buildSessionResponse(sessionId),
    });
  }
});

// SUBMIT an answer in a MOCK recall session
app.post("/api/recall-sessions/:id/answer", requireAuth, async (req, res) => {
  try {
    const sessionId = Number(req.params.id);
    const { answerText } = req.body;

    if (!answerText || !String(answerText).trim()) {
      return res.status(400).json({ message: "An answer is required." });
    }

    const session = db
      .prepare("SELECT * FROM recall_sessions WHERE id = ?")
      .get(sessionId);

    if (!session || Number(session.user_id) !== req.userId) {
      return res.status(404).json({ message: "Recall session not found." });
    }

    if (session.mode !== "mock") {
      return res.status(400).json({
        message: "This session is a real CALL-E call and has no typed turns.",
      });
    }

    if (session.status !== "in_progress") {
      return res.status(400).json({
        message: "This recall session has already finished.",
      });
    }

    const subject = getOwnedSubject(session.subject_id, req.userId);

    const currentQuestion = db
      .prepare(
        `
        SELECT * FROM recall_questions
        WHERE session_id = ?
        ORDER BY sequence DESC
        LIMIT 1
        `
      )
      .get(sessionId);

    db.prepare(
      `INSERT INTO learner_answers (session_id, question_id, answer_text) VALUES (?, ?, ?)`
    ).run(sessionId, currentQuestion.id, String(answerText).trim());

    const studyContext = subject.description || subject.name;

    if (currentQuestion.sequence === 1) {
      const { assessment } = await evaluator.evaluate({
        topic: subject.name,
        studyContext,
        learnerResponse: String(answerText).trim(),
      });

      const followUp = calle.mockAdapter.followUpQuestion(subject, assessment);

      db.prepare(
        `INSERT INTO recall_questions (session_id, sequence, question_text) VALUES (?, 2, ?)`
      ).run(sessionId, followUp);

      return res.json(buildSessionResponse(sessionId));
    }

    // Final turn: evaluate the whole conversation together.
    const firstAnswer = db
      .prepare(
        `
        SELECT recall_questions.question_text AS q, learner_answers.answer_text AS a
        FROM recall_questions
        JOIN learner_answers ON learner_answers.question_id = recall_questions.id
        WHERE recall_questions.session_id = ? AND recall_questions.sequence = 1
        `
      )
      .get(sessionId);

    const combinedResponse =
      `In response to "${firstAnswer.q}", the learner said: "${firstAnswer.a}". ` +
      `Then, in response to a follow-up ("${currentQuestion.question_text}"), the learner said: "${String(answerText).trim()}".`;

    const { assessment, evaluatorMode } = await evaluator.evaluate({
      topic: subject.name,
      studyContext,
      learnerResponse: combinedResponse,
    });

    persistFinalEvaluation({
      userId: req.userId,
      subjectId: subject.id,
      sessionId,
      assessment,
      evaluatorMode,
    });

    return res.json(buildSessionResponse(sessionId));
  } catch (error) {
    console.error("Recall session answer error:", error);

    db.prepare(
      `UPDATE recall_sessions SET status = 'failed', failure_reason = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(String(error.message || error), Number(req.params.id));

    res.status(502).json({
      message: "The evaluation could not be completed.",
      reason: error.message,
    });
  }
});

// LIST recent recall sessions
app.get("/api/recall-sessions", requireAuth, (req, res) => {
  try {
    const sessions = db
      .prepare(
        `
        SELECT
          recall_sessions.id,
          recall_sessions.status,
          recall_sessions.mode,
          recall_sessions.created_at AS createdAt,
          subjects.id AS subjectId,
          subjects.name AS subjectName,
          evaluations.recall_score AS recallScore,
          evaluations.status AS evaluationStatus,
          evaluations.memory_state AS memoryState,
          evaluations.summary AS summary
        FROM recall_sessions
        INNER JOIN subjects ON subjects.id = recall_sessions.subject_id
        LEFT JOIN evaluations ON evaluations.session_id = recall_sessions.id
        WHERE recall_sessions.user_id = ?
        ORDER BY recall_sessions.created_at DESC
        LIMIT 10
        `
      )
      .all(req.userId);

    res.json({ sessions });
  } catch (error) {
    console.error("List recall sessions error:", error);
    res.status(500).json({ message: "Could not load recall sessions." });
  }
});

// GET one recall session in full detail
app.get("/api/recall-sessions/:id", requireAuth, (req, res) => {
  try {
    const sessionId = Number(req.params.id);
    const ownerRow = db
      .prepare("SELECT user_id FROM recall_sessions WHERE id = ?")
      .get(sessionId);

    if (!ownerRow) {
      return res.status(404).json({ message: "Recall session not found." });
    }

    if (Number(ownerRow.user_id) !== req.userId) {
      return res.status(403).json({
        message: "You can only view your own recall sessions.",
      });
    }

    res.json(buildSessionResponse(sessionId));
  } catch (error) {
    console.error("Get recall session error:", error);
    res.status(500).json({ message: "Could not load recall session." });
  }
});

// =====================================================
// MISCONCEPTIONS
// =====================================================

app.get("/api/misconceptions", requireAuth, (req, res) => {
  try {
    const misconceptions = db
      .prepare(
        `
        SELECT
          misconceptions.id,
          misconceptions.concept,
          misconceptions.student_belief AS studentBelief,
          misconceptions.correct_understanding AS correctUnderstanding,
          misconceptions.evidence_from_response AS evidenceFromResponse,
          misconceptions.resolved,
          misconceptions.created_at AS createdAt,
          subjects.id AS subjectId,
          subjects.name AS subjectName
        FROM misconceptions
        INNER JOIN subjects ON subjects.id = misconceptions.subject_id
        WHERE misconceptions.user_id = ? AND misconceptions.resolved = 0
        ORDER BY misconceptions.created_at DESC
        LIMIT 20
        `
      )
      .all(req.userId);

    res.json({ misconceptions });
  } catch (error) {
    console.error("List misconceptions error:", error);
    res.status(500).json({ message: "Could not load misconceptions." });
  }
});

module.exports = app;