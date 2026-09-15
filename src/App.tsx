import { useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { LayoutDashboard, Library, Settings as SettingsIcon, Moon, Sun, Brain, Github } from "lucide-react";
import { ToastProvider, cx } from "./lib/ui";
import Dashboard from "./pages/Dashboard";
import Subjects from "./pages/Subjects";
import SubjectDetail from "./pages/SubjectDetail";
import AddMaterial from "./pages/AddMaterial";
import Study from "./pages/Study";
import QuizRunner from "./pages/Quiz";
import Settings from "./pages/Settings";

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("sf-theme", dark ? "dark" : "light");
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/subjects", label: "Fächer", icon: Library },
  { to: "/settings", label: "Einstellungen", icon: SettingsIcon },
];

export default function App() {
  const { dark, toggle } = useTheme();
  const loc = useLocation();
  const immersive = /^\/(study|quiz)\//.test(loc.pathname);

  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        {!immersive && (
          <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white/70 p-4 backdrop-blur md:flex dark:border-slate-800 dark:bg-slate-900/60">
            <div className="mb-6 flex items-center gap-2.5 px-2">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-white shadow-sm shadow-brand-500/40">
                <Brain size={20} />
              </div>
              <div>
                <div className="text-sm font-extrabold tracking-tight">StudyForge</div>
                <div className="text-[11px] text-slate-400">Lernwerkstatt</div>
              </div>
            </div>
            <nav className="flex flex-col gap-1">
              {nav.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx("nav-link", isActive && "active")}>
                  <n.icon size={18} />
                  {n.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-auto flex items-center justify-between px-1 text-slate-400">
              <button onClick={toggle} className="btn-ghost !px-2.5 !py-2" title="Theme wechseln">
                {dark ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <span className="flex items-center gap-1 text-[11px]"><Github size={12} /> lokal · v0.1</span>
            </div>
          </aside>
        )}

        <main className="min-w-0 flex-1">
          {!immersive && (
            <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-5 py-3 backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-950/80">
              <div className="flex items-center gap-2 font-extrabold"><Brain size={18} className="text-brand-500" /> StudyForge</div>
              <button onClick={toggle} className="btn-ghost !px-2.5 !py-2">{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
            </header>
          )}
          {immersive ? (
            <Routes location={loc}>
              <Route path="/study/:id" element={<Study />} />
              <Route path="/quiz/:qid" element={<QuizRunner />} />
            </Routes>
          ) : (
            <div key={loc.pathname} className="animate-fade-in mx-auto max-w-6xl px-5 py-6 md:py-8">
              <Routes location={loc}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/subjects" element={<Subjects />} />
                <Route path="/subjects/:id" element={<SubjectDetail />} />
                <Route path="/subjects/:id/material/:mid" element={<AddMaterial />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<div className="p-10 text-center text-slate-500">Seite nicht gefunden.</div>} />
              </Routes>
            </div>
          )}
        </main>
      </div>

      {!immersive && (
        <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-slate-200 bg-white/90 py-2 backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-900/90">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx("flex flex-col items-center gap-0.5 px-4 py-1 text-[11px] font-medium", isActive ? "text-brand-500" : "text-slate-400")}>
              <n.icon size={20} />
              {n.label}
            </NavLink>
          ))}
        </nav>
      )}
    </ToastProvider>
  );
}
