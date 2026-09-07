const crypto = require("crypto");

const db = require("./db");

// Sessions last 30 days. This is an MVP-simple, server-issued opaque
// bearer token -- not a JWT -- but it is real server-side state that
// expires and can be revoked (logout), which is what actually matters
// for "reasonably secure for the MVP".
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

function issueToken(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + SESSION_LIFETIME_MS
  ).toISOString();

  db.prepare(
    `
    INSERT INTO auth_tokens (user_id, token, expires_at)
    VALUES (?, ?, ?)
    `
  ).run(userId, token, expiresAt);

  return token;
}

function revokeToken(token) {
  db.prepare("DELETE FROM auth_tokens WHERE token = ?").run(token);
}

function getUserIdForToken(token) {
  if (!token) {
    return null;
  }

  const row = db
    .prepare(
      `
      SELECT user_id AS userId, expires_at AS expiresAt
      FROM auth_tokens
      WHERE token = ?
      `
    )
    .get(token);

  if (!row) {
    return null;
  }

  if (new Date(row.expiresAt).getTime() < Date.now()) {
    // Expired -- clean it up and reject.
    db.prepare("DELETE FROM auth_tokens WHERE token = ?").run(token);
    return null;
  }

  return row.userId;
}

function extractBearerToken(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

// Express middleware. On success sets req.userId (a trusted,
// server-verified integer) and never trusts any userId supplied by
// the client in the body/params/query for identifying "who is
// asking".
function requireAuth(req, res, next) {
  const token = extractBearerToken(req);
  const userId = getUserIdForToken(token);

  if (!userId) {
    return res.status(401).json({
      message: "Please log in again.",
    });
  }

  req.userId = userId;
  next();
}

module.exports = {
  issueToken,
  revokeToken,
  getUserIdForToken,
  requireAuth,
};
