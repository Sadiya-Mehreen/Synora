const path = require("path");
const os = require("os");
const fs = require("fs");

// Give this test file its own isolated database so test runs never
// collide with a developer's real synora.db or with other test
// files (node's test runner may run files in parallel processes).
const tmpDbPath = path.join(
  os.tmpdir(),
  `synora-test-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
);
process.env.SYNORA_DB_PATH = tmpDbPath;
process.env.MOCK_CALL_E = process.env.MOCK_CALL_E || "true";
process.env.EVAL_MODE = process.env.EVAL_MODE || "deterministic";

const app = require("../src/app");

let server;
let baseUrl;

async function startServer() {
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve(baseUrl);
    });
  });
}

async function stopServer() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(tmpDbPath + suffix);
    } catch {
      // fine if it doesn't exist
    }
  }
}

async function api(method, urlPath, { token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let json = null;
  try {
    json = await response.json();
  } catch {
    // no body
  }

  return { status: response.status, body: json };
}

async function signupAndLogin(overrides = {}) {
  const email = overrides.email || `user-${Math.random().toString(16).slice(2)}@example.com`;

  const signup = await api("POST", "/api/auth/signup", {
    body: {
      name: overrides.name || "Test Learner",
      email,
      password: overrides.password || "password123",
      phoneNumber: overrides.phoneNumber,
      callConsent: overrides.callConsent,
    },
  });

  return { token: signup.body.token, user: signup.body.user, email };
}

module.exports = { startServer, stopServer, api, signupAndLogin };
