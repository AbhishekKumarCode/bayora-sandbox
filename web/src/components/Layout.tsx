import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { LayoutGrid, DoorOpen, NotebookPen, History as HistoryIcon, Play } from "lucide-react";
import { getHealth, triggerRun } from "../lib/api";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutGrid, end: true },
  { to: "/rooms", label: "Rooms", icon: DoorOpen },
  { to: "/notebook", label: "Notebook", icon: NotebookPen },
  { to: "/history", label: "History", icon: HistoryIcon },
];

function Mark() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#4f46e5" />
      <path d="M10 21 L16 10 L22 21 Z" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" opacity="0.9" />
      <circle cx="16" cy="17" r="2" fill="#fff" />
    </svg>
  );
}

export default function Layout() {
  const [mockMode, setMockMode] = useState<boolean | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    function poll() {
      getHealth()
        .then((h) => {
          if (cancelled) return;
          setMockMode(h.mockMode);
          setConnected(true);
        })
        .catch(() => {
          if (!cancelled) setConnected(false);
        });
    }
    poll();
    const id = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function handleStartRun() {
    setStarting(true);
    setStartError(null);
    try {
      await triggerRun();
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "failed to start run");
    } finally {
      setTimeout(() => setStarting(false), 1500);
    }
  }

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-ink2 px-3 py-4 text-slate-300 md:flex">
        <div className="flex items-center gap-2.5 px-3 pb-5 pt-1">
          <Mark />
          <span className="font-display text-lg font-semibold text-white tracking-tight">Bayora Sandbox</span>
        </div>

        <nav className="space-y-0.5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={17} className={isActive ? "text-indigo-300" : ""} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2 px-3 pt-4 border-t border-white/10">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span
              className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                connected ? "bg-caught pulse-ring" : "bg-destructive"
              }`}
            />
            {connected === null ? "Connecting…" : connected ? "Broker live" : "Broker unreachable"}
          </div>
          {mockMode !== null && (
            <span
              className={`self-start text-[11px] font-mono px-2 py-0.5 rounded-full border ${
                mockMode ? "border-leak text-leak bg-leak-soft" : "border-caught text-caught bg-caught-soft"
              }`}
            >
              {mockMode ? "Mock mode" : "Live API"}
            </span>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:px-8">
          <div className="min-w-0 flex-1 md:hidden flex items-center gap-2">
            <Mark />
            <span className="font-display font-semibold tracking-tight">Bayora Sandbox</span>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            {startError && <span className="text-xs text-destructive">{startError}</span>}
            <button
              onClick={handleStartRun}
              disabled={starting}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-indigo-700 disabled:opacity-50"
            >
              <Play size={15} />
              {starting ? "Running…" : "Start run"}
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
