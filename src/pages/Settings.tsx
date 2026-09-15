import { useEffect, useState } from "react";
import { Sparkles, Cpu, Target, CalendarClock, Info } from "lucide-react";
import { api } from "../lib/api";
import { useAsync, Spinner, useToast } from "../lib/ui";

export default function Settings() {
  const { data, loading, reload } = useAsync(() => api.settings(), []);
  const toast = useToast();
  const [goal, setGoal] = useState(30);
  const [ivl, setIvl] = useState(3);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) { setGoal(data.daily_goal); setIvl(data.review_interval_days); }
  }, [data]);

  const save = async () => {
    setSaving(true);
    try { await api.saveSettings({ daily_goal: goal, review_interval_days: ivl }); toast("ok", "Gespeichert"); reload(); }
    catch (e: any) { toast("err", e.message); } finally { setSaving(false); }
  };

  if (loading || !data) return <div className="flex justify-center py-20"><Spinner className="h-6 w-6 text-brand-500" /></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Einstellungen</h1>
        <p className="text-sm text-slate-500">Lernpensum und Generierung.</p>
      </div>

      <div className="card space-y-5 p-5">
        <div>
          <label className="mb-1 flex items-center justify-between text-sm font-semibold"><span className="flex items-center gap-2"><Target size={15} className="text-brand-500" /> Tagesziel (Wiederholungen)</span><span className="text-slate-400">{goal}</span></label>
          <input type="range" min={5} max={120} step={5} value={goal} onChange={(e) => setGoal(+e.target.value)} className="w-full accent-brand-500" />
        </div>
        <div>
          <label className="mb-1 flex items-center justify-between text-sm font-semibold"><span className="flex items-center gap-2"><CalendarClock size={15} className="text-brand-500" /> Wiederhol-Intervall</span><span className="text-slate-400">{ivl} {ivl === 1 ? "Tag" : "Tage"}</span></label>
          <input type="range" min={1} max={30} step={1} value={ivl} onChange={(e) => setIvl(+e.target.value)} className="w-full accent-brand-500" />
          <p className="mt-1 text-xs text-slate-400">Nach einer richtigen Antwort ist die Karte/Frage genau so viele Tage später wieder fällig. Festes Intervall – es wächst nicht mit weiteren richtigen Antworten.</p>
        </div>
        <button className="btn-primary" onClick={save} disabled={saving}>{saving ? <Spinner className="h-4 w-4" /> : "Speichern"}</button>
      </div>

      <div className="card p-5">
        <h2 className="mb-2 flex items-center gap-2 font-bold"><Cpu size={16} className="text-brand-500" /> Generierung</h2>
        <div className="flex items-center gap-2 text-sm">
          <span className={`chip ${data.ai ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>
            {data.ai ? "KI aktiv (Anthropic)" : "Offline-Heuristik"}
          </span>
        </div>
        <p className="mt-2 flex gap-2 text-xs text-slate-400">
          <Info size={13} className="mt-0.5 shrink-0" />
          Standardmäßig erzeugt StudyForge Karten &amp; Fragen komplett lokal aus dem Text (Definitions- und Begriffserkennung, Lückentexte, Distraktoren).
          Für noch bessere Ergebnisse <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">LLM_PROVIDER=anthropic</code> und <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">ANTHROPIC_API_KEY</code> in <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">.env</code> setzen.
        </p>
      </div>

      <div className="card p-5">
        <h2 className="mb-2 font-bold">Beispieldaten</h2>
        <p className="mb-3 text-xs text-slate-400">Fügt zwei Beispiel-Fächer mit fertigen Karten &amp; Fragen hinzu (nur wenn noch keine Fächer existieren).</p>
        <button className="btn-outline" onClick={() => api.seedDemo().then((r) => toast(r.skipped ? "info" : "ok", r.skipped ? "Übersprungen – es gibt bereits Fächer" : "Beispieldaten geladen"))}>
          <Sparkles size={15} /> Beispieldaten laden
        </button>
      </div>
    </div>
  );
}
