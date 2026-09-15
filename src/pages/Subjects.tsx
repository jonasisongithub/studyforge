import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Sparkles, BookOpen } from "lucide-react";
import { api } from "../lib/api";
import { useAsync, Spinner, Modal, EmptyState, useToast, ProgressRing } from "../lib/ui";

const EMOJIS = ["📘", "🧬", "🌐", "⚗️", "📐", "🧠", "💻", "🏛️", "🩺", "🗣️", "📊", "🎼"];
const COLORS = ["#3366ff", "#22c55e", "#a855f7", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#14b8a6"];

export default function Subjects() {
  const { data, loading, error, reload } = useAsync(() => api.subjects(), []);
  const detail = useAsync(() => api.overview(), []);
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", emoji: EMOJIS[0], color: COLORS[0] });
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      await api.createSubject(form);
      toast("ok", "Fach angelegt");
      setOpen(false);
      setForm({ name: "", description: "", emoji: EMOJIS[0], color: COLORS[0] });
      reload();
      detail.reload();
    } catch (e: any) { toast("err", e.message); } finally { setBusy(false); }
  };

  const stat = (id: string) => detail.data?.perSubject.find((s) => s.id === id);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Fächer</h1>
          <p className="text-sm text-slate-500">Sammle Material pro Thema und erzeuge daraus Karten &amp; Quizze.</p>
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Neues Fach</button>
      </div>

      {loading && <div className="flex justify-center py-20"><Spinner className="h-6 w-6 text-brand-500" /></div>}
      {error && <p className="text-rose-500">Fehler: {error}</p>}

      {data && data.length === 0 && (
        <EmptyState
          icon={<BookOpen size={40} />}
          title="Noch keine Fächer"
          hint="Leg dein erstes Fach an oder lade Beispieldaten zum Ausprobieren."
          action={
            <div className="flex gap-2">
              <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Fach anlegen</button>
              <button className="btn-outline" onClick={() => api.seedDemo().then(() => { toast("ok", "Beispieldaten geladen"); reload(); detail.reload(); })}>
                <Sparkles size={16} /> Beispiele
              </button>
            </div>
          }
        />
      )}

      {data && data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((s) => {
            const st = stat(s.id);
            return (
              <Link key={s.id} to={`/subjects/${s.id}`} className="card group p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="grid h-11 w-11 place-items-center rounded-xl text-xl" style={{ background: `${s.color}1a` }}>{s.emoji}</div>
                  {st && <ProgressRing value={st.mastery} color={s.color} />}
                </div>
                <h3 className="mt-3 font-bold leading-tight">{s.name}</h3>
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{s.description || "Keine Beschreibung"}</p>
                <div className="mt-4 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="chip bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{st?.cards ?? 0} Karten</span>
                  <span className="chip bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{st?.questions ?? 0} Fragen</span>
                  {st && st.due > 0 && <span className="chip bg-brand-500/10 text-brand-600 dark:text-brand-300">{st.due} fällig</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Neues Fach">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Name</label>
            <input autoFocus className="input" placeholder="z. B. Anatomie – Bewegungsapparat" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && create()} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Beschreibung (optional)</label>
            <input className="input" placeholder="Kurznotiz" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex gap-6">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">Symbol</label>
              <div className="flex flex-wrap gap-1.5">
                {EMOJIS.map((e) => (
                  <button key={e} onClick={() => setForm({ ...form, emoji: e })}
                    className={`grid h-8 w-8 place-items-center rounded-lg text-lg ${form.emoji === e ? "ring-2 ring-brand-500" : "bg-slate-100 dark:bg-slate-800"}`}>{e}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">Farbe</label>
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setForm({ ...form, color: c })}
                    className={`h-8 w-8 rounded-lg ${form.color === c ? "ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900" : ""}`} style={{ background: c }} />
                ))}
              </div>
            </div>
          </div>
          <button className="btn-primary w-full" disabled={busy || !form.name.trim()} onClick={create}>
            {busy ? <Spinner className="h-4 w-4" /> : "Anlegen"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
