import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Flame, Zap, Layers, Target, GraduationCap, ArrowRight, Sparkles, CalendarDays } from "lucide-react";
import { api } from "../lib/api";
import { useAsync, Spinner, ProgressRing, EmptyState, useToast } from "../lib/ui";
import { fmtDate, greeting, relTime, MODE_LABEL } from "../lib/format";
import { HEATMAP_LEVELS, heatmapLevelFor } from "../lib/heatmap";
import { onReviewed } from "../lib/events";
import { dayKey } from "../../shared/day";

function Tile({ icon, label, value, sub, tone = "brand" }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; tone?: string }) {
  const tones: Record<string, string> = {
    brand: "text-brand-500 bg-brand-500/10",
    amber: "text-amber-500 bg-amber-500/10",
    emerald: "text-emerald-500 bg-emerald-500/10",
    violet: "text-violet-500 bg-violet-500/10",
  };
  return (
    <div className="card p-4">
      <div className={`mb-3 grid h-9 w-9 place-items-center rounded-lg ${tones[tone]}`}>{icon}</div>
      <div className="text-2xl font-extrabold tracking-tight">{value}</div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      {sub && <div className="mt-1 text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

function Heatmap({ rows, weeks = 20 }: { rows: { day: string; correct: number }[]; weeks?: number }) {
  const map = new Map(rows.map((r) => [r.day, r.correct]));
  const todayKey = dayKey();
  // Anchor on the Monday of the CURRENT week first, then step back whole weeks —
  // never snap-back a "weeks*7 days ago" date to Monday, which silently drops the
  // last few days (including today) off the end whenever today isn't a Monday.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentMonday = new Date(today);
  currentMonday.setDate(currentMonday.getDate() - ((currentMonday.getDay() + 6) % 7));
  const start = new Date(currentMonday);
  start.setDate(start.getDate() - (weeks - 1) * 7);

  const cols: { key: string; date: Date; count: number }[][] = [];
  const monthLabels: { col: number; label: string }[] = [];
  const cursor = new Date(start);
  for (let w = 0; w < weeks; w++) {
    const col: { key: string; date: Date; count: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const key = dayKey(cursor);
      col.push({ key, date: new Date(cursor), count: map.get(key) || 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    if (col[0].date.getDate() <= 7) monthLabels.push({ col: w, label: col[0].date.toLocaleDateString("de-DE", { month: "short" }) });
    cols.push(col);
  }

  const fmtCell = (c: { date: Date; count: number }) =>
    `${c.date.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })} · ` +
    (c.count === 0 ? "nichts gelernt" : c.count === 1 ? "1 Karte richtig gelernt" : `${c.count} Karten richtig gelernt`);

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex flex-col gap-1">
        <div className="flex gap-[3px] pl-0 text-[9px] text-slate-400">
          {cols.map((_, w) => {
            const m = monthLabels.find((x) => x.col === w);
            return <span key={w} className="w-3 shrink-0">{m ? m.label : ""}</span>;
          })}
        </div>
        <div className="flex gap-[3px]">
          {cols.map((col, w) => (
            <div key={w} className="flex flex-col gap-[3px]">
              {col.map((c) => (
                <div
                  key={c.key}
                  title={fmtCell(c)}
                  className={`h-3 w-3 rounded-[3px] ${heatmapLevelFor(c.count).cellClass} ${c.key > todayKey ? "opacity-0" : ""}`}
                />
              ))}
            </div>
          ))}
        </div>
        <HeatmapLegend />
      </div>
    </div>
  );
}

// Built directly from HEATMAP_LEVELS — legend and cells read the same array, so
// they can never show different colours for the same range.
function HeatmapLegend() {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
      <span>Karten pro Tag:</span>
      {HEATMAP_LEVELS.map((l) => (
        <span key={l.label} className="inline-flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded-[3px] ${l.cellClass}`} />
          {l.label}
        </span>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { data, loading, error, reload } = useAsync(() => api.overview(), []);
  const heat = useAsync(() => api.heatmap(140), []);
  const toast = useToast();

  // Live update: every recorded card review (from anywhere in the app) refreshes
  // the stats + Lern-Historie immediately, no page reload needed.
  useEffect(() => onReviewed(() => { reload(); heat.reload(); }), [reload, heat.reload]);

  if (loading) return <div className="flex justify-center py-24"><Spinner className="h-6 w-6 text-brand-500" /></div>;
  if (error) return <p className="text-rose-500">Fehler: {error}</p>;
  if (!data) return null;

  const empty = data.totals.subjects === 0;
  const goalPct = data.goal ? Math.min(100, Math.round((data.todayReviews / data.goal) * 100)) : 0;
  const chartData = data.last30.map((d) => ({ ...d, label: fmtDate(d.day) }));
  const topDue = [...data.perSubject].sort((a, b) => b.due - a.due)[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{greeting()} 👋</h1>
          <p className="text-sm text-slate-500">
            {empty ? "Lege ein Fach an und füge Studienmaterial ein." :
              data.totals.dueToday > 0 ? `${data.totals.dueToday} Karten warten heute auf dich.` : "Alles wiederholt — stark!"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="chip bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Flame size={14} /> {data.streak} Tage Streak
          </div>
        </div>
      </div>

      {empty ? (
        <EmptyState
          icon={<GraduationCap size={40} />}
          title="Noch nichts zum Lernen"
          hint="Starte mit den Beispielfächern oder lege direkt dein eigenes an."
          action={
            <div className="flex gap-2">
              <button className="btn-primary" onClick={() => api.seedDemo().then(() => { toast("ok", "Beispieldaten geladen"); reload(); heat.reload(); })}>
                <Sparkles size={16} /> Beispieldaten laden
              </button>
              <Link className="btn-outline" to="/subjects">Fach anlegen</Link>
            </div>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile tone="brand" icon={<Zap size={18} />} label="Fällig heute" value={data.totals.dueToday} sub={`${data.todayReviews} heute wiederholt`} />
            <Tile tone="violet" icon={<Layers size={18} />} label="Karten gesamt" value={data.totals.cards} sub={`${data.totals.subjects} Fächer`} />
            <Tile tone="emerald" icon={<Target size={18} />} label="Retention (30 T.)" value={data.retention == null ? "–" : `${data.retention}%`} sub="korrekt beantwortet" />
            <Tile tone="amber" icon={<GraduationCap size={18} />} label="Wdh. (7 T.)" value={data.totals.reviews7d} sub="Reviews gesamt" />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="card p-5 lg:col-span-2">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="font-bold">Aktivität</h2>
                <span className="text-xs text-slate-400">letzte 30 Tage</span>
              </div>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 6, bottom: 0, left: -22 }}>
                    <defs>
                      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3366ff" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#3366ff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={5} stroke="currentColor" className="text-slate-400" />
                    <YAxis tick={{ fontSize: 11 }} stroke="currentColor" className="text-slate-400" allowDecimals={false} width={40} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid rgba(148,163,184,.3)", fontSize: 12, background: "rgba(15,23,42,.92)", color: "#fff" }}
                      labelStyle={{ color: "#cbd5e1" }}
                      formatter={(v: number, n) => [v, n === "reviews" ? "Wiederholungen" : n === "correct" ? "davon korrekt" : n]}
                    />
                    <Area type="monotone" dataKey="reviews" stroke="#3366ff" strokeWidth={2} fill="url(#g)" />
                    <Area type="monotone" dataKey="correct" stroke="#22c55e" strokeWidth={1.5} fillOpacity={0} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card flex flex-col p-5">
              <h2 className="mb-3 font-bold">Tagesziel</h2>
              <div className="flex items-center gap-4">
                <ProgressRing value={goalPct} size={72} stroke={8} />
                <div>
                  <div className="text-2xl font-extrabold">{data.todayReviews}<span className="text-base font-medium text-slate-400"> / {data.goal}</span></div>
                  <div className="text-xs text-slate-500">Wiederholungen heute</div>
                </div>
              </div>
              {topDue && topDue.due > 0 ? (
                <Link to={`/study/${topDue.id}`} className="btn-primary mt-auto w-full">
                  Jetzt lernen: {topDue.emoji} {topDue.name.split(":")[0]} <ArrowRight size={16} />
                </Link>
              ) : (
                <Link to="/subjects" className="btn-outline mt-auto w-full">Zu den Fächern</Link>
              )}
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-1 flex items-center gap-2"><CalendarDays size={16} className="text-slate-400" /><h2 className="font-bold">Lern-Historie</h2></div>
            <p className="mb-3 text-[11px] text-slate-400">Farbintensität = Anzahl der an diesem Tag <b>richtig</b> gelernten Karten (falsche zählen nicht).</p>
            {heat.loading ? (
              <div className="flex h-28 items-center"><Spinner className="h-4 w-4 text-brand-500" /></div>
            ) : (
              <Heatmap rows={heat.data?.rows ?? []} />
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="card p-5 lg:col-span-2">
              <h2 className="mb-4 font-bold">Fächer-Fortschritt</h2>
              <div className="space-y-3">
                {data.perSubject.map((s) => (
                  <Link key={s.id} to={`/subjects/${s.id}`} className="flex items-center gap-4 rounded-xl p-2 transition hover:bg-slate-100 dark:hover:bg-slate-800/60">
                    <ProgressRing value={s.mastery} color={s.color} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 font-semibold"><span>{s.emoji}</span><span className="truncate">{s.name}</span></div>
                      <div className="text-xs text-slate-500">{s.cards} Karten · {s.learned} gelernt · {s.questions} Fragen</div>
                    </div>
                    {s.due > 0 && <span className="chip bg-brand-500/10 text-brand-600 dark:text-brand-300">{s.due} fällig</span>}
                  </Link>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-500">Letzte Sitzungen</h3>
              <div className="space-y-1.5">
                {data.recentSessions.length === 0 && <p className="text-xs text-slate-400">Noch keine.</p>}
                {data.recentSessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-xs">
                    <span className="truncate">{s.emoji || "📘"} {MODE_LABEL[s.mode] || s.mode}</span>
                    <span className="text-slate-400">{s.correct}/{s.cards_seen} · {relTime(s.started_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
