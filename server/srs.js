// Fixed-interval scheduling.
//
// - A correct answer (rating > 0) moves the item to "gelernt" and sets it due again
//   exactly `intervalDays` after the moment of the answer. The interval is fixed and
//   does NOT grow with further correct answers.
// - A wrong answer (rating 0) makes the item due immediately ("fällig"), even if it
//   was "gelernt" before.
// - "Due" is never stored as a flag — it is always derived from `due_at <= now` (UTC),
//   so it is recomputed on every read (app open / session start).
//
// rating: 0 = falsch/nochmal, >0 = richtig

const DAY_MS = 86_400_000;

export function schedule(item, rating, intervalDays, now = new Date()) {
  const correct = rating > 0;
  const reps = (item.reps || 0) + 1;
  const lapses = (item.lapses || 0) + (correct ? 0 : 1);
  const days = Math.max(Number(intervalDays) || 0, 0);
  const dueAt = correct ? new Date(now.getTime() + days * DAY_MS) : new Date(now.getTime());
  return {
    ease: item.ease ?? 2.5, // kept for column stability, unused
    interval: correct ? days : 0,
    reps,
    lapses,
    leech: lapses >= 8 ? 1 : 0,
    due_at: dueAt.toISOString(),
    last_review: now.toISOString(),
    prev_interval: item.interval ?? 0,
    next_interval: correct ? days : 0,
  };
}

export function humanInterval(days) {
  if (!days || days <= 0) return "jetzt";
  if (days < 1) return `${Math.round(days * 24)} Std`;
  if (days === 1) return "1 Tag";
  if (days < 30) return `${Math.round(days)} Tage`;
  if (days < 365) return `${Math.round(days / 30)} Mon`;
  return `${(days / 365).toFixed(1)} Jr`;
}
