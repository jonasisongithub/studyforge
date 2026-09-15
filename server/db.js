import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";
import { dayKey } from "../shared/day.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "data");
mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.DB_PATH || join(dataDir, "studyforge.db");
export const db = new DatabaseSync(dbPath);

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
CREATE TABLE IF NOT EXISTS subject (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  color       TEXT DEFAULT '#3366ff',
  emoji       TEXT DEFAULT '📘',
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS material (
  id           TEXT PRIMARY KEY,
  subject_id   TEXT NOT NULL REFERENCES subject(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,
  source_type  TEXT DEFAULT 'paste',
  status       TEXT NOT NULL DEFAULT 'pending',   -- pending | processing | ready | committed | error
  lang         TEXT DEFAULT 'de',
  generated    TEXT DEFAULT '{}',                 -- JSON: { cards:[], questions:[] } preview before commit
  error        TEXT DEFAULT '',
  created_at   TEXT NOT NULL,
  processed_at TEXT
);

CREATE TABLE IF NOT EXISTS card (
  id           TEXT PRIMARY KEY,
  subject_id   TEXT NOT NULL REFERENCES subject(id) ON DELETE CASCADE,
  material_id  TEXT REFERENCES material(id) ON DELETE SET NULL,
  type         TEXT NOT NULL DEFAULT 'basic',     -- basic | cloze
  front        TEXT NOT NULL,
  back         TEXT NOT NULL,
  hint         TEXT DEFAULT '',
  origin       TEXT DEFAULT 'manual',             -- manual | heuristic | ai
  tags         TEXT DEFAULT '',
  created_at   TEXT NOT NULL,
  -- SM-2 scheduling state (kept inline for simplicity)
  ease         REAL NOT NULL DEFAULT 2.5,
  interval     REAL NOT NULL DEFAULT 0,           -- days
  reps         INTEGER NOT NULL DEFAULT 0,
  lapses       INTEGER NOT NULL DEFAULT 0,
  due_at       TEXT NOT NULL,
  last_review  TEXT,
  leech        INTEGER NOT NULL DEFAULT 0,
  suspended    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_card_due ON card(subject_id, suspended, due_at);

CREATE TABLE IF NOT EXISTS review_log (
  id          TEXT PRIMARY KEY,
  card_id     TEXT NOT NULL REFERENCES card(id) ON DELETE CASCADE,
  subject_id  TEXT NOT NULL,
  rating      INTEGER NOT NULL,                   -- 0 again | 1 hard | 2 good | 3 easy
  prev_interval REAL,
  next_interval REAL,
  elapsed_ms  INTEGER DEFAULT 0,
  reviewed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rlog_time ON review_log(reviewed_at);

CREATE TABLE IF NOT EXISTS question (
  id           TEXT PRIMARY KEY,
  subject_id   TEXT NOT NULL REFERENCES subject(id) ON DELETE CASCADE,
  material_id  TEXT REFERENCES material(id) ON DELETE SET NULL,
  type         TEXT NOT NULL,                     -- mc | truefalse | cloze | short
  prompt       TEXT NOT NULL,
  options      TEXT DEFAULT '[]',
  answer       TEXT NOT NULL,
  explanation  TEXT DEFAULT '',
  origin       TEXT DEFAULT 'heuristic',
  created_at   TEXT NOT NULL,
  times_seen   INTEGER NOT NULL DEFAULT 0,
  times_correct INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_question_subject ON question(subject_id);

CREATE TABLE IF NOT EXISTS quiz (
  id          TEXT PRIMARY KEY,
  subject_id  TEXT NOT NULL REFERENCES subject(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  config      TEXT DEFAULT '{}',
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quiz_question (
  id           TEXT PRIMARY KEY,
  quiz_id      TEXT NOT NULL REFERENCES quiz(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,                     -- mc | truefalse | cloze | short
  prompt       TEXT NOT NULL,
  options      TEXT DEFAULT '[]',                 -- JSON array (mc)
  answer       TEXT NOT NULL,                     -- canonical answer string
  explanation  TEXT DEFAULT '',
  ord          INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quiz_attempt (
  id          TEXT PRIMARY KEY,
  quiz_id     TEXT NOT NULL REFERENCES quiz(id) ON DELETE CASCADE,
  subject_id  TEXT NOT NULL,
  score       INTEGER NOT NULL DEFAULT 0,
  total       INTEGER NOT NULL DEFAULT 0,
  detail      TEXT DEFAULT '[]',
  started_at  TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS study_session (
  id          TEXT PRIMARY KEY,
  subject_id  TEXT,
  mode        TEXT NOT NULL,
  cards_seen  INTEGER NOT NULL DEFAULT 0,
  correct     INTEGER NOT NULL DEFAULT 0,
  started_at  TEXT NOT NULL,
  ended_at    TEXT
);

CREATE TABLE IF NOT EXISTS daily_stat (
  day             TEXT PRIMARY KEY,               -- YYYY-MM-DD (local)
  reviews         INTEGER NOT NULL DEFAULT 0,
  correct         INTEGER NOT NULL DEFAULT 0,
  new_cards       INTEGER NOT NULL DEFAULT 0,
  quiz_attempts   INTEGER NOT NULL DEFAULT 0,
  study_minutes   REAL NOT NULL DEFAULT 0,
  xp              INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS setting (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

export const uid = () => globalThis.crypto.randomUUID();
export const nowISO = () => new Date().toISOString();

export function getSetting(key, fallback = null) {
  const row = db.prepare("SELECT value FROM setting WHERE key = ?").get(key);
  return row ? row.value : fallback;
}
export function setSetting(key, value) {
  db.prepare(
    "INSERT INTO setting(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, String(value));
}

// ---- lightweight migrations (idempotent) ----
function addColumn(table, ddl) {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`); } catch { /* already exists */ }
}
// Questions get their own fixed-interval scheduling state so they behave like cards
// ("gelernt" / "fällig") regardless of which mode answered them.
addColumn("question", "due_at TEXT");
addColumn("question", "reps INTEGER NOT NULL DEFAULT 0");
addColumn("question", "lapses INTEGER NOT NULL DEFAULT 0");
addColumn("question", "last_review TEXT");
db.exec("CREATE INDEX IF NOT EXISTS idx_question_due ON question(subject_id, due_at)");
// Existing rows created before this column: make them due now.
db.exec("UPDATE question SET due_at = created_at WHERE due_at IS NULL");
// Link snapshot quiz questions back to the question bank so answering one updates its schedule.
addColumn("quiz_question", "question_id TEXT");

// The Lern-Historie heatmap groups by calendar day. Store that day (via the single
// canonical dayKey() helper — see shared/day.js) directly on each review, instead of
// deriving it at query time with SQL date()/'localtime', which is a second,
// independent implementation that can silently disagree with the JS one.
addColumn("review_log", "day TEXT");
db.exec("CREATE INDEX IF NOT EXISTS idx_rlog_day ON review_log(day)");
{
  // Migrate rows written before the `day` column existed, so no history is lost.
  const stale = db.prepare("SELECT id, reviewed_at FROM review_log WHERE day IS NULL").all();
  if (stale.length) {
    const upd = db.prepare("UPDATE review_log SET day = ? WHERE id = ?");
    for (const row of stale) upd.run(dayKey(new Date(row.reviewed_at)), row.id);
    console.log(`[migrate] review_log: ${stale.length} Einträge auf Tages-Schlüssel migriert`);
  }
}

// Seed sensible defaults on first boot.
if (!getSetting("daily_goal")) setSetting("daily_goal", "30");
if (!getSetting("review_interval_days")) setSetting("review_interval_days", "3");
