import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { X, Check, ArrowRight, RotateCcw, Trophy, CircleCheck, CircleX } from "lucide-react";
import { api } from "../lib/api";
import { Spinner, cx, useToast } from "../lib/ui";
import type { Quiz, QuizQuestion, AttemptResult } from "../lib/types";

export default function QuizRunner() {
  const { qid = "" } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, { correct: boolean; answer: string; explanation: string }>>({});
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    api.quiz(qid).then(setQuiz).catch((e) => setError(e.message));
  }, [qid]);

  if (error) return <Frame onExit={() => nav(-1)}><p className="text-rose-400">Fehler: {error}</p></Frame>;
  if (!quiz) return <Frame onExit={() => nav(-1)}><Spinner className="h-6 w-6 text-brand-400" /></Frame>;
  if (quiz.questions.length === 0)
    return <Frame onExit={() => nav(-1)}><p className="text-slate-300">Dieses Quiz hat keine Fragen.</p></Frame>;

  const q = quiz.questions[i];
  const given = answers[q?.id] ?? "";
  const fb = checked[q?.id];
  const isLast = i === quiz.questions.length - 1;
  const progress = ((i + (fb ? 1 : 0)) / quiz.questions.length) * 100;

  const setAns = (v: string) => setAnswers((a) => ({ ...a, [q.id]: v }));

  const check = async () => {
    if (!given.trim()) return;
    try {
      const r = await api.checkAnswer(qid, { questionId: q.id, value: given });
      setChecked((c) => ({ ...c, [q.id]: r }));
    } catch (e: any) { toast("err", e.message); }
  };

  const next = async () => {
    if (isLast) {
      setSubmitting(true);
      try {
        const r = await api.submitQuiz(qid, { answers, checkedIds: Object.keys(checked), elapsedMs: Date.now() - startedAt.current });
        setResult(r);
      } catch (e: any) { toast("err", e.message); setSubmitting(false); }
    } else setI((x) => x + 1);
  };

  if (result) return <Results quiz={quiz} result={result} onExit={() => nav(`/subjects/${quiz.subjectId}`)} />;

  return (
    <Frame onExit={() => nav(`/subjects/${quiz.subjectId}`)} progress={progress} counter={`${i + 1} / ${quiz.questions.length}`}>
      <div className="w-full max-w-xl">
        <div>
          <div key={q.id} className="animate-fade-in rounded-3xl border border-slate-700 bg-slate-900 p-7">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              {({ mc: "Multiple Choice", truefalse: "Wahr oder Falsch", cloze: "Lückentext", short: "Kurzantwort" } as any)[q.type]}
            </div>
            <p className="whitespace-pre-line text-lg font-semibold text-slate-100">{q.prompt}</p>

            <div className="mt-5 space-y-2">
              {(q.type === "mc" || q.type === "truefalse") ? (
                q.options.map((opt) => {
                  const sel = given === opt;
                  const showCorrect = fb && opt === fb.answer;
                  const showWrong = fb && sel && !fb.correct;
                  return (
                    <button key={opt} disabled={!!fb} onClick={() => setAns(opt)}
                      className={cx("flex w-full items-center gap-3 rounded-xl border p-3.5 text-left text-sm transition",
                        showCorrect ? "border-emerald-500 bg-emerald-500/10 text-emerald-200"
                        : showWrong ? "border-rose-500 bg-rose-500/10 text-rose-200"
                        : sel ? "border-brand-500 bg-brand-500/10"
                        : "border-slate-700 hover:border-slate-500")}>
                      <span className={cx("grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px]",
                        sel || showCorrect ? "border-current" : "border-slate-600")}>
                        {showCorrect ? <Check size={12} /> : showWrong ? <X size={12} /> : ""}
                      </span>
                      {opt}
                    </button>
                  );
                })
              ) : (
                <input autoFocus className="input !border-slate-700 !bg-slate-950 text-lg" placeholder="Antwort eintippen…"
                  value={given} disabled={!!fb} onChange={(e) => setAns(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (fb ? next() : check())} />
              )}
            </div>

            {fb && (
              <div className="animate-fade-in mt-4">
                <div className={cx("rounded-xl p-3 text-sm", fb.correct ? "bg-emerald-500/10 text-emerald-200" : "bg-rose-500/10 text-rose-200")}>
                  <div className="flex items-center gap-2 font-semibold">
                    {fb.correct ? <CircleCheck size={16} /> : <CircleX size={16} />}
                    {fb.correct ? "Richtig" : `Richtige Antwort: ${fb.answer}`}
                  </div>
                  {fb.explanation && <p className="mt-1 text-slate-300/90">{fb.explanation}</p>}
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              {!fb ? (
                <button className="btn-primary" disabled={!given.trim()} onClick={check}>Prüfen</button>
              ) : (
                <button className="btn-primary" disabled={submitting} onClick={next}>
                  {submitting ? <Spinner className="h-4 w-4" /> : isLast ? <>Auswerten <Trophy size={15} /></> : <>Weiter <ArrowRight size={15} /></>}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

function Results({ quiz, result, onExit }: { quiz: Quiz; result: AttemptResult; onExit: () => void }) {
  const tone = result.pct >= 80 ? "emerald" : result.pct >= 50 ? "amber" : "rose";
  const toneCls: Record<string, string> = { emerald: "text-emerald-400 bg-emerald-500/15", amber: "text-amber-400 bg-amber-500/15", rose: "text-rose-400 bg-rose-500/15" };
  return (
    <Frame onExit={onExit}>
      <div className="w-full max-w-xl">
        <div className="animate-pop text-center">
          <div className={cx("mx-auto mb-4 grid h-20 w-20 place-items-center rounded-3xl", toneCls[tone])}><Trophy size={38} /></div>
          <h2 className="text-2xl font-extrabold">{result.score} / {result.total} richtig</h2>
          <p className="mt-1 text-slate-400">{result.pct}% · 🔥 {result.streak} Tage Streak</p>
        </div>

        <div className="mt-6 space-y-2">
          {result.detail.map((d) => (
            <div key={d.id} className={cx("rounded-xl border p-3.5 text-sm", d.correct ? "border-emerald-700/40 bg-emerald-500/5" : "border-rose-700/40 bg-rose-500/5")}>
              <div className="flex items-start gap-2">
                {d.correct ? <CircleCheck size={16} className="mt-0.5 shrink-0 text-emerald-400" /> : <CircleX size={16} className="mt-0.5 shrink-0 text-rose-400" />}
                <div className="min-w-0">
                  <p className="whitespace-pre-line font-medium text-slate-200">{d.prompt}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Deine Antwort: <span className={d.correct ? "text-emerald-300" : "text-rose-300"}>{d.given || "—"}</span>
                    {!d.correct && <> · richtig: <span className="text-emerald-300">{d.answer}</span></>}
                  </p>
                  {d.explanation && <p className="mt-1 text-xs text-slate-500">{d.explanation}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-center gap-2">
          <Link className="btn-outline !border-slate-600 !text-slate-200" to={`/subjects/${quiz.subjectId}`}>Zum Fach</Link>
          <button className="btn-primary" onClick={() => location.reload()}><RotateCcw size={15} /> Neuer Versuch</button>
        </div>
      </div>
    </Frame>
  );
}

function Frame({ children, onExit, progress, counter }: any) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onExit();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onExit]);
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <div className="flex items-center gap-4 px-5 py-4">
        <button onClick={onExit} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"><X size={20} /></button>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-brand-500 transition-[width] duration-300" style={{ width: `${progress || 0}%` }} />
        </div>
        <span className="w-16 text-right text-xs font-semibold text-slate-400">{counter || ""}</span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-10">{children}</div>
    </div>
  );
}
