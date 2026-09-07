const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { startServer, stopServer, api, signupAndLogin } = require("./helpers");

before(startServer);
after(stopServer);

test("a new subject starts as 'Not assessed' with no fake progress", async () => {
  const { token } = await signupAndLogin();

  const { status, body } = await api("POST", "/api/subjects", {
    token,
    body: { name: "Cryptography", description: "Hashing, encryption, salts." },
  });

  assert.equal(status, 201);
  assert.equal(body.subject.percentage, null);
  assert.equal(body.subject.status, "Not assessed");
});

test("subjects persist and are listed back for the same user", async () => {
  const { token, user } = await signupAndLogin();

  await api("POST", "/api/subjects", {
    token,
    body: { name: "Data Structures", description: "Trees, graphs, heaps." },
  });

  const { status, body } = await api("GET", `/api/subjects/${user.id}`, {
    token,
  });

  assert.equal(status, 200);
  assert.equal(body.subjects.length, 1);
  assert.equal(body.subjects[0].name, "Data Structures");
});

test("a subject name is required", async () => {
  const { token } = await signupAndLogin();

  const { status } = await api("POST", "/api/subjects", {
    token,
    body: { description: "No name given" },
  });

  assert.equal(status, 400);
});

test("two users' subjects never mix", async () => {
  const userA = await signupAndLogin();
  const userB = await signupAndLogin();

  await api("POST", "/api/subjects", {
    token: userA.token,
    body: { name: "User A Topic" },
  });
  await api("POST", "/api/subjects", {
    token: userB.token,
    body: { name: "User B Topic" },
  });

  const listA = await api("GET", `/api/subjects/${userA.user.id}`, {
    token: userA.token,
  });
  const listB = await api("GET", `/api/subjects/${userB.user.id}`, {
    token: userB.token,
  });

  assert.equal(listA.body.subjects.length, 1);
  assert.equal(listA.body.subjects[0].name, "User A Topic");
  assert.equal(listB.body.subjects.length, 1);
  assert.equal(listB.body.subjects[0].name, "User B Topic");
});

test("creating a subject ignores any userId supplied in the body", async () => {
  const userA = await signupAndLogin();
  const userB = await signupAndLogin();

  // Attempt to spoof ownership by naming userB's ID in the body --
  // the server must ignore this and use the authenticated user.
  const create = await api("POST", "/api/subjects", {
    token: userA.token,
    body: { userId: userB.user.id, name: "Spoof Attempt" },
  });

  assert.equal(create.status, 201);

  const listB = await api("GET", `/api/subjects/${userB.user.id}`, {
    token: userB.token,
  });

  assert.equal(
    listB.body.subjects.some((s) => s.name === "Spoof Attempt"),
    false
  );
});
