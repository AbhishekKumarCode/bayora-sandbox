import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { getHealth, triggerRun } from "../lib/api";

const navItems = [
  { to: "/", label: "Overview", end: true },
  { to: "/rooms", label: "Rooms" },
  { to: "/notebook", label: "Notebook" },
  { to: "/history", label: "History" },
];

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
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="w-60 shrink-0 border-r border-border flex flex-col py-5 px-4 gap-6">
        <div className="flex items-center gap-2 px-1">
          <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground grid place-items-center font-display font-bold text-sm">
            B
          </div>
          <span className="font-display font-bold text-[15px] tracking-tight">Bayora Sandbox</span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="px-3 text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
            Workspace
          </span>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-2 px-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                connected ? "bg-caught pulse-ring" : "bg-destructive"
              }`}
            />
            {connected === null ? "Connecting…" : connected ? "Broker live" : "Broker unreachable"}
          </div>
          <div className="text-xs text-muted-foreground">Rooms sealed</div>
          {mockMode !== null && (
            <span
              className={`self-start text-[11px] font-mono px-2 py-0.5 rounded-full border ${
                mockMode
                  ? "border-leak text-leak bg-leak-soft"
                  : "border-caught text-caught bg-caught-soft"
              }`}
            >
              {mockMode ? "Mock mode" : "Live API"}
            </span>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b border-border flex items-center justify-between px-6">
          <div className="text-sm text-muted-foreground">
            {startError && <span className="text-destructive">{startError}</span>}
          </div>
          <button
            onClick={handleStartRun}
            disabled={starting}
            className="font-display font-semibold text-sm bg-primary text-primary-foreground px-4 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {starting ? "Running…" : "Start run"}
          </button>
        </header>
        <main className="flex-1 p-6 max-w-5xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
