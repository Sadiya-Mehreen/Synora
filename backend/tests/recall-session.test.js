const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { startServer, stopServer, api, signupAndLogin } = require("./helpers");

before(startServer);
after(stopServer);

async function createSubject(token, overrides = {}) {
  const { body } = await api("POST", "/api/subjects", {
    token,
    body: {
      name: overrides.name || "Cryptography",
      description:
        overrides.description || "Hashing, encryption, digital signatures, salts.",
    },
  });
  return body.subject;
}

test("starting a mock recall session returns an opening question", async () => {
  const { token } = await signupAndLogin();
  const subject = await createSubject(token);

  const { status, body } = await api("POST", "/api/recall-sessions", {
    token,
    body: { subjectId: subject.id },
  });

  assert.equal(status, 201);
  assert.equal(body.session.status, "in_progress");
  assert.equal(body.session.mode, "mock");
  assert.equal(body.questions.length, 1);
  assert.match(body.questions[0].text, /Cryptography/);
});

test("starting a recall session for a subject you don't own fails", async () => {
  const userA = await signupAndLogin();
  const userB = await signupAndLogin();
  const subjectA = await createSubject(userA.token);

  const { status } = await api("POST", "/api/recall-sessions", {
    token: userB.token,
    body: { subjectId: subjectA.id },
  });

  assert.equal(status, 404);
});

test("the canonical demo scenario: a hashing/encryption mix-up is detected as a misconception with an adaptive follow-up", async () => {
  const { token } = await signupAndLogin();
  const subject = await createSubject(token);

  const started = await api("POST", "/api/recall-sessions", {
    token,
    body: { subjectId: subject.id },
  });
  const sessionId = started.body.session.id;

  const turn1 = await api(
    "POST",
    `/api/recall-sessions/${sessionId}/answer`,
    {
      token,
      body: {
        answerText: "Hashing encrypts data so it can be decrypted later.",
      },
    }
  );

  assert.equal(turn1.body.session.status, "in_progress");
  assert.equal(turn1.body.questions.length, 2);
  // The follow-up must be adaptive, i.e. it must engage with the
  // misconception rather than just repeating a generic question.
  assert.match(turn1.body.questions[1].text, /one-way|reconsider|hashing/i);

  const turn2 = await api(
    "POST",
    `/api/recall-sessions/${sessionId}/answer`,
    {
      token,
      body: { answerText: "I think encryption and hashing are the same thing." },
    }
  );

  assert.equal(turn2.status, 200);
  assert.equal(turn2.body.session.status, "completed");
  assert.equal(turn2.body.evaluation.memoryState, "misconception");
  assert.ok(turn2.body.evaluation.misconceptions.length > 0);
  assert.equal(turn2.body.session.subjectStatus, "Misconception");
});

test("completing a recall session updates the subject and records memory history", async () => {
  const { token, user } = await signupAndLogin();
  const subject = await createSubject(token);

  const started = await api("POST", "/api/recall-sessions", {
    token,
    body: { subjectId: subject.id },
  });
  const sessionId = started.body.session.id;

  await api("POST", `/api/recall-sessions/${sessionId}/answer`, {
    token,
    body: { answerText: "Hashing encrypts data so it can be decrypted later." },
  });
  await api("POST", `/api/recall-sessions/${sessionId}/answer`, {
    token,
    body: { answerText: "Got it, hashing is one-way." },
  });

  const subjects = await api("GET", `/api/subjects/${user.id}`, { token });
  const updated = subjects.body.subjects.find((s) => s.id === subject.id);

  assert.notEqual(updated.percentage, null);
  assert.notEqual(updated.status, "Not assessed");

  const misconceptions = await api("GET", "/api/misconceptions", { token });
  assert.equal(misconceptions.body.misconceptions.length, 1);

  const sessions = await api("GET", "/api/recall-sessions", { token });
  assert.equal(sessions.body.sessions.length, 1);
  assert.equal(sessions.body.sessions[0].status, "completed");
});

test("answering a session twice after completion is rejected", async () => {
  const { token } = await signupAndLogin();
  const subject = await createSubject(token);

  const started = await api("POST", "/api/recall-sessions", {
    token,
    body: { subjectId: subject.id },
  });
  const sessionId = started.body.session.id;

  await api("POST", `/api/recall-sessions/${sessionId}/answer`, {
    token,
    body: { answerText: "It relates to keeping data secure." },
  });
  await api("POST", `/api/recall-sessions/${sessionId}/answer`, {
    token,
    body: { answerText: "Encryption is reversible, hashing is not." },
  });

  const { status, body } = await api(
    "POST",
    `/api/recall-sessions/${sessionId}/answer`,
    { token, body: { answerText: "Anything else?" } }
  );

  assert.equal(status, 400);
  assert.match(body.message, /already finished/i);
});

test("an empty answer is rejected", async () => {
  const { token } = await signupAndLogin();
  const subject = await createSubject(token);

  const started = await api("POST", "/api/recall-sessions", {
    token,
    body: { subjectId: subject.id },
  });

  const { status } = await api(
    "POST",
    `/api/recall-sessions/${started.body.session.id}/answer`,
    { token, body: { answerText: "   " } }
  );

  assert.equal(status, 400);
});

test("real CALL-E mode fails clearly and safely when unconfigured, instead of faking a call", async () => {
  const { token } = await signupAndLogin();
  const subject = await createSubject(token);

  process.env.MOCK_CALL_E = "false";
  try {
    const { status, body } = await api("POST", "/api/recall-sessions", {
      token,
      body: { subjectId: subject.id },
    });

    assert.equal(status, 400);
    assert.match(body.message, /not configured/i);
    assert.equal(body.session.session.status, "failed");
  } finally {
    process.env.MOCK_CALL_E = "true";
  }
});

test("a user cannot view another user's recall session detail by guessing its ID", async () => {
  const userA = await signupAndLogin();
  const userB = await signupAndLogin();
  const subjectA = await createSubject(userA.token);

  const started = await api("POST", "/api/recall-sessions", {
    token: userA.token,
    body: { subjectId: subjectA.id },
  });
  const sessionId = started.body.session.id;

  const { status } = await api(
    "GET",
    `/api/recall-sessions/${sessionId}`,
    { token: userB.token }
  );

  assert.equal(status, 403);
});

test("recall-session and misconception lists never leak across users", async () => {
  const userA = await signupAndLogin();
  const userB = await signupAndLogin();
  const subjectA = await createSubject(userA.token);
  const subjectB = await createSubject(userB.token, { name: "History" });

  // User A completes a session with the canonical misconception.
  const startedA = await api("POST", "/api/recall-sessions", {
    token: userA.token,
    body: { subjectId: subjectA.id },
  });
  await api("POST", `/api/recall-sessions/${startedA.body.session.id}/answer`, {
    token: userA.token,
    body: { answerText: "Hashing encrypts data so it can be decrypted later." },
  });
  await api("POST", `/api/recall-sessions/${startedA.body.session.id}/answer`, {
    token: userA.token,
    body: { answerText: "Got it, hashing is one-way." },
  });

  // User B has done nothing yet -- their lists must be empty, not
  // contaminated by user A's session/misconception.
  const sessionsB = await api("GET", "/api/recall-sessions", {
    token: userB.token,
  });
  const misconceptionsB = await api("GET", "/api/misconceptions", {
    token: userB.token,
  });

  assert.equal(sessionsB.body.sessions.length, 0);
  assert.equal(misconceptionsB.body.misconceptions.length, 0);

  // Sanity check the data really did land under user A.
  const sessionsA = await api("GET", "/api/recall-sessions", {
    token: userA.token,
  });
  const misconceptionsA = await api("GET", "/api/misconceptions", {
    token: userA.token,
  });

  assert.equal(sessionsA.body.sessions.length, 1);
  assert.equal(misconceptionsA.body.misconceptions.length, 1);

  // subjectB is unused beyond proving user B's own data is untouched.
  assert.ok(subjectB.id);
});
