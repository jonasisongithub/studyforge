// Lern-Historie colour scale: ONE fixed, absolute step function — never relative
// to other days, never a max/quantile, never interpolated. A day with 12 correct
// cards always renders the same shade, no matter what happened on any other day.
//
// The legend is built directly from this array (see Dashboard.tsx), so the legend
// and the cell colours can never drift apart.
export type HeatLevel = {
  /** Inclusive lower bound of this level, in correctly-answered cards for the day. */
  min: number;
  /** Legend text. */
  label: string;
  /** Fully written-out Tailwind classes (light + dark) — never composed dynamically. */
  cellClass: string;
};

export const HEATMAP_LEVELS: readonly HeatLevel[] = [
  { min: 0, label: "0", cellClass: "bg-slate-200 dark:bg-slate-800" },
  { min: 1, label: "1–9", cellClass: "bg-brand-200 dark:bg-brand-900" },
  { min: 10, label: "10–24", cellClass: "bg-brand-400 dark:bg-brand-700" },
  { min: 25, label: "25–49", cellClass: "bg-brand-600 dark:bg-brand-500" },
  { min: 50, label: "50+", cellClass: "bg-brand-800 dark:bg-brand-300" },
];

export function heatmapLevelFor(count: number): HeatLevel {
  let level = HEATMAP_LEVELS[0];
  for (const l of HEATMAP_LEVELS) {
    if (count >= l.min) level = l;
  }
  return level;
}
