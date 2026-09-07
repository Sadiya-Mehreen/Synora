const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { startServer, stopServer, api, signupAndLogin } = require("./helpers");

before(startServer);
after(stopServer);

async function createSubject(token, name = "Cryptography") {
  const { body } = await api("POST", "/api/subjects", {
    token,
    body: { name, description: "Hashing, encryption, salts." },
  });
  return body.subject;
}

test("a recall can be scheduled for an owned subject", async () => {
  const { token } = await signupAndLogin();
  const subject = await createSubject(token);

  const { status, body } = await api("POST", "/api/recalls", {
    token,
    body: { subjectId: subject.id, date: "2026-09-10", time: "09:00" },
  });

  assert.equal(status, 201);
  assert.equal(body.recall.topicName, "Cryptography");
});

test("scheduling a recall for a nonexistent subject fails", async () => {
  const { token } = await signupAndLogin();

  const { status } = await api("POST", "/api/recalls", {
    token,
    body: { subjectId: 999999, date: "2026-09-10", time: "09:00" },
  });

  assert.equal(status, 404);
});

test("a user cannot schedule a recall against another user's subject", async () => {
  const userA = await signupAndLogin();
  const userB = await signupAndLogin();
  const subjectA = await createSubject(userA.token);

  const { status } = await api("POST", "/api/recalls", {
    token: userB.token,
    body: { subjectId: subjectA.id, date: "2026-09-10", time: "09:00" },
  });

  assert.equal(status, 403);
});

test("scheduled recalls persist and list back", async () => {
  const { token, user } = await signupAndLogin();
  const subject = await createSubject(token);

  await api("POST", "/api/recalls", {
    token,
    body: { subjectId: subject.id, date: "2026-09-10", time: "09:00" },
  });

  const { body } = await api("GET", `/api/recalls/${user.id}`, { token });

  assert.equal(body.recalls.length, 1);
  assert.equal(body.recalls[0].date, "2026-09-10");
});

test("a scheduled recall can be cancelled", async () => {
  const { token, user } = await signupAndLogin();
  const subject = await createSubject(token);

  const created = await api("POST", "/api/recalls", {
    token,
    body: { subjectId: subject.id, date: "2026-09-10", time: "09:00" },
  });

  const cancel = await api(
    "DELETE",
    `/api/recalls/${created.body.recall.id}`,
    { token }
  );
  assert.equal(cancel.status, 200);

  const { body } = await api("GET", `/api/recalls/${user.id}`, { token });
  assert.equal(body.recalls.length, 0);
});

test("a user cannot cancel another user's recall", async () => {
  const userA = await signupAndLogin();
  const userB = await signupAndLogin();
  const subjectA = await createSubject(userA.token);

  const created = await api("POST", "/api/recalls", {
    token: userA.token,
    body: { subjectId: subjectA.id, date: "2026-09-10", time: "09:00" },
  });

  const { status } = await api(
    "DELETE",
    `/api/recalls/${created.body.recall.id}`,
    { token: userB.token }
  );

  assert.equal(status, 403);
});
