import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Plus, FileText, Layers, HelpCircle, Trash2, PlayCircle, Sparkles,
  ListChecks, SpellCheck2, Shuffle, PencilLine, RefreshCw, AlertTriangle, CheckCircle2, Clock,
} from "lucide-react";
import { api } from "../lib/api";
import { useAsync, Spinner, Modal, EmptyState, useToast, cx } from "../lib/ui";
import { fmtDateTime, relTime } from "../lib/format";
import type { CardRow } from "../lib/types";

const TABS = [
  { id: "overview", label: "Übersicht" },
  { id: "material", label: "Material" },
  { id: "cards", label: "Karten" },
  { id: "quiz", label: "Quiz" },
] as const;

const MODES = [
  { id: "flashcards", label: "Karteikarten", icon: Layers, hint: "Vorderseite → Rückseite, mit Spaced Repetition" },
  { id: "cloze", label: "Lückentext", icon: SpellCheck2, hint: "Fehlenden Begriff eintippen" },
  { id: "match", label: "Zuordnen", icon: Shuffle, hint: "Begriffe & Definitionen paaren" },
  { id: "write", label: "Freies Abrufen", icon: PencilLine, hint: "Antwort frei formulieren, selbst bewerten" },
];

const STATUS: Record<string, { label: string; cls: string; icon: any }> = {
  pending: { label: "in Warteschlange", cls: "text-amber-600 bg-amber-500/10", icon: Clock },
  processing: { label: "wird verarbeitet", cls: "text-brand-600 bg-brand-500/10", icon: RefreshCw },
  ready: { label: "bereit zum Übernehmen", cls: "text-emerald-600 bg-emerald-500/10", icon: CheckCircle2 },
  committed: { label: "übernommen", cls: "text-slate-500 bg-slate-500/10", icon: CheckCircle2 },
  error: { label: "Fehler", cls: "text-rose-600 bg-rose-500/10", icon: AlertTriangle },
};

export default function SubjectDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");
  const { data, loading, error, reload } = useAsync(() => api.subject(id), [id]);
  const [modeOpen, setModeOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (loading) return <div className="flex justify-center py-24"><Spinner className="h-6 w-6 text-brand-500" /></div>;
  if (error) return <p className="text-rose-500">Fehler: {error}</p>;
  if (!data) return null;
  const { subject: s, counts } = data;

  return (
    <div className="space-y-5">
      <Link to="/subjects" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft size={15} /> Fächer
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-2xl text-2xl" style={{ background: `${s.color}1a` }}>{s.emoji}</div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{s.name}</h1>
            <p className="text-sm text-slate-500">{s.description || "Keine Beschreibung"}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-outline" onClick={() => nav(`material/new`)}><Plus size={16} /> Material</button>
          <button className="btn-outline" onClick={() => setQuizOpen(true)} disabled={counts.questions === 0}><ListChecks size={16} /> Quiz</button>
          <button className="btn-primary" onClick={() => setModeOpen(true)} disabled={counts.cards === 0}><PlayCircle size={16} /> Lernen</button>
          <button className="btn-ghost !px-2.5 text-slate-400 hover:text-rose-500" title="Fach löschen" onClick={() => setDelOpen(true)}><Trash2 size={16} /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: "Karten", v: counts.cards, i: <Layers size={15} /> },
          { l: "fällig", v: counts.due, i: <PlayCircle size={15} /> },
          { l: "gelernt", v: counts.learned, i: <CheckCircle2 size={15} /> },
          { l: "Fragen", v: counts.questions, i: <HelpCircle size={15} /> },
        ].map((x) => (
          <div key={x.l} className="card p-3.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">{x.i} {x.l}</div>
            <div className="mt-1 text-xl font-extrabold">{x.v}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cx("relative px-3.5 py-2 text-sm font-semibold transition",
              tab === t.id ? "text-brand-600 dark:text-brand-300" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200")}>
            {t.label}
            {tab === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-brand-500" />}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview data={data} onAddMaterial={() => nav("material/new")} onLearn={() => setModeOpen(true)} onQuiz={() => setQuizOpen(true)} />}
      {tab === "material" && <MaterialTab id={id} data={data} reload={reload} />}
      {tab === "cards" && <CardsTab id={id} reload={reload} />}
      {tab === "quiz" && <QuizTab data={data} onCreate={() => setQuizOpen(true)} reload={reload} />}

      <Modal open={modeOpen} onClose={() => setModeOpen(false)} title="Lernmodus wählen">
        <div className="grid gap-2">
          {MODES.map((m) => (
            <button key={m.id} onClick={() => nav(`/study/${id}?mode=${m.id}`)}
              className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-brand-400 hover:bg-brand-500/5 dark:border-slate-700">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500/10 text-brand-500"><m.icon size={18} /></div>
              <div>
                <div className="font-semibold">{m.label}</div>
                <div className="text-xs text-slate-500">{m.hint}</div>
              </div>
            </button>
          ))}
        </div>
      </Modal>

      <QuizCreateModal open={quizOpen} onClose={() => setQuizOpen(false)} subjectId={id} byType={data.questionsByType}
        onCreated={(qid) => nav(`/quiz/${qid}`)} />

      <Modal open={delOpen} onClose={() => setDelOpen(false)} title="Fach löschen?">
        <p className="text-sm text-slate-500">
          <b className="text-slate-700 dark:text-slate-200">{s.name}</b> und <b>alle zugehörigen Daten</b> werden dauerhaft entfernt:
          {" "}{counts.cards} Karten, {counts.questions} Fragen, alle Materialien, Quizze sowie der gesamte Lernstand und Fortschritt.
          Das kann nicht rückgängig gemacht werden.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setDelOpen(false)}>Abbrechen</button>
          <button className="btn bg-rose-500 text-white hover:bg-rose-600" disabled={deleting}
            onClick={async () => {
              setDeleting(true);
              try { await api.deleteSubject(id); toast("ok", "Fach gelöscht"); nav("/subjects"); }
              catch (e: any) { toast("err", e.message); setDeleting(false); }
            }}>
            {deleting ? <Spinner className="h-4 w-4" /> : <><Trash2 size={15} /> Endgültig löschen</>}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function Overview({ data, onAddMaterial, onLearn, onQuiz }: any) {
  const byType: Record<string, number> = {};
  data.questionsByType.forEach((r: any) => (byType[r.type] = r.n));
  const TL: Record<string, string> = { mc: "Multiple Choice", truefalse: "Wahr/Falsch", cloze: "Lückentext", short: "Kurzantwort" };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card p-5">
        <h3 className="mb-3 font-bold">Schnellstart</h3>
        <div className="space-y-2">
          <button onClick={onLearn} disabled={data.counts.cards === 0} className="btn-primary w-full justify-start disabled:opacity-40"><PlayCircle size={16} /> Lernsitzung starten ({data.counts.due} fällig)</button>
          <button onClick={onQuiz} disabled={data.counts.questions === 0} className="btn-outline w-full justify-start disabled:opacity-40"><ListChecks size={16} /> Quiz erstellen</button>
          <button onClick={onAddMaterial} className="btn-ghost w-full justify-start"><FileText size={16} /> Material hinzufügen</button>
        </div>
      </div>
      <div className="card p-5">
        <h3 className="mb-3 font-bold">Fragenpool</h3>
        {data.counts.questions === 0 ? (
          <p className="text-sm text-slate-500">Noch keine Fragen. Füge Material hinzu und übernimm die generierten Fragen.</p>
        ) : (
          <div className="space-y-2">
            {["mc", "truefalse", "cloze", "short"].map((t) => (
              <div key={t} className="flex items-center gap-3">
                <span className="w-32 text-sm text-slate-500">{TL[t]}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${((byType[t] || 0) / data.counts.questions) * 100}%` }} />
                </div>
                <span className="w-6 text-right text-sm font-semibold">{byType[t] || 0}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MaterialTab({ id, data, reload }: any) {
  const nav = useNavigate();
  const toast = useToast();
  if (data.materials.length === 0)
    return <EmptyState icon={<FileText size={38} />} title="Kein Material" hint="Füge Text aus Skript, Buch oder Notizen ein — StudyForge macht daraus Karten und Fragen."
      action={<button className="btn-primary" onClick={() => nav("material/new")}><Plus size={16} /> Material hinzufügen</button>} />;
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => nav("material/new")}><Plus size={16} /> Material hinzufügen</button>
      </div>
      {data.materials.map((m: any) => {
        const st = STATUS[m.status] || STATUS.pending;
        const clickable = m.status === "ready" || m.status === "committed";
        return (
          <div key={m.id} className={cx("card flex items-center gap-3 p-4", clickable && "cursor-pointer hover:border-brand-400")}
            onClick={() => clickable && nav(`material/${m.id}`)}>
            <FileText size={18} className="shrink-0 text-slate-400" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{m.title}</div>
              <div className="text-xs text-slate-400">{m.chars.toLocaleString("de-DE")} Zeichen · {relTime(m.created_at)}</div>
            </div>
            <span className={cx("chip", st.cls)}><st.icon size={13} className={m.status === "processing" ? "animate-spin" : ""} /> {st.label}</span>
            {m.status === "error" && (
              <button className="btn-ghost !p-2" title="Erneut versuchen" onClick={(e) => { e.stopPropagation(); api.reprocess(m.id).then(() => { toast("info", "Neu gestartet"); setTimeout(reload, 1200); }); }}>
                <RefreshCw size={15} />
              </button>
            )}
            <button className="btn-ghost !p-2 text-slate-400 hover:text-rose-500" title="Löschen"
              onClick={(e) => { e.stopPropagation(); if (confirm("Material löschen? Bereits übernommene Karten bleiben erhalten.")) api.deleteMaterial(m.id).then(reload); }}>
              <Trash2 size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function CardsTab({ id, reload }: { id: string; reload: () => void }) {
  const { data, loading, reload: reloadCards } = useAsync(() => api.cards(id), [id]);
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ front: "", back: "", hint: "", type: "basic" });
  const [filter, setFilter] = useState("all");

  const add = async () => {
    if (!f.front.trim() || !f.back.trim()) return;
    try { await api.addCard(id, f); toast("ok", "Karte hinzugefügt"); setOpen(false); setF({ front: "", back: "", hint: "", type: "basic" }); reloadCards(); reload(); }
    catch (e: any) { toast("err", e.message); }
  };

  const rows = (data || []).filter((c) =>
    filter === "all" ? true
      : filter === "due" ? c.isDue
      : filter === "learned" ? (c.reps > 0 && !c.isDue)
      : filter === "new" ? c.reps === 0
      : filter === "leech" ? c.leech : true);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {[["all", "Alle"], ["due", "Fällig"], ["learned", "Gelernt"], ["new", "Neu"], ["leech", "Problemkarten"]].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={cx("chip", filter === k ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300")}>{l}</button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Karte</button>
      </div>

      {loading && <div className="flex justify-center py-10"><Spinner className="h-5 w-5 text-brand-500" /></div>}
      {data && rows.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Keine Karten in dieser Ansicht.</p>}

      <div className="space-y-2">
        {rows.map((c: CardRow) => (
          <div key={c.id} className="card flex items-start gap-3 p-3.5">
            <span className={cx("chip mt-0.5 shrink-0",
              c.leech ? "bg-rose-500/10 text-rose-500"
                : c.reps === 0 ? "bg-slate-100 text-slate-500 dark:bg-slate-800"
                : c.isDue ? "bg-amber-500/10 text-amber-600"
                : "bg-emerald-500/10 text-emerald-600")}>
              {c.stateLabel}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{c.type === "cloze" ? c.front : c.front}</div>
              <div className="mt-0.5 text-sm text-slate-500">{c.back}</div>
              <div className="mt-1 text-[11px] text-slate-400">
                {c.reps === 0 ? "noch nicht gelernt" : c.isDue ? "jetzt fällig" : `wieder fällig in ${c.dueHuman}`}
                {" · "}{c.reps}× beantwortet{c.lapses ? ` · ${c.lapses} Fehler` : ""}
              </div>
            </div>
            <button className="btn-ghost !p-2 text-slate-400 hover:text-rose-500"
              onClick={() => api.deleteCard(c.id).then(() => { reloadCards(); reload(); })}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Karte hinzufügen">
        <div className="space-y-3">
          <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            <option value="basic">Frage → Antwort</option>
            <option value="cloze">Lückentext (Lücke mit ______ markieren)</option>
          </select>
          <textarea className="input min-h-20" placeholder={f.type === "cloze" ? "Die Hauptstadt von ______ ist Paris." : "Frage / Vorderseite"} value={f.front} onChange={(e) => setF({ ...f, front: e.target.value })} />
          <textarea className="input min-h-16" placeholder={f.type === "cloze" ? "Lösungswort" : "Antwort / Rückseite"} value={f.back} onChange={(e) => setF({ ...f, back: e.target.value })} />
          <input className="input" placeholder="Hinweis (optional)" value={f.hint} onChange={(e) => setF({ ...f, hint: e.target.value })} />
          <button className="btn-primary w-full" onClick={add}>Hinzufügen</button>
        </div>
      </Modal>
    </div>
  );
}

function QuizTab({ data, onCreate, reload }: any) {
  const nav = useNavigate();
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={onCreate} disabled={data.counts.questions === 0}><Plus size={16} /> Quiz erstellen</button>
      </div>
      {data.quizzes.length === 0 ? (
        <EmptyState icon={<ListChecks size={38} />} title="Noch keine Quizze"
          hint={data.counts.questions === 0 ? "Übernimm erst Fragen aus deinem Material." : "Erstelle ein Quiz aus deinem Fragenpool."} />
      ) : (
        data.quizzes.map((q: any) => (
          <div key={q.id} className="card flex items-center gap-3 p-4">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500/10 text-brand-500"><ListChecks size={17} /></div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{q.title}</div>
              <div className="text-xs text-slate-400">{q.questions} Fragen{q.best ? ` · Best: ${q.best}` : ""} · {relTime(q.created_at)}</div>
            </div>
            <button className="btn-primary !py-1.5" onClick={() => nav(`/quiz/${q.id}`)}>Starten</button>
            <button className="btn-ghost !p-2 text-slate-400 hover:text-rose-500" onClick={() => api.deleteQuiz(q.id).then(reload)}><Trash2 size={15} /></button>
          </div>
        ))
      )}
    </div>
  );
}

export function QuizCreateModal({ open, onClose, subjectId, byType, onCreated }: any) {
  const toast = useToast();
  const [size, setSize] = useState(10);
  const [types, setTypes] = useState<string[]>(["mc", "truefalse", "cloze", "short"]);
  const [busy, setBusy] = useState(false);
  const counts: Record<string, number> = {};
  (byType || []).forEach((r: any) => (counts[r.type] = r.n));
  const TL: Record<string, string> = { mc: "Multiple Choice", truefalse: "Wahr / Falsch", cloze: "Lückentext", short: "Kurzantwort" };
  const toggle = (t: string) => setTypes((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));

  const go = async () => {
    setBusy(true);
    try { const { id } = await api.makeQuiz(subjectId, { size, types }); onCreated(id); }
    catch (e: any) { toast("err", e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Quiz erstellen">
      <div className="space-y-4">
        <div>
          <label className="mb-1 flex justify-between text-xs font-semibold text-slate-500"><span>Anzahl Fragen</span><span>{size}</span></label>
          <input type="range" min={3} max={30} value={size} onChange={(e) => setSize(+e.target.value)} className="w-full accent-brand-500" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500">Fragetypen</label>
          <div className="grid grid-cols-2 gap-2">
            {["mc", "truefalse", "cloze", "short"].map((t) => (
              <button key={t} onClick={() => toggle(t)} disabled={!counts[t]}
                className={cx("flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition disabled:opacity-40",
                  types.includes(t) && counts[t] ? "border-brand-400 bg-brand-500/5 font-semibold" : "border-slate-200 dark:border-slate-700")}>
                {TL[t]} <span className="text-xs text-slate-400">{counts[t] || 0}</span>
              </button>
            ))}
          </div>
        </div>
        <button className="btn-primary w-full" disabled={busy || types.length === 0} onClick={go}>
          {busy ? <Spinner className="h-4 w-4" /> : <><Sparkles size={16} /> Quiz starten</>}
        </button>
      </div>
    </Modal>
  );
}
