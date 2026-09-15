// Canonical local calendar-day key: YYYY-MM-DD in the runtime's own local timezone.
//
// This is the ONLY function anywhere in the app (server or client) allowed to turn a
// moment in time into a "day". Storage (what gets written to review_log.day) and
// queries/rendering (grouping, the heatmap grid, "is this cell in the future") must
// all go through this — never SQL date()/'localtime', never UTC slicing, never a
// second hand-rolled version. That is what keeps server and browser agreeing on
// which calendar day an answer belongs to.
export function dayKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
