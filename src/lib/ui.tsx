import React, { createContext, useContext, useCallback, useEffect, useState } from "react";
import { X, CheckCircle2, AlertTriangle, Info, Loader2 } from "lucide-react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Spinner({ className = "" }: { className?: string }) {
  return <Loader2 className={cx("animate-spin", className)} />;
}

export function ProgressRing({ value, size = 44, stroke = 5, color = "#3366ff" }: { value: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.max(0, Math.min(100, value)) / 100) * c;
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="stroke-slate-200 dark:stroke-slate-800" fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} strokeLinecap="round" fill="none"
        stroke={color} strokeDasharray={c} strokeDashoffset={off}
        style={{ transition: "stroke-dashoffset .6s ease" }}
      />
    </svg>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 animate-fade-in bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className={cx("card animate-pop relative z-10 w-full p-6", wide ? "max-w-2xl" : "max-w-md")}>
        <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800">
          <X size={18} />
        </button>
        {title && <h3 className="mb-4 pr-8 text-lg font-bold">{title}</h3>}
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon?: React.ReactNode; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-14 text-center dark:border-slate-700">
      {icon && <div className="mb-3 text-slate-400">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-slate-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------- Toasts ---------- */
type Toast = { id: number; kind: "ok" | "err" | "info"; msg: string };
const ToastCtx = createContext<(kind: Toast["kind"], msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              "card animate-fade-in pointer-events-auto flex items-start gap-2.5 p-3 text-sm shadow-lg",
              t.kind === "ok" && "border-emerald-300 dark:border-emerald-800",
              t.kind === "err" && "border-rose-300 dark:border-rose-800"
            )}
          >
            {t.kind === "ok" && <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" />}
            {t.kind === "err" && <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-500" />}
            {t.kind === "info" && <Info size={18} className="mt-0.5 shrink-0 text-brand-500" />}
            <span className="leading-snug">{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- tiny data hook ---------- */
export function useAsync<T>(fn: () => Promise<T>, deps: React.DependencyList = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fn()
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);
  return { data, error, loading, reload, setData };
}
