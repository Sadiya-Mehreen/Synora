const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { startServer, stopServer, api, signupAndLogin } = require("./helpers");

before(startServer);
after(stopServer);

test("signup creates an account and returns a token", async () => {
  const { status, body } = await api("POST", "/api/auth/signup", {
    body: {
      name: "Ada",
      email: `ada-${Date.now()}@example.com`,
      password: "password123",
    },
  });

  assert.equal(status, 201);
  assert.ok(body.token);
  assert.equal(body.user.name, "Ada");
});

test("signup rejects a duplicate email", async () => {
  const email = `dupe-${Date.now()}@example.com`;

  await api("POST", "/api/auth/signup", {
    body: { name: "First", email, password: "password123" },
  });

  const { status, body } = await api("POST", "/api/auth/signup", {
    body: { name: "Second", email, password: "password123" },
  });

  assert.equal(status, 409);
  assert.match(body.message, /already exists/i);
});

test("signup rejects a missing password", async () => {
  const { status } = await api("POST", "/api/auth/signup", {
    body: { name: "No Password", email: `nopass-${Date.now()}@example.com` },
  });

  assert.equal(status, 400);
});

test("signup rejects a password that is too short", async () => {
  const { status } = await api("POST", "/api/auth/signup", {
    body: {
      name: "Short",
      email: `short-${Date.now()}@example.com`,
      password: "123",
    },
  });

  assert.equal(status, 400);
});

test("login succeeds with correct credentials", async () => {
  const email = `login-${Date.now()}@example.com`;
  await api("POST", "/api/auth/signup", {
    body: { name: "Logger Inn", email, password: "password123" },
  });

  const { status, body } = await api("POST", "/api/auth/login", {
    body: { email, password: "password123" },
  });

  assert.equal(status, 200);
  assert.ok(body.token);
});

test("login rejects an invalid password", async () => {
  const email = `wrongpw-${Date.now()}@example.com`;
  await api("POST", "/api/auth/signup", {
    body: { name: "Wrong PW", email, password: "password123" },
  });

  const { status, body } = await api("POST", "/api/auth/login", {
    body: { email, password: "not-the-password" },
  });

  assert.equal(status, 401);
  assert.match(body.message, /invalid/i);
});

test("login rejects an unknown email", async () => {
  const { status } = await api("POST", "/api/auth/login", {
    body: { email: "nobody@example.com", password: "password123" },
  });

  assert.equal(status, 401);
});

test("protected routes reject requests with no token", async () => {
  const { status } = await api("GET", "/api/users/me");
  assert.equal(status, 401);
});

test("logout revokes the token", async () => {
  const { token } = await signupAndLogin();

  const before = await api("GET", "/api/users/me", { token });
  assert.equal(before.status, 200);

  const logout = await api("POST", "/api/auth/logout", { token });
  assert.equal(logout.status, 200);

  const after = await api("GET", "/api/users/me", { token });
  assert.equal(after.status, 401);
});

test("a user cannot read another user's subjects by guessing their ID", async () => {
  const userA = await signupAndLogin();
  const userB = await signupAndLogin();

  const { status } = await api("GET", `/api/subjects/${userB.user.id}`, {
    token: userA.token,
  });

  assert.equal(status, 403);
});

test("an expired token is rejected and cleaned up", async () => {
  const db = require("../src/db");
  const { getUserIdForToken } = require("../src/auth");

  const userId = db
    .prepare("INSERT INTO users (name, email, password) VALUES (?, ?, ?)")
    .run("Expiry Test", `expiry-${Date.now()}@example.com`, "hashed")
    .lastInsertRowid;

  const expiredTime = new Date(Date.now() - 1000).toISOString();
  const token = `expired-${Date.now()}`;

  db.prepare(
    "INSERT INTO auth_tokens (user_id, token, expires_at) VALUES (?, ?, ?)"
  ).run(userId, token, expiredTime);

  assert.equal(getUserIdForToken(token), null);

  const stillThere = db
    .prepare("SELECT * FROM auth_tokens WHERE token = ?")
    .get(token);
  assert.equal(stillThere, undefined);

  const { status } = await api("GET", "/api/users/me", { token });
  assert.equal(status, 401);
});

test("passwords are stored hashed, never in plaintext", async () => {
  const db = require("../src/db");
  const email = `hashcheck-${Date.now()}@example.com`;

  await api("POST", "/api/auth/signup", {
    body: { name: "Hash Check", email, password: "password123" },
  });

  const row = db
    .prepare("SELECT password FROM users WHERE email = ?")
    .get(email);

  assert.notEqual(row.password, "password123");
  // bcrypt hashes start with $2a$/$2b$/$2y$
  assert.match(row.password, /^\$2[aby]\$/);
});
