import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Sparkles, FileText, Loader2, Check, Layers, HelpCircle, Wand2, Upload, FileType2, X } from "lucide-react";
import { api } from "../lib/api";
import { useToast, Spinner, cx } from "../lib/ui";
import type { Material, GenCard, GenQuestion } from "../lib/types";

const SAMPLE = `# Beispiel: Betriebssysteme – Scheduling

Ein Prozess ist ein Programm in Ausführung. Der Scheduler entscheidet, welcher Prozess als Nächstes die CPU erhält.

Round Robin ist ein Scheduling-Verfahren, bei dem jeder Prozess ein festes Zeitquantum erhält. First Come First Served bearbeitet Prozesse in der Reihenfolge ihrer Ankunft.

Ein Deadlock ist eine Situation, in der sich Prozesse gegenseitig blockieren. Die Antwortzeit ist die Zeit von der Anfrage bis zur ersten Reaktion.

Präemptives Scheduling erlaubt das Unterbrechen laufender Prozesse. Der Kontextwechsel speichert den Zustand eines Prozesses und lädt den nächsten.`;

const TYPE_LABEL: Record<string, string> = { mc: "Multiple Choice", truefalse: "Wahr/Falsch", cloze: "Lückentext", short: "Kurzantwort", basic: "Frage/Antwort" };

export default function AddMaterial() {
  const { id = "", mid = "new" } = useParams();
  const nav = useNavigate();
  const toast = useToast();

  if (mid === "new") return <PasteForm subjectId={id} onCreated={(m) => nav(`/subjects/${id}/material/${m}`, { replace: true })} />;
  return <Preview subjectId={id} materialId={mid} key={mid} onDone={() => nav(`/subjects/${id}`)} toast={toast} />;
}

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:.*;base64,/, ""));
    r.onerror = () => reject(new Error("Datei konnte nicht gelesen werden"));
    r.readAsDataURL(file);
  });

function PasteForm({ subjectId, onCreated }: { subjectId: string; onCreated: (id: string) => void }) {
  const toast = useToast();
  const [tab, setTab] = useState<"text" | "pdf">("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;

  const pickPdf = (f: File | null | undefined) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) { toast("err", "Bitte eine PDF-Datei wählen"); return; }
    if (f.size > 25 * 1024 * 1024) { toast("err", "PDF ist größer als 25 MB"); return; }
    setPdf(f);
    if (!title.trim()) setTitle(f.name.replace(/\.pdf$/i, ""));
  };

  const submit = async () => {
    setBusy(true);
    try {
      let m;
      if (tab === "pdf") {
        if (!pdf) { toast("err", "Bitte eine PDF-Datei wählen"); setBusy(false); return; }
        const pdfBase64 = await fileToBase64(pdf);
        m = await api.addMaterial(subjectId, { title: title.trim() || pdf.name.replace(/\.pdf$/i, ""), filename: pdf.name, pdfBase64 });
      } else {
        if (content.trim().length < 40) { toast("err", "Bitte mindestens ein paar Sätze einfügen."); setBusy(false); return; }
        m = await api.addMaterial(subjectId, { title: title.trim() || "Ohne Titel", content });
      }
      onCreated(m.id);
    } catch (e: any) { toast("err", e.message); setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to={`/subjects/${subjectId}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft size={15} /> zurück
      </Link>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Material hinzufügen</h1>
        <p className="text-sm text-slate-500">Text einfügen oder PDF hochladen — der Hintergrund-Generator erstellt Karteikarten und Quizfragen. Du wählst danach aus, was übernommen wird.</p>
      </div>

      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/70">
        {([["text", "Text einfügen", FileText], ["pdf", "PDF hochladen", FileType2]] as const).map(([k, l, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={cx("flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition",
              tab === k ? "bg-white shadow-sm dark:bg-slate-900" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200")}>
            <Icon size={15} /> {l}
          </button>
        ))}
      </div>

      <input className="input" placeholder="Titel (z. B. „Kapitel 3 – Zellatmung“)" value={title} onChange={(e) => setTitle(e.target.value)} />

      {tab === "text" ? (
        <div className="relative">
          <textarea className="input min-h-[300px] font-[15px] leading-relaxed" placeholder="Hier dein Studienmaterial einfügen…"
            value={content} onChange={(e) => setContent(e.target.value)} />
          <div className="absolute bottom-3 right-3 text-[11px] text-slate-400">{words} Wörter · {content.length} Zeichen</div>
        </div>
      ) : (
        <div>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden
            onChange={(e) => pickPdf(e.target.files?.[0])} />
          {!pdf ? (
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); pickPdf(e.dataTransfer.files?.[0]); }}
              className={cx("flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition",
                dragOver ? "border-brand-400 bg-brand-500/5" : "border-slate-300 hover:border-brand-400 dark:border-slate-700")}>
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-500/10 text-brand-500"><Upload size={22} /></div>
              <div>
                <p className="font-semibold">PDF hierher ziehen oder klicken</p>
                <p className="mt-1 text-xs text-slate-500">Der Text wird automatisch extrahiert. Max. 25 MB. Gescannte Bild-PDFs ohne Text-Ebene funktionieren nicht.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-rose-500/10 text-rose-500"><FileType2 size={20} /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{pdf.name}</div>
                <div className="text-xs text-slate-400">{(pdf.size / 1024 / 1024).toFixed(2)} MB</div>
              </div>
              <button className="btn-ghost !p-2" onClick={() => setPdf(null)}><X size={16} /></button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" disabled={busy || (tab === "pdf" && !pdf)} onClick={submit}>
          {busy ? <Spinner className="h-4 w-4" /> : <><Wand2 size={16} /> {tab === "pdf" ? "PDF verarbeiten & generieren" : "Karten & Fragen generieren"}</>}
        </button>
        {tab === "text" && (
          <button className="btn-ghost" onClick={() => { setContent(SAMPLE); setTitle("Betriebssysteme – Scheduling"); }}>
            <FileText size={15} /> Beispieltext einfügen
          </button>
        )}
        <span className="text-xs text-slate-400">Tipp: Definitionen („X ist …“) und Überschriften liefern die besten Ergebnisse.</span>
      </div>
    </div>
  );
}

function Preview({ subjectId, materialId, onDone, toast }: any) {
  const [m, setM] = useState<Material | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selCards, setSelCards] = useState<Set<number>>(new Set());
  const [selQ, setSelQ] = useState<Set<number>>(new Set());
  const [committing, setCommitting] = useState(false);
  const timer = useRef<any>(null);
  const nav = useNavigate();

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const data = await api.material(materialId);
        if (!alive) return;
        setM(data);
        if (data.status === "ready" && selCards.size === 0 && selQ.size === 0) {
          setSelCards(new Set((data.generated.cards || []).map((_, i) => i)));
          setSelQ(new Set((data.generated.questions || []).map((_, i) => i)));
        }
        if (data.status === "pending" || data.status === "processing") timer.current = setTimeout(poll, 900);
      } catch (e: any) { alive && setErr(e.message); }
    };
    poll();
    return () => { alive = false; clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialId]);

  const cards = m?.generated.cards || [];
  const questions = m?.generated.questions || [];

  const commit = async () => {
    setCommitting(true);
    try {
      const r = await api.commitMaterial(materialId, { cards: [...selCards], questions: [...selQ] });
      toast("ok", `${r.addedCards} Karten und ${r.addedQuestions} Fragen übernommen`);
      nav(`/subjects/${subjectId}`);
    } catch (e: any) { toast("err", e.message); setCommitting(false); }
  };

  if (err) return <Center><p className="text-rose-500">Fehler: {err}</p></Center>;
  if (!m) return <Center><Spinner className="h-6 w-6 text-brand-500" /></Center>;

  if (m.status === "pending" || m.status === "processing")
    return (
      <Center>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-brand-500/10">
            <Loader2 size={28} className="animate-spin text-brand-500" />
          </div>
          <p className="font-semibold">Material wird verarbeitet…</p>
          <p className="max-w-xs text-sm text-slate-500">Der Hintergrund-Worker zerlegt den Text, erkennt Definitionen und baut Karten &amp; Fragen.</p>
        </div>
      </Center>
    );

  if (m.status === "error")
    return (
      <Center>
        <div className="text-center">
          <p className="font-semibold text-rose-500">Verarbeitung fehlgeschlagen</p>
          <p className="mt-1 text-sm text-slate-500">{m.error}</p>
          <button className="btn-outline mt-4" onClick={() => api.reprocess(materialId).then(() => location.reload())}>Erneut versuchen</button>
        </div>
      </Center>
    );

  if (m.status === "committed")
    return (
      <Center>
        <div className="text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-500"><Check size={26} /></div>
          <p className="font-semibold">Bereits übernommen</p>
          <p className="mt-1 text-sm text-slate-500">Dieses Material wurde schon in Karten &amp; Fragen umgewandelt.</p>
          <Link className="btn-primary mt-4" to={`/subjects/${subjectId}`}>Zum Fach</Link>
        </div>
      </Center>
    );

  // ready
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link to={`/subjects/${subjectId}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft size={15} /> zurück
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{m.title}</h1>
          <p className="text-sm text-slate-500">
            <Sparkles size={13} className="mr-1 inline text-brand-500" />
            {cards.length} Karten &amp; {questions.length} Fragen generiert · Sprache {m.lang?.toUpperCase()} · wähle aus, was übernommen wird
          </p>
        </div>
        <button className="btn-primary" disabled={committing || (selCards.size + selQ.size === 0)} onClick={commit}>
          {committing ? <Spinner className="h-4 w-4" /> : <><Check size={16} /> {selCards.size + selQ.size} übernehmen</>}
        </button>
      </div>

      <Section icon={<Layers size={16} />} title={`Karteikarten (${selCards.size}/${cards.length})`}
        onAll={() => setSelCards(new Set(cards.map((_, i) => i)))} onNone={() => setSelCards(new Set())}>
        <div className="grid gap-2 sm:grid-cols-2">
          {cards.map((c: GenCard, i: number) => (
            <button key={i} onClick={() => setSelCards(toggle(selCards, i))}
              className={cx("card p-3 text-left transition", selCards.has(i) ? "ring-2 ring-brand-500" : "opacity-60 hover:opacity-100")}>
              <div className="mb-1 flex items-center justify-between">
                <span className="chip bg-slate-100 text-[10px] text-slate-500 dark:bg-slate-800">{TYPE_LABEL[c.type]}</span>
                {selCards.has(i) && <Check size={14} className="text-brand-500" />}
              </div>
              <div className="text-sm font-semibold">{c.front}</div>
              <div className="mt-0.5 text-sm text-slate-500">{c.back}</div>
            </button>
          ))}
        </div>
      </Section>

      <Section icon={<HelpCircle size={16} />} title={`Quizfragen (${selQ.size}/${questions.length})`}
        onAll={() => setSelQ(new Set(questions.map((_, i) => i)))} onNone={() => setSelQ(new Set())}>
        <div className="space-y-2">
          {questions.map((q: GenQuestion, i: number) => (
            <button key={i} onClick={() => setSelQ(toggle(selQ, i))}
              className={cx("card w-full p-3 text-left transition", selQ.has(i) ? "ring-2 ring-brand-500" : "opacity-60 hover:opacity-100")}>
              <div className="mb-1 flex items-center justify-between">
                <span className="chip bg-slate-100 text-[10px] text-slate-500 dark:bg-slate-800">{TYPE_LABEL[q.type]}</span>
                {selQ.has(i) && <Check size={14} className="text-brand-500" />}
              </div>
              <div className="whitespace-pre-line text-sm font-medium">{q.prompt}</div>
              <div className="mt-1 text-xs text-slate-500">
                {q.type === "mc" ? q.options.join(" · ") : "Antwort: "}{q.type !== "mc" && <span className="font-semibold">{q.answer}</span>}
                {q.type === "mc" && <> — richtig: <span className="font-semibold">{q.answer}</span></>}
              </div>
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}

const toggle = (s: Set<number>, i: number) => {
  const n = new Set(s);
  n.has(i) ? n.delete(i) : n.add(i);
  return n;
};

function Section({ icon, title, children, onAll, onNone }: any) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold">{icon} {title}</h2>
        <div className="flex gap-1 text-xs">
          <button className="btn-ghost !px-2 !py-1" onClick={onAll}>alle</button>
          <button className="btn-ghost !px-2 !py-1" onClick={onNone}>keine</button>
        </div>
      </div>
      {children}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[60vh] items-center justify-center">{children}</div>;
}
