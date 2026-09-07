const Database = require("better-sqlite3");
const path = require("path");

// Always store the database in the backend folder.
const dbPath =
  process.env.SYNORA_DB_PATH || path.join(__dirname, "..", "synora.db");

const db = new Database(dbPath);

db.pragma("foreign_keys = ON");

// =====================================================
// USERS TABLE
// =====================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    phone_number TEXT DEFAULT NULL,
    call_consent INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// =====================================================
// USERS TABLE MIGRATION
// =====================================================

const userColumns = db
  .prepare("PRAGMA table_info(users)")
  .all();

const hasPhoneNumber = userColumns.some(
  (column) => column.name === "phone_number"
);

const hasCallConsent = userColumns.some(
  (column) => column.name === "call_consent"
);

if (!hasPhoneNumber) {
  db.exec(`
    ALTER TABLE users
    ADD COLUMN phone_number TEXT DEFAULT NULL
  `);
}

if (!hasCallConsent) {
  db.exec(`
    ALTER TABLE users
    ADD COLUMN call_consent INTEGER NOT NULL DEFAULT 0
  `);
}

const hasCallConsentAt = userColumns.some(
  (column) => column.name === "call_consent_at"
);

if (!hasCallConsentAt) {
  db.exec(`
    ALTER TABLE users
    ADD COLUMN call_consent_at DATETIME DEFAULT NULL
  `);
}

// =====================================================
// AUTH TOKENS TABLE
// =====================================================
// Simple opaque bearer-token session store. This is intentionally
// lightweight (no JWT, no external session store) to keep the MVP
// beginner-maintainable, but it removes the previous "trust any
// userId the client sends" hole: every authenticated request now
// resolves req.userId from a server-issued, expiring token instead
// of a client-supplied value.

db.exec(`
  CREATE TABLE IF NOT EXISTS auth_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,

    FOREIGN KEY (user_id)
      REFERENCES users(id)
      ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_auth_tokens_token
  ON auth_tokens(token)
`);

// =====================================================
// SUBJECTS TABLE
// =====================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    percentage INTEGER DEFAULT NULL,
    status TEXT DEFAULT 'Not assessed',
    status_class TEXT DEFAULT 'learning',
    last_reviewed TEXT DEFAULT 'Not yet',
    next_review TEXT DEFAULT 'Schedule a recall',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
      REFERENCES users(id)
      ON DELETE CASCADE
  )
`);

// =====================================================
// SCHEDULED RECALLS TABLE
// =====================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS scheduled_recalls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    repeat TEXT NOT NULL DEFAULT 'Once',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
      REFERENCES users(id)
      ON DELETE CASCADE,

    FOREIGN KEY (subject_id)
      REFERENCES subjects(id)
      ON DELETE CASCADE
  )
`);

// =====================================================
// RECALL SESSIONS
// =====================================================
// A recall session is one CALL-E-powered active-recall attempt for
// a single subject. In mock mode it is driven turn-by-turn from the
// dashboard (standing in for the phone call). In real mode it maps
// 1:1 onto a single CALL-E call_task.

db.exec(`
  CREATE TABLE IF NOT EXISTS recall_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    scheduled_recall_id INTEGER DEFAULT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    mode TEXT NOT NULL DEFAULT 'mock',
    call_provider_id TEXT DEFAULT NULL,
    failure_reason TEXT DEFAULT NULL,
    started_at DATETIME DEFAULT NULL,
    ended_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
      REFERENCES users(id)
      ON DELETE CASCADE,

    FOREIGN KEY (subject_id)
      REFERENCES subjects(id)
      ON DELETE CASCADE,

    FOREIGN KEY (scheduled_recall_id)
      REFERENCES scheduled_recalls(id)
      ON DELETE SET NULL
  )
`);

// =====================================================
// RECALL QUESTIONS
// =====================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS recall_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    sequence INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    asked_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (session_id)
      REFERENCES recall_sessions(id)
      ON DELETE CASCADE
  )
`);

// =====================================================
// LEARNER ANSWERS
// =====================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS learner_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    answer_text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (session_id)
      REFERENCES recall_sessions(id)
      ON DELETE CASCADE,

    FOREIGN KEY (question_id)
      REFERENCES recall_questions(id)
      ON DELETE CASCADE
  )
`);

// =====================================================
// EVALUATIONS
// =====================================================
// Stores both the raw skill-shaped assessment (recall_score, status,
// concepts_remembered, weak_areas, recommended_next_review -- this is
// the exact contract the learning-recall-call Skill/evaluator uses)
// and Synora's own derived fields (memory_state, understanding) used
// for the dashboard's four-state model (mastered/fading/forgotten/
// misconception).

db.exec(`
  CREATE TABLE IF NOT EXISTS evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL UNIQUE,
    recall_score INTEGER,
    status TEXT,
    understanding TEXT,
    memory_state TEXT,
    concepts_remembered TEXT,
    weak_areas TEXT,
    misconceptions TEXT,
    confidence TEXT,
    summary TEXT,
    follow_up_question TEXT,
    recommended_next_review TEXT,
    evaluator_mode TEXT NOT NULL DEFAULT 'mock',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (session_id)
      REFERENCES recall_sessions(id)
      ON DELETE CASCADE
  )
`);

// =====================================================
// MISCONCEPTIONS
// =====================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS misconceptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    session_id INTEGER NOT NULL,
    concept TEXT NOT NULL,
    student_belief TEXT DEFAULT '',
    correct_understanding TEXT DEFAULT '',
    evidence_from_response TEXT DEFAULT '',
    resolved INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
      REFERENCES users(id)
      ON DELETE CASCADE,

    FOREIGN KEY (subject_id)
      REFERENCES subjects(id)
      ON DELETE CASCADE,

    FOREIGN KEY (session_id)
      REFERENCES recall_sessions(id)
      ON DELETE CASCADE
  )
`);

// =====================================================
// MEMORY HISTORY
// =====================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS memory_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    session_id INTEGER DEFAULT NULL,
    score INTEGER,
    memory_state TEXT,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
      REFERENCES users(id)
      ON DELETE CASCADE,

    FOREIGN KEY (subject_id)
      REFERENCES subjects(id)
      ON DELETE CASCADE,

    FOREIGN KEY (session_id)
      REFERENCES recall_sessions(id)
      ON DELETE SET NULL
  )
`);

console.log("Synora database connected.");
console.log(`Database location: ${dbPath}`);
console.log(
  "Users, subjects, scheduled recalls, recall sessions, evaluations, " +
  "misconceptions and memory history tables are ready."
);

module.exports = db;
