// Background worker: processes freshly-added material into cards/questions,
// flags "leech" cards, rolls the daily stat over, and closes stale sessions.
// Intentionally simple: one timer, no external queue.

import { db, nowISO } from "./db.js";
import { generate } from "./generate.js";

let running = false;
let lastMaintenance = 0;

export async function processMaterial(id) {
  const m = db.prepare("SELECT * FROM material WHERE id=?").get(id);
  if (!m || (m.status !== "pending" && m.status !== "processing")) return;
  db.prepare("UPDATE material SET status='processing' WHERE id=?").run(id);
  try {
    const t0 = Date.now();
    const result = await generate(m.content);
    db.prepare("UPDATE material SET status='ready', lang=?, generated=?, processed_at=?, error='' WHERE id=?")
      .run(result.lang || "de", JSON.stringify(result), nowISO(), id);
    console.log(`[worker] material ${id.slice(0, 8)} -> ${result.cards.length} Karten / ${result.questions.length} Fragen (${Date.now() - t0}ms)`);
  } catch (err) {
    console.error(`[worker] material ${id.slice(0, 8)} failed:`, err);
    db.prepare("UPDATE material SET status='error', error=? WHERE id=?").run(String(err.message || err), id);
  }
}

async function tick() {
  if (running) return;
  running = true;
  try {
    // recover rows stuck in "processing" (e.g. after a restart)
    db.prepare("UPDATE material SET status='pending' WHERE status='processing' AND created_at < ?")
      .run(new Date(Date.now() - 3 * 60000).toISOString());

    const pending = db.prepare("SELECT id FROM material WHERE status='pending' ORDER BY created_at LIMIT 3").all();
    for (const row of pending) await processMaterial(row.id);

    if (Date.now() - lastMaintenance > 5 * 60000) {
      lastMaintenance = Date.now();
      maintenance();
    }
  } finally {
    running = false;
  }
}

function maintenance() {
  const leech = db.prepare("UPDATE card SET leech=1 WHERE leech=0 AND lapses>=8").run();
  const sessions = db.prepare(
    "UPDATE study_session SET ended_at=started_at WHERE ended_at IS NULL AND started_at < ?"
  ).run(new Date(Date.now() - 6 * 3600_000).toISOString());
  const day = new Date();
  const z = new Date(day.getTime() - day.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  db.prepare("INSERT INTO daily_stat(day) VALUES(?) ON CONFLICT(day) DO NOTHING").run(z);
  if (leech.changes || sessions.changes)
    console.log(`[worker] maintenance: ${leech.changes} Problemkarten markiert, ${sessions.changes} Sitzungen geschlossen`);
}

export function startScheduler() {
  setInterval(() => { tick().catch((e) => console.error("[worker] tick error", e)); }, 3000);
  // first run shortly after boot
  setTimeout(() => tick().catch(() => {}), 800);
  console.log("[worker] Hintergrund-Scheduler gestartet (Intervall 3s)");
}
