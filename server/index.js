import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { timingSafeEqual } from "node:crypto";
import { db, uid, nowISO, getSetting, setSetting } from "./db.js";
import { schedule, humanInterval } from "./srs.js";
import { generate, generateHeuristic, gradeText } from "./generate.js";
import { extractPdfText } from "./pdf.js";
import { startScheduler, processMaterial } from "./scheduler.js";
import { dayKey } from "../shared/day.js";

const intervalDays = () => Number(getSetting("review_interval_days", 3)) || 3;

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable("x-powered-by");

// Optional HTTP Basic Auth for public deployments: set SF_BASIC_AUTH="user:pass"
const BASIC_AUTH = process.env.SF_BASIC_AUTH;
if (BASIC_AUTH) {
  const expected = "Basic " + Buffer.from(BASIC_AUTH).toString("base64");
  app.use((req, res, next) => {
    const got = req.headers.authorization || "";
    if (got.length === expected.length && timingSafeEqual(Buffer.from(got), Buffer.from(expected))) return next();
    res.set("WWW-Authenticate", 'Basic realm="StudyForge"').status(401).send("Authentifizierung erforderlich");
  });
}

app.use(express.json({ limit: "32mb" }));

const api = express.Router();

// ---------- helpers ----------
// Single canonical local-day function (shared/day.js) — never a second implementation.
const localDay = (d = new Date()) => dayKey(d);
function bumpDaily(patch) {
  const day = localDay();
  db.prepare("INSERT INTO daily_stat(day) VALUES(?) ON CONFLICT(day) DO NOTHING").run(day);
  const sets = Object.keys(patch).map((k) => `${k} = ${k} + @${k}`).join(", ");
  db.prepare(`UPDATE daily_stat SET ${sets} WHERE day = @day`).run({ ...patch, day });
}
function computeStreak() {
  const rows = db.prepare("SELECT day, reviews, quiz_attempts FROM daily_stat ORDER BY day DESC LIMIT 400").all();
  const active = new Set(rows.filter((r) => r.reviews > 0 || r.quiz_attempts > 0).map((r) => r.day));
  let streak = 0;
  const cur = new Date();
  // allow today to be empty without breaking the streak
  if (!active.has(localDay(cur))) cur.setDate(cur.getDate() - 1);
  while (active.has(localDay(cur))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}
const wrap = (fn) => (req, res) => {
  try {
    const out = fn(req, res);
    if (out && typeof out.then === "function") out.then((v) => v !== undefined && res.json(v)).catch((e) => fail(res, e));
    else if (out !== undefined) res.json(out);
  } catch (e) {
    fail(res, e);
  }
};
function fail(res, e) {
  console.error(e);
  res.status(e.status || 500).json({ error: e.message || "internal error" });
}
const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });

function cardView(c) {
  return { ...c, due: humanInterval(c.interval) };
}

// Combined learn-state counts for a subject (cards + questions share the model).
function subjectCounts(subjectId, now = nowISO()) {
  const q = (sql, ...a) => db.prepare(sql).get(subjectId, ...a).n;
  const cardsTotal = q("SELECT COUNT(*) n FROM card WHERE subject_id=?");
  const cardsDue = q("SELECT COUNT(*) n FROM card WHERE subject_id=? AND suspended=0 AND due_at<=?", now);
  const cardsNew = q("SELECT COUNT(*) n FROM card WHERE subject_id=? AND reps=0");
  const cardsLearned = q("SELECT COUNT(*) n FROM card WHERE subject_id=? AND reps>0 AND due_at>?", now);
  const qTotal = q("SELECT COUNT(*) n FROM question WHERE subject_id=?");
  const qDue = q("SELECT COUNT(*) n FROM question WHERE subject_id=? AND (due_at IS NULL OR due_at<=?)", now);
  const qLearned = q("SELECT COUNT(*) n FROM question WHERE subject_id=? AND reps>0 AND due_at>?", now);
  const learnTotal = cardsTotal + qTotal;
  const learned = cardsLearned + qLearned;
  return {
    cards: cardsTotal,
    due: cardsDue,               // drives study sessions -> must match the flashcards queue
    newCards: cardsNew,
    learned,                     // gelernt across cards + questions
    questions: qTotal,
    questionsDue: qDue,
    mastery: learnTotal ? Math.round((learned / learnTotal) * 100) : 0,
  };
}

// ---------- overview / dashboard ----------
api.get("/overview", wrap(() => {
  const subjects = db.prepare("SELECT * FROM subject ORDER BY created_at").all();
  const now = nowISO();
  const perSubject = subjects.map((s) => ({ ...s, ...subjectCounts(s.id, now) }));
  const totals = {
    subjects: subjects.length,
    cards: db.prepare("SELECT COUNT(*) n FROM card").get().n,
    dueToday: db.prepare("SELECT COUNT(*) n FROM card WHERE suspended=0 AND due_at<=?").get(now).n,
    reviews7d: db.prepare("SELECT COUNT(*) n FROM review_log WHERE reviewed_at >= ?").get(new Date(Date.now() - 7 * 864e5).toISOString()).n,
  };
  const last30 = db.prepare(
    "SELECT day, reviews, correct, new_cards, quiz_attempts, study_minutes FROM daily_stat WHERE day >= ? ORDER BY day"
  ).all(localDay(new Date(Date.now() - 29 * 864e5)));
  const retRow = db.prepare(
    "SELECT COUNT(*) n, SUM(CASE WHEN rating>0 THEN 1 ELSE 0 END) ok FROM review_log WHERE reviewed_at >= ?"
  ).get(new Date(Date.now() - 30 * 864e5).toISOString());
  const recentSessions = db.prepare(
    "SELECT ss.*, s.name subject_name, s.emoji FROM study_session ss LEFT JOIN subject s ON s.id=ss.subject_id WHERE ss.ended_at IS NOT NULL ORDER BY ss.started_at DESC LIMIT 8"
  ).all();
  return {
    totals,
    streak: computeStreak(),
    goal: Number(getSetting("daily_goal", 30)),
    todayReviews: db.prepare("SELECT reviews FROM daily_stat WHERE day=?").get(localDay())?.reviews || 0,
    retention: retRow.n ? Math.round((retRow.ok / retRow.n) * 100) : null,
    perSubject,
    last30,
    recentSessions,
  };
}));

// Lern-Historie: per calendar day, how many CARDS were answered CORRECTLY.
// Aggregated live from review_log.day (card answers only; quiz answers are
// separate) so wrong answers never raise the count and a reload stays accurate.
// `day` was written at review time via the single canonical dayKey() helper —
// grouping on it here (instead of re-deriving the day from reviewed_at) means
// storage and query are guaranteed to agree on calendar-day boundaries.
api.get("/stats/heatmap", wrap((req) => {
  const days = Math.min(Math.max(Number(req.query.days) || 140, 7), 400);
  const since = dayKey(new Date(Date.now() - days * 864e5));
  const rows = db.prepare(`
    SELECT day,
           SUM(CASE WHEN rating > 0 THEN 1 ELSE 0 END) AS correct,
           COUNT(*) AS answers
    FROM review_log
    WHERE day >= ?
    GROUP BY day
    ORDER BY day
  `).all(since);
  return { days, rows };
}));

// ---------- subjects ----------
api.get("/subjects", wrap(() =>
  db.prepare("SELECT * FROM subject ORDER BY created_at").all()
));

api.post("/subjects", wrap((req) => {
  const { name, description = "", color = "#3366ff", emoji = "📘" } = req.body || {};
  if (!name || !name.trim()) throw bad("name required");
  const id = uid();
  db.prepare("INSERT INTO subject(id,name,description,color,emoji,created_at) VALUES(?,?,?,?,?,?)")
    .run(id, name.trim(), description, color, emoji, nowISO());
  return db.prepare("SELECT * FROM subject WHERE id=?").get(id);
}));

api.get("/subjects/:id", wrap((req) => {
  const s = db.prepare("SELECT * FROM subject WHERE id=?").get(req.params.id);
  if (!s) throw bad("not found", 404);
  const now = nowISO();
  const materials = db.prepare(
    "SELECT id,title,status,source_type,lang,created_at,processed_at,error,LENGTH(content) chars FROM material WHERE subject_id=? ORDER BY created_at DESC"
  ).all(s.id);
  const counts = {
    ...subjectCounts(s.id, now),
    quizzes: db.prepare("SELECT COUNT(*) n FROM quiz WHERE subject_id=?").get(s.id).n,
  };
  const byType = db.prepare("SELECT type, COUNT(*) n FROM question WHERE subject_id=? GROUP BY type").all(s.id);
  const quizzes = db.prepare(
    `SELECT q.id,q.title,q.created_at,
       (SELECT COUNT(*) FROM quiz_question qq WHERE qq.quiz_id=q.id) questions,
       (SELECT MAX(score||'/'||total) FROM quiz_attempt qa WHERE qa.quiz_id=q.id) best
     FROM quiz q WHERE q.subject_id=? ORDER BY q.created_at DESC`
  ).all(s.id);
  return { subject: s, counts, questionsByType: byType, materials, quizzes };
}));

api.patch("/subjects/:id", wrap((req) => {
  const fields = ["name", "description", "color", "emoji"].filter((k) => k in (req.body || {}));
  if (!fields.length) throw bad("nothing to update");
  db.prepare(`UPDATE subject SET ${fields.map((f) => `${f}=@${f}`).join(",")} WHERE id=@id`)
    .run({ ...req.body, id: req.params.id });
  return db.prepare("SELECT * FROM subject WHERE id=?").get(req.params.id);
}));

api.delete("/subjects/:id", wrap((req) => {
  const id = req.params.id;
  const s = db.prepare("SELECT id FROM subject WHERE id=?").get(id);
  if (!s) throw bad("not found", 404);
  // review_log / material / card / question / quiz cascade via FK ON DELETE CASCADE.
  // study_session has no FK, so remove its rows explicitly.
  db.prepare("DELETE FROM study_session WHERE subject_id=?").run(id);
  db.prepare("DELETE FROM subject WHERE id=?").run(id);
  return { ok: true };
}));

// ---------- materials ----------
api.post("/subjects/:id/materials", wrap(async (req) => {
  const s = db.prepare("SELECT * FROM subject WHERE id=?").get(req.params.id);
  if (!s) throw bad("subject not found", 404);
  const { title, content, pdfBase64, filename } = req.body || {};

  let text = content || "";
  let sourceType = "paste";
  if (pdfBase64) {
    let buf;
    try {
      buf = Buffer.from(String(pdfBase64).replace(/^data:.*;base64,/, ""), "base64");
    } catch {
      throw bad("PDF konnte nicht gelesen werden");
    }
    if (!buf.length || buf.length > 25 * 1024 * 1024) throw bad("PDF fehlt oder ist größer als 25 MB");
    if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") throw bad("Datei ist kein gültiges PDF");
    let extracted;
    try {
      extracted = await extractPdfText(buf);
    } catch (e) {
      throw bad(`PDF-Textextraktion fehlgeschlagen: ${e.message}`);
    }
    text = extracted.text;
    sourceType = "pdf";
    if (!text || text.trim().length < 40) {
      throw bad("Im PDF wurde kaum Text gefunden – vermutlich ein gescanntes Bild-PDF ohne Text-Ebene (OCR).");
    }
  }

  if (!text || text.trim().length < 40) throw bad("Text zu kurz (mind. ~40 Zeichen)");
  const id = uid();
  const autoTitle = (title || filename?.replace(/\.pdf$/i, "") || "Ohne Titel").trim();
  db.prepare("INSERT INTO material(id,subject_id,title,content,source_type,status,created_at) VALUES(?,?,?,?,?,'pending',?)")
    .run(id, s.id, autoTitle, text.trim(), sourceType, nowISO());
  // kick off async generation now; scheduler also retries pending rows
  setImmediate(() => processMaterial(id));
  return db.prepare("SELECT id,title,status,source_type,created_at FROM material WHERE id=?").get(id);
}));

api.get("/materials/:id", wrap((req) => {
  const m = db.prepare("SELECT * FROM material WHERE id=?").get(req.params.id);
  if (!m) throw bad("not found", 404);
  let generated = {};
  try { generated = JSON.parse(m.generated || "{}"); } catch {}
  return {
    id: m.id, subjectId: m.subject_id, title: m.title, status: m.status, lang: m.lang,
    error: m.error, createdAt: m.created_at, processedAt: m.processed_at,
    chars: m.content.length, generated,
  };
}));

api.post("/materials/:id/reprocess", wrap((req) => {
  const m = db.prepare("SELECT * FROM material WHERE id=?").get(req.params.id);
  if (!m) throw bad("not found", 404);
  db.prepare("UPDATE material SET status='pending', error='' WHERE id=?").run(m.id);
  setImmediate(() => processMaterial(m.id));
  return { ok: true };
}));

api.post("/materials/:id/commit", wrap((req) => {
  const m = db.prepare("SELECT * FROM material WHERE id=?").get(req.params.id);
  if (!m) throw bad("not found", 404);
  const gen = JSON.parse(m.generated || "{}");
  const cardIdx = new Set(req.body?.cards ?? (gen.cards || []).map((_, i) => i));
  const qIdx = new Set(req.body?.questions ?? (gen.questions || []).map((_, i) => i));
  const now = nowISO();
  let addedCards = 0, addedQ = 0;

  const insCard = db.prepare(
    `INSERT INTO card(id,subject_id,material_id,type,front,back,hint,origin,created_at,due_at)
     VALUES(?,?,?,?,?,?,?,?,?,?)`
  );
  (gen.cards || []).forEach((c, i) => {
    if (!cardIdx.has(i)) return;
    insCard.run(uid(), m.subject_id, m.id, c.type || "basic", c.front, c.back, c.hint || "", c.origin || "heuristic", now, now);
    addedCards++;
  });

  const insQ = db.prepare(
    `INSERT INTO question(id,subject_id,material_id,type,prompt,options,answer,explanation,origin,created_at,due_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?)`
  );
  (gen.questions || []).forEach((q, i) => {
    if (!qIdx.has(i)) return;
    insQ.run(uid(), m.subject_id, m.id, q.type, q.prompt, JSON.stringify(q.options || []), q.answer, q.explanation || "", q.origin || "heuristic", now, now);
    addedQ++;
  });

  bumpDaily({ new_cards: addedCards, xp: addedCards * 2 + addedQ });
  db.prepare("UPDATE material SET status='committed', processed_at=? WHERE id=?").run(now, m.id);
  return { ok: true, addedCards, addedQuestions: addedQ };
}));

api.delete("/materials/:id", wrap((req) => {
  db.prepare("DELETE FROM material WHERE id=?").run(req.params.id);
  return { ok: true };
}));

// ---------- cards ----------
api.get("/subjects/:id/cards", wrap((req) => {
  const rows = db.prepare(
    "SELECT * FROM card WHERE subject_id=? ORDER BY created_at DESC LIMIT 500"
  ).all(req.params.id);
  const now = nowISO();
  return rows.map((c) => ({
    ...c,
    stateLabel: c.reps === 0 ? "neu" : c.leech ? "Problemkarte" : c.due_at > now ? "gelernt" : "fällig",
    isDue: c.suspended === 0 && c.due_at <= now,
    dueHuman: humanInterval(c.interval),
  }));
}));

api.post("/subjects/:id/cards", wrap((req) => {
  const s = db.prepare("SELECT * FROM subject WHERE id=?").get(req.params.id);
  if (!s) throw bad("subject not found", 404);
  const { front, back, type = "basic", hint = "" } = req.body || {};
  if (!front || !back) throw bad("front and back required");
  const id = uid(), now = nowISO();
  db.prepare(
    "INSERT INTO card(id,subject_id,type,front,back,hint,origin,created_at,due_at) VALUES(?,?,?,?,?,?,'manual',?,?)"
  ).run(id, s.id, type, front, back, hint, now, now);
  return db.prepare("SELECT * FROM card WHERE id=?").get(id);
}));

api.patch("/cards/:id", wrap((req) => {
  const allowed = ["front", "back", "hint", "type", "suspended"];
  const fields = allowed.filter((k) => k in (req.body || {}));
  if (!fields.length) throw bad("nothing to update");
  db.prepare(`UPDATE card SET ${fields.map((f) => `${f}=@${f}`).join(",")} WHERE id=@id`)
    .run({ ...req.body, id: req.params.id });
  return db.prepare("SELECT * FROM card WHERE id=?").get(req.params.id);
}));

api.delete("/cards/:id", wrap((req) => {
  db.prepare("DELETE FROM card WHERE id=?").run(req.params.id);
  return { ok: true };
}));

// ---------- review queue + grading ----------
// The queue is exactly the set of currently-due cards for the subject, derived live
// from due_at <= now (UTC). No per-day cap: the count shown in the overview and the
// cards served here are always the same set. `mode` narrows it for practice modes.
api.get("/subjects/:id/review/queue", wrap((req) => {
  const now = nowISO();
  const mode = String(req.query.mode || "flashcards");
  let typeClause = "";
  if (mode === "cloze") typeClause = " AND type='cloze'";
  else if (mode === "write") typeClause = " AND type='basic'";
  const rows = db.prepare(
    `SELECT * FROM card WHERE subject_id=? AND suspended=0 AND due_at<=?${typeClause} ORDER BY due_at, created_at`
  ).all(req.params.id, now);
  return {
    queue: rows.map(cardView),
    intervalDays: intervalDays(),
    counts: { due: rows.length },
  };
}));

api.post("/cards/:id/review", wrap((req) => {
  const c = db.prepare("SELECT * FROM card WHERE id=?").get(req.params.id);
  if (!c) throw bad("card not found", 404);
  const rating = Number(req.body?.rating);
  if (![0, 1, 2, 3].includes(rating)) throw bad("rating must be 0..3");
  const wasNew = c.reps === 0;
  const now = new Date();
  const s = schedule(c, rating, intervalDays());
  db.prepare(
    "UPDATE card SET ease=?, interval=?, reps=?, lapses=?, leech=?, due_at=?, last_review=? WHERE id=?"
  ).run(s.ease, s.interval, s.reps, s.lapses, s.leech, s.due_at, s.last_review, c.id);
  db.prepare(
    "INSERT INTO review_log(id,card_id,subject_id,rating,prev_interval,next_interval,elapsed_ms,reviewed_at,day) VALUES(?,?,?,?,?,?,?,?,?)"
  ).run(uid(), c.id, c.subject_id, rating, s.prev_interval, s.next_interval, Number(req.body?.elapsedMs) || 0, now.toISOString(), dayKey(now));
  bumpDaily({
    reviews: 1,
    correct: rating > 0 ? 1 : 0,
    new_cards: wasNew ? 1 : 0,
    study_minutes: Math.min((Number(req.body?.elapsedMs) || 0) / 60000, 3),
    xp: rating === 0 ? 1 : 3,
  });
  return { ok: true, next: humanInterval(s.next_interval), correct: rating > 0, streak: computeStreak() };
}));

// ---------- study sessions (lightweight, for summaries) ----------
api.post("/sessions", wrap((req) => {
  const id = uid();
  db.prepare("INSERT INTO study_session(id,subject_id,mode,started_at) VALUES(?,?,?,?)")
    .run(id, req.body?.subjectId || null, req.body?.mode || "flashcards", nowISO());
  return { id };
}));
api.patch("/sessions/:id", wrap((req) => {
  db.prepare("UPDATE study_session SET cards_seen=?, correct=?, ended_at=? WHERE id=?")
    .run(Number(req.body?.cardsSeen) || 0, Number(req.body?.correct) || 0, nowISO(), req.params.id);
  return { ok: true };
}));

// ---------- questions / quizzes ----------
api.get("/subjects/:id/questions", wrap((req) =>
  db.prepare("SELECT id,type,prompt,options,answer,explanation,times_seen,times_correct FROM question WHERE subject_id=? ORDER BY created_at DESC")
    .all(req.params.id)
    .map((q) => ({ ...q, options: JSON.parse(q.options || "[]") }))
));

api.post("/subjects/:id/quizzes", wrap((req) => {
  const s = db.prepare("SELECT * FROM subject WHERE id=?").get(req.params.id);
  if (!s) throw bad("subject not found", 404);
  const size = Math.max(3, Math.min(Number(req.body?.size) || 10, 40));
  const types = Array.isArray(req.body?.types) && req.body.types.length ? req.body.types : ["mc", "truefalse", "cloze", "short"];
  const now = nowISO();
  const placeholders = types.map(() => "?").join(",");
  // Prefer questions that are currently due, then least-seen, then random.
  const pool = db.prepare(
    `SELECT * FROM question WHERE subject_id=? AND type IN (${placeholders})
     ORDER BY (CASE WHEN due_at IS NULL OR due_at<=? THEN 0 ELSE 1 END) ASC, times_seen ASC, RANDOM() LIMIT ?`
  ).all(s.id, ...types, now, size * 3);
  if (!pool.length) throw bad("Noch keine Fragen vorhanden. Erst Material hinzufügen und übernehmen.");
  for (let i = pool.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const chosen = pool.slice(0, size);
  const quizId = uid();
  db.prepare("INSERT INTO quiz(id,subject_id,title,config,created_at) VALUES(?,?,?,?,?)")
    .run(quizId, s.id, req.body?.title || `Quiz ${new Date().toLocaleDateString("de-DE")}`, JSON.stringify({ size, types }), now);
  const insQ = db.prepare(
    "INSERT INTO quiz_question(id,quiz_id,question_id,type,prompt,options,answer,explanation,ord) VALUES(?,?,?,?,?,?,?,?,?)"
  );
  chosen.forEach((q, i) => insQ.run(uid(), quizId, q.id, q.type, q.prompt, q.options, q.answer, q.explanation, i));
  return { id: quizId };
}));

api.get("/quizzes/:id", wrap((req) => {
  const q = db.prepare("SELECT * FROM quiz WHERE id=?").get(req.params.id);
  if (!q) throw bad("not found", 404);
  const questions = db.prepare("SELECT id,type,prompt,options,ord FROM quiz_question WHERE quiz_id=? ORDER BY ord").all(q.id)
    .map((x) => ({ ...x, options: shuffleOpts(JSON.parse(x.options || "[]")) }));
  const attempts = db.prepare("SELECT score,total,finished_at FROM quiz_attempt WHERE quiz_id=? AND finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 5").all(q.id);
  return { id: q.id, title: q.title, subjectId: q.subject_id, questions, attempts };
}));

function shuffleOpts(opts) {
  const a = [...opts];
  for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Grade a single quiz answer AND move the underlying bank question through the
// same fixed-interval schedule as cards: correct -> "gelernt" (due in intervalDays),
// wrong -> immediately "fällig" even if it was "gelernt".
function applyQuestionResult(questionId, correct) {
  if (!questionId) return;
  const q = db.prepare("SELECT * FROM question WHERE id=?").get(questionId);
  if (!q) return;
  const s = schedule(q, correct ? 2 : 0, intervalDays());
  db.prepare(
    "UPDATE question SET reps=?, lapses=?, due_at=?, last_review=?, times_seen=times_seen+1, times_correct=times_correct+? WHERE id=?"
  ).run(s.reps, s.lapses, s.due_at, s.last_review, correct ? 1 : 0, questionId);
}

api.post("/quizzes/:id/check", wrap((req) => {
  const qq = db.prepare("SELECT * FROM quiz_question WHERE id=? AND quiz_id=?").get(req.body?.questionId, req.params.id);
  if (!qq) throw bad("question not found", 404);
  const value = String(req.body?.value ?? "");
  const correct = qq.type === "mc" || qq.type === "truefalse"
    ? value.trim() === qq.answer.trim()
    : gradeText(qq.answer, value);
  applyQuestionResult(qq.question_id, correct);
  bumpDaily({ reviews: 1, correct: correct ? 1 : 0, xp: correct ? 3 : 1 });
  return { correct, answer: qq.answer, explanation: qq.explanation };
}));

api.post("/quizzes/:id/attempt", wrap((req) => {
  const quiz = db.prepare("SELECT * FROM quiz WHERE id=?").get(req.params.id);
  if (!quiz) throw bad("not found", 404);
  const answers = req.body?.answers || {};
  const checkedIds = new Set(Array.isArray(req.body?.checkedIds) ? req.body.checkedIds : []);
  const questions = db.prepare("SELECT * FROM quiz_question WHERE quiz_id=? ORDER BY ord").all(quiz.id);
  let score = 0;
  const detail = questions.map((qq) => {
    const given = String(answers[qq.id] ?? "");
    const correct = qq.type === "mc" || qq.type === "truefalse"
      ? given.trim() === qq.answer.trim()
      : gradeText(qq.answer, given);
    if (correct) score++;
    // Scheduling/stats normally happen live in /check; apply here only for any
    // question that was not individually checked (defensive).
    if (!checkedIds.has(qq.id)) applyQuestionResult(qq.question_id, correct);
    return { id: qq.id, prompt: qq.prompt, type: qq.type, given, answer: qq.answer, explanation: qq.explanation, correct };
  });
  const now = nowISO();
  db.prepare("INSERT INTO quiz_attempt(id,quiz_id,subject_id,score,total,detail,started_at,finished_at) VALUES(?,?,?,?,?,?,?,?)")
    .run(uid(), quiz.id, quiz.subject_id, score, questions.length, JSON.stringify(detail), req.body?.startedAt || now, now);
  bumpDaily({ quiz_attempts: 1, xp: score * 3, study_minutes: Math.min((Number(req.body?.elapsedMs) || 0) / 60000, 10) });
  return { score, total: questions.length, pct: Math.round((score / Math.max(questions.length, 1)) * 100), detail, streak: computeStreak() };
}));

api.delete("/quizzes/:id", wrap((req) => {
  db.prepare("DELETE FROM quiz WHERE id=?").run(req.params.id);
  return { ok: true };
}));

// ---------- settings ----------
api.get("/settings", wrap(() => ({
  daily_goal: Number(getSetting("daily_goal", 30)),
  review_interval_days: Number(getSetting("review_interval_days", 3)),
  ai: process.env.LLM_PROVIDER === "anthropic" && !!process.env.ANTHROPIC_API_KEY,
})));
api.put("/settings", wrap((req) => {
  if ("daily_goal" in (req.body || {})) setSetting("daily_goal", Math.max(0, Number(req.body.daily_goal) || 0));
  if ("review_interval_days" in (req.body || {})) {
    const v = Math.round(Number(req.body.review_interval_days));
    if (!Number.isFinite(v) || v < 1 || v > 365) throw bad("Intervall muss zwischen 1 und 365 Tagen liegen");
    setSetting("review_interval_days", v);
  }
  return { ok: true };
}));

api.get("/health", wrap(() => ({ ok: true, time: nowISO(), ai: process.env.LLM_PROVIDER === "anthropic" && !!process.env.ANTHROPIC_API_KEY })));

// demo seed for first-run exploration
api.post("/demo", wrap(async () => {
  const existing = db.prepare("SELECT COUNT(*) n FROM subject").get().n;
  if (existing > 0) return { ok: true, skipped: true };
  const { seedDemo } = await import("./demo.js");
  return seedDemo();
}));

app.use("/api", api);

// ---------- static (production) ----------
const dist = join(__dirname, "..", "dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) return res.status(404).json({ error: "not found" });
    res.sendFile(join(dist, "index.html"));
  });
}

// First-run: seed demo content so the app is explorable immediately.
if (process.env.SF_NO_SEED !== "1" && db.prepare("SELECT COUNT(*) n FROM subject").get().n === 0) {
  try {
    const { seedDemo } = await import("./demo.js");
    const r = seedDemo();
    console.log(`  Beispieldaten angelegt: ${r.subjects} Fächer, ${r.cards} Karten, ${r.questions} Fragen`);
  } catch (e) {
    console.warn("  Demo-Seed übersprungen:", e.message);
  }
}

const PORT = Number(process.env.PORT) || 8787;
app.listen(PORT, () => {
  console.log(`\n  StudyForge  ->  http://localhost:${PORT}`);
  console.log(`  API         ->  http://localhost:${PORT}/api/health`);
  console.log(`  AI-Generierung: ${process.env.LLM_PROVIDER === "anthropic" && process.env.ANTHROPIC_API_KEY ? "aktiv (Anthropic)" : "aus (Heuristik)"}\n`);
  startScheduler();
});
