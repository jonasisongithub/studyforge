import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { X, RotateCcw, Check, ArrowRight, Trophy, Keyboard, Lightbulb } from "lucide-react";
import { api } from "../lib/api";
import { Spinner, cx, useToast } from "../lib/ui";
import { MODE_LABEL } from "../lib/format";
import type { ReviewCard } from "../lib/types";

const RATINGS = [
  { r: 0, label: "Nochmal", key: "1", cls: "bg-rose-500 hover:bg-rose-600" },
  { r: 2, label: "Gewusst", key: "2", cls: "bg-emerald-500 hover:bg-emerald-600" },
];
const ivlText = (days: number) => (days === 1 ? "in 1 Tag" : `in ${days} Tagen`);

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9äöüß ]/gi, " ").replace(/\b(der|die|das|ein|eine|the|a|an)\b/g, " ").replace(/\s+/g, " ").trim();
const looseEqual = (a: string, b: string) => {
  const x = norm(a), y = norm(b);
  if (!y) return false;
  if (x === y) return true;
  if (x.includes(y) || y.includes(x)) return Math.min(x.length, y.length) >= 3;
  const xs = new Set(x.split(" "));
  const hit = y.split(" ").filter((w) => xs.has(w)).length;
  return hit / Math.max(xs.size, 1) >= 0.6;
};

export default function Study() {
  const { id = "" } = useParams();
  const [sp] = useSearchParams();
  const mode = sp.get("mode") || "flashcards";
  const nav = useNavigate();
  const toast = useToast();

  const [all, setAll] = useState<ReviewCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [ivlDays, setIvlDays] = useState(3);
  const [finished, setFinished] = useState(false);
  const [refetching, setRefetching] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [input, setInput] = useState("");
  const [judged, setJudged] = useState<null | boolean>(null);
  const [seen, setSeen] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState<number | null>(null);
  const shownAt = useRef(Date.now());
  const sessionId = useRef<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    let alive = true;
    api.reviewQueue(id, mode).then((q) => {
      if (!alive) return;
      setIvlDays(q.intervalDays || 3);
      setAll(q.queue);
      if (q.queue.length === 0) setFinished(true);
    }).catch((e) => alive && setError(e.message));
    api.startSession({ subjectId: id, mode }).then((s) => (sessionId.current = s.id)).catch(() => {});
    return () => { alive = false; };
  }, [id, mode]);

  const endSession = useCallback(() => {
    if (sessionId.current) api.endSession(sessionId.current, { cardsSeen: seen, correct }).catch(() => {});
  }, [seen, correct]);
  useEffect(() => () => endSession(), [endSession]);

  // Advance to the next card. When the local list is exhausted, ask the server
  // whether anything is still due for this selection — only then is the session
  // truly "fertig". A wrong answer set due_at=now, so it reappears here.
  const advance = useCallback(async (wasCorrect: boolean) => {
    setSeen((s) => s + 1);
    if (wasCorrect) setCorrect((c) => c + 1);
    setRevealed(false); setInput(""); setJudged(null);
    shownAt.current = Date.now();
    setI((cur) => {
      const next = cur + 1;
      if (all && next >= all.length) {
        setRefetching(true);
        api.reviewQueue(id, mode)
          .then((q) => {
            if (q.queue.length > 0) setAll((prev) => [...(prev || []), ...q.queue]);
            else setFinished(true);
          })
          .catch(() => setFinished(true))
          .finally(() => setRefetching(false));
      }
      return next;
    });
  }, [all, id, mode]);

  const rate = async (r: number) => {
    const card = all?.[i];
    if (!card || busy.current) return;
    busy.current = true;
    try {
      const res = await api.review(card.id, { rating: r, elapsedMs: Date.now() - shownAt.current });
      setStreak(res.streak);
      await advance(r > 0);
    } catch (e: any) { toast("err", e.message); }
    finally { busy.current = false; }
  };

  const checkTyped = () => {
    const card = all?.[i];
    if (!card || judged !== null) return;
    setJudged(looseEqual(input, card.back));
  };

  if (mode === "match") return <MatchMode id={id} onExit={() => nav(`/subjects/${id}`)} />;
  if (error) return <Shell onExit={() => nav(`/subjects/${id}`)}><p className="text-rose-400">Fehler: {error}</p></Shell>;
  if (!all) return <Shell onExit={() => nav(`/subjects/${id}`)}><Spinner className="h-6 w-6 text-brand-400" /></Shell>;

  const card = all[i];

  if (finished && !card)
    return (
      <Shell onExit={() => { endSession(); nav(`/subjects/${id}`); }}>
        {seen === 0 ? (
          <div className="text-center">
            <p className="text-lg font-semibold">Nichts fällig 🎉</p>
            <p className="mt-1 text-slate-400">
              {mode === "cloze" ? "Keine Lückentext-Karten fällig." : mode === "write" ? "Keine Frage-Antwort-Karten fällig." : "Für dieses Fach ist gerade keine Karte fällig."}
            </p>
            <Link className="btn-primary mt-5" to={`/subjects/${id}`}>Zurück</Link>
          </div>
        ) : (
          <div className="animate-pop text-center">
            <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-3xl bg-amber-500/15 text-amber-400"><Trophy size={38} /></div>
            <h2 className="text-2xl font-extrabold">Sitzung fertig!</h2>
            <p className="mt-1 text-slate-400">{seen} Antworten · {seen ? Math.round((correct / seen) * 100) : 0}% richtig{streak != null ? ` · 🔥 ${streak} Tage` : ""}</p>
            <p className="mt-1 text-xs text-slate-500">Keine fälligen Karten mehr in dieser Auswahl.</p>
            <div className="mt-6 flex justify-center gap-2">
              <Link className="btn-primary" to={`/subjects/${id}`}>Zum Fach <ArrowRight size={15} /></Link>
            </div>
          </div>
        )}
      </Shell>
    );

  if (!card)
    return <Shell onExit={() => nav(`/subjects/${id}`)}><Spinner className="h-6 w-6 text-brand-400" /></Shell>;

  const remaining = all.length - i;
  const progress = (seen / (seen + Math.max(remaining, 1))) * 100;

  return (
    <Shell onExit={() => { endSession(); nav(`/subjects/${id}`); }}
      progress={progress} counter={`noch ${remaining}${refetching ? "…" : ""}`} mode={mode}
      onReveal={mode === "flashcards" && !revealed ? () => setRevealed(true) : undefined}
      onRate={mode === "flashcards" && revealed ? rate : undefined}>
      <div className="w-full max-w-xl">
        <div key={i} className="animate-fade-in">
          {mode === "flashcards" && <Flashcard card={card} revealed={revealed} ivlDays={ivlDays} onReveal={() => setRevealed(true)} onRate={rate} />}
          {(mode === "cloze" || mode === "write") && (
            <TypedCard card={card} mode={mode} input={input} setInput={setInput} judged={judged} ivlDays={ivlDays}
              onCheck={checkTyped}
              onNext={(ok: boolean) => {
                if (mode !== "cloze" || busy.current) return;
                busy.current = true;
                api.review(card.id, { rating: ok ? 2 : 0, elapsedMs: Date.now() - shownAt.current })
                  .then((res) => setStreak(res.streak)).catch(() => {})
                  .finally(() => { busy.current = false; advance(ok); });
              }}
              onSelfRate={(r: number) => rate(r)} />
          )}
        </div>
      </div>
    </Shell>
  );
}

function Flashcard({ card, revealed, ivlDays, onReveal, onRate }: { card: ReviewCard; revealed: boolean; ivlDays: number; onReveal: () => void; onRate: (r: number) => void }) {
  return (
    <div>
      <div className="relative min-h-[240px]">
        <div key={revealed ? "back" : "front"}
          className={cx(
            "animate-fade-in flex min-h-[240px] flex-col items-center justify-center rounded-3xl border p-8 text-center",
            revealed
              ? "border-brand-700/60 bg-gradient-to-b from-brand-950 to-slate-900"
              : "border-slate-700 bg-slate-900"
          )}>
          {!revealed ? (
            <>
              <span className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{card.type === "cloze" ? "Lückentext" : "Frage"}</span>
              <p className="whitespace-pre-line text-xl font-semibold text-slate-100">{card.front}</p>
              {card.hint && <p className="mt-4 flex items-center gap-1 text-xs text-slate-500"><Lightbulb size={13} /> {card.hint}</p>}
            </>
          ) : (
            <>
              <span className="mb-1 whitespace-pre-line text-xs text-slate-500">{card.front}</span>
              <span className="mb-3 mt-3 text-[11px] font-semibold uppercase tracking-wider text-brand-400">Antwort</span>
              <p className="whitespace-pre-line text-xl font-semibold text-white">{card.back}</p>
            </>
          )}
        </div>
      </div>

      <div className="mt-6">
        {!revealed ? (
          <button className="btn-primary w-full py-3 text-base" onClick={onReveal}>Antwort zeigen <span className="ml-1 text-xs opacity-70">(Leertaste)</span></button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {RATINGS.map((b) => (
              <button key={b.r} onClick={() => onRate(b.r)}
                className={cx("flex flex-col items-center gap-0.5 rounded-xl px-2 py-3 text-sm font-bold text-white transition active:scale-95", b.cls)}>
                {b.label}
                <span className="text-[10px] font-medium opacity-80">{b.r === 0 ? "sofort wieder fällig" : ivlText(ivlDays)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TypedCard({ card, mode, input, setInput, judged, ivlDays, onCheck, onNext, onSelfRate }: any) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, [card.id]);
  const revealWrite = judged !== null;
  return (
    <div className="rounded-3xl border border-slate-700 bg-slate-900 p-7">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{mode === "cloze" ? "Lücke füllen" : "Frei beantworten"}</span>
      <p className="mt-3 whitespace-pre-line text-xl font-semibold text-slate-100">{card.front}</p>
      {card.hint && <p className="mt-2 text-xs text-slate-500"><Lightbulb size={12} className="mr-1 inline" />{card.hint}</p>}

      {mode === "cloze" ? (
        <>
          <input ref={inputRef as any} className="input mt-5 !bg-slate-950 !border-slate-700 text-lg"
            placeholder="Antwort eintippen…" value={input} disabled={judged !== null}
            onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (judged === null ? onCheck() : onNext(judged))} />
          {judged === null ? (
            <button className="btn-primary mt-4 w-full" onClick={onCheck}>Prüfen</button>
          ) : (
            <div className="mt-4">
              <div className={cx("flex items-center gap-2 rounded-xl p-3 text-sm font-semibold",
                judged ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300")}>
                {judged ? <Check size={16} /> : <X size={16} />}
                {judged ? "Richtig!" : <>Richtige Antwort: <span className="underline">{card.back}</span></>}
              </div>
              <button className="btn-primary mt-3 w-full" onClick={() => onNext(judged)}>Weiter <ArrowRight size={15} /></button>
            </div>
          )}
        </>
      ) : (
        <>
          <textarea ref={inputRef as any} className="input mt-5 min-h-24 !bg-slate-950 !border-slate-700"
            placeholder="Deine Antwort in eigenen Worten…" value={input} disabled={revealWrite}
            onChange={(e) => setInput(e.target.value)} />
          {!revealWrite ? (
            <button className="btn-primary mt-4 w-full" onClick={onCheck}>Aufdecken</button>
          ) : (
            <div className="mt-4">
              <div className="rounded-xl bg-slate-950 p-4 text-sm">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-brand-400">Musterantwort</div>
                <p className="whitespace-pre-line text-slate-200">{card.back}</p>
              </div>
              <p className="mt-3 text-center text-xs text-slate-500">Wusstest du es?</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {RATINGS.map((b) => (
                  <button key={b.r} onClick={() => onSelfRate(b.r)}
                    className={cx("flex flex-col items-center gap-0.5 rounded-xl px-2 py-3 text-sm font-bold text-white transition active:scale-95", b.cls)}>
                    {b.label}<span className="text-[10px] font-medium opacity-80">{b.r === 0 ? "sofort wieder fällig" : ivlText(ivlDays)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------- Match mode ---------------- */
function MatchMode({ id, onExit }: { id: string; onExit: () => void }) {
  const [pairs, setPairs] = useState<{ id: string; front: string; back: string }[] | null>(null);
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<{ side: "l" | "r"; id: string } | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<string | null>(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    api.cards(id).then((cs) => {
      const usable = cs.filter((c) => c.back.length <= 140 && c.front.length <= 220);
      setPairs(shuffle(usable).slice(0, 6).map((c) => ({ id: c.id, front: c.front, back: c.back })));
    });
  }, [id, round]);

  const right = useMemo(() => (pairs ? shuffle(pairs.map((p) => ({ id: p.id, back: p.back }))) : []), [pairs]);
  if (!pairs) return <Shell onExit={onExit}><Spinner className="h-6 w-6 text-brand-400" /></Shell>;
  if (pairs.length < 2) return <Shell onExit={onExit}><p className="text-slate-300">Zu wenige Frage-Antwort-Karten für den Zuordnen-Modus.</p></Shell>;

  const allDone = matched.size === pairs.length;
  const clickCell = (side: "l" | "r", pid: string) => {
    if (matched.has(pid)) return;
    if (!picked) { setPicked({ side, id: pid }); return; }
    if (picked.side === side) { setPicked({ side, id: pid }); return; }
    setTries((t) => t + 1);
    if (picked.id === pid) {
      const n = new Set(matched); n.add(pid); setMatched(n);
      // A correct match counts as a correct answer -> card moves to "gelernt".
      api.review(pid, { rating: 2 }).catch(() => {});
      setPicked(null);
    } else {
      setWrong(pid + picked.id); setTimeout(() => setWrong(null), 500); setPicked(null);
    }
  };

  return (
    <Shell onExit={onExit} counter={`${matched.size} / ${pairs.length}`} mode="match"
      progress={(matched.size / pairs.length) * 100}>
      {allDone ? (
        <div className="text-center">
          <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-3xl bg-emerald-500/15 text-emerald-400"><Check size={40} /></div>
          <h2 className="text-2xl font-extrabold">Alles zugeordnet!</h2>
          <p className="mt-1 text-slate-400">{pairs.length} Paare · {tries} Versuche</p>
          <div className="mt-6 flex justify-center gap-2">
            <button className="btn-outline !border-slate-600 !text-slate-200" onClick={() => { setMatched(new Set()); setTries(0); setRound((r) => r + 1); }}><RotateCcw size={15} /> Neue Runde</button>
            <button className="btn-primary" onClick={onExit}>Fertig</button>
          </div>
        </div>
      ) : (
        <div className="grid w-full max-w-2xl grid-cols-2 gap-3">
          <div className="space-y-2">
            {pairs.map((p) => (
              <button key={p.id} disabled={matched.has(p.id)} onClick={() => clickCell("l", p.id)}
                className={cx("w-full rounded-xl border p-3 text-left text-sm transition",
                  matched.has(p.id) ? "border-emerald-600/40 bg-emerald-500/10 text-emerald-300 opacity-60"
                  : picked?.side === "l" && picked.id === p.id ? "border-brand-500 bg-brand-500/10"
                  : "border-slate-700 hover:border-slate-500")}>{p.front}</button>
            ))}
          </div>
          <div className="space-y-2">
            {right.map((p) => (
              <button key={p.id} disabled={matched.has(p.id)} onClick={() => clickCell("r", p.id)}
                className={cx("w-full rounded-xl border p-3 text-left text-sm transition",
                  matched.has(p.id) ? "border-emerald-600/40 bg-emerald-500/10 text-emerald-300 opacity-60"
                  : picked?.side === "r" && picked.id === p.id ? "border-brand-500 bg-brand-500/10"
                  : wrong && wrong.includes(p.id) ? "border-rose-500 bg-rose-500/10"
                  : "border-slate-700 hover:border-slate-500")}>{p.back}</button>
            ))}
          </div>
        </div>
      )}
    </Shell>
  );
}

function shuffle<T>(a: T[]): T[] {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}

/* ---------------- Shell ---------------- */
function Shell({ children, onExit, progress, counter, mode, onReveal, onRate }: any) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
      if ((e.key === " " || e.key === "Enter") && onReveal) { e.preventDefault(); onReveal(); }
      if (onRate && e.key === "1") onRate(0);
      if (onRate && e.key === "2") onRate(2);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onExit, onReveal, onRate]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <div className="flex items-center gap-4 px-5 py-4">
        <button onClick={onExit} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"><X size={20} /></button>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-brand-500 transition-[width] duration-300" style={{ width: `${progress || 0}%` }} />
        </div>
        <span className="w-16 text-right text-xs font-semibold text-slate-400">{counter || ""}</span>
      </div>
      {mode && (
        <div className="px-5 pb-2 text-center text-[11px] font-semibold uppercase tracking-widest text-slate-600">
          {MODE_LABEL[mode] || mode}
        </div>
      )}
      <div className="flex flex-1 flex-col items-center justify-center px-5 pb-16">{children}</div>
      <div className="hidden items-center justify-center gap-4 pb-5 text-[11px] text-slate-600 sm:flex">
        <span className="flex items-center gap-1"><Keyboard size={12} /> Leertaste: aufdecken</span>
        <span>1 = Nochmal · 2 = Gewusst</span>
        <span>Esc: beenden</span>
      </div>
    </div>
  );
}
