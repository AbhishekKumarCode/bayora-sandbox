import { useState } from "react";
import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { LayoutGrid, ListChecks, Radio, Library, Link2, Settings2, Menu, X, Plug, Database } from "lucide-react";
import { useStore, useNow } from "@/lib/store";
import { isLive } from "@/lib/model";
import { Button, Pill, cx } from "./ui";
import { getBrokerUrl } from "@/lib/api";
import { ConnectDialog } from "./ConnectDialog";

const NAV = [
  { to: "/app", label: "Overview", icon: LayoutGrid, end: true },
  { to: "/app/runs", label: "Runs", icon: ListChecks },
  { to: "/app/live", label: "Live run", icon: Radio },
  { to: "/app/library", label: "Attack library", icon: Library },
  { to: "/app/audit", label: "Audit chain", icon: Link2 },
];

export function Shell() {
  const s = useStore();
  const now = useNow(1000);
  const live = isLive(s.entries, now);
  const [open, setOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const { pathname } = useLocation();
  const current = NAV.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)));
  const pageTitle = pathname.match(/^\/app\/runs\/[^/]+/) ? "Run detail" : pathname.startsWith("/app/settings") ? "Settings" : current?.label ?? "Dashboard";
  const sinceLastPoll = s.lastPollAt ? Math.round((now - s.lastPollAt) / 1000) : null;

  const nav = (
    <nav className="flex flex-col gap-2">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => cx("b-nav text-[14px]", isActive && "active")}>
          <Icon size={17} strokeWidth={2.5} />
          {label}
          {label === "Live run" && live && <span className="ml-auto h-3 w-3 border-2 border-ink bg-red" />}
        </NavLink>
      ))}
    </nav>
  );

  const sourceBlock = (
    <div className="b-card-flat p-3">
      <div className="flex items-center justify-between">
        <div className="label text-muted">Data source</div>
        <span className={cx("h-3 w-3 border-2 border-ink", s.brokerOnline ? "bg-green" : s.brokerOnline === false ? "bg-red" : "bg-faint")} title={s.brokerOnline ? "Broker online" : "Broker unreachable"} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        {s.source === "broker" ? <Plug size={16} strokeWidth={2.5} /> : <Database size={16} strokeWidth={2.5} />}
        <div className="display text-[15px]">{s.source === "broker" ? "Live broker" : "Demo data"}</div>
        {s.mockMode && s.source === "broker" && <Pill tone="amber" className="ml-auto">mock</Pill>}
      </div>
      <div className="mt-3">
        {s.source === "broker"
          ? <Button size="sm" className="w-full" onClick={s.disconnect}>Disconnect</Button>
          : <Button size="sm" variant="primary" className="w-full" onClick={() => setConnectOpen(true)}>Connect broker</Button>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="relative flex min-h-screen">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r-[3px] border-ink bg-paper px-4 py-5 lg:flex">
          <Link to="/" className="mb-7 flex items-center gap-2.5 px-1">
            <Logo />
            <span className="display text-[17px]">Bayora Sandbox</span>
          </Link>
          {nav}
          <div className="mt-auto space-y-3">
            {sourceBlock}
            <NavLink to="/app/settings" className={({ isActive }) => cx("b-nav text-[14px]", isActive && "active")}>
              <Settings2 size={17} strokeWidth={2.5} /> Settings
            </NavLink>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b-[3px] border-ink bg-yellow">
            <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-3 px-4 sm:px-6 lg:px-8">
              <Link to="/" className="flex items-center gap-2 lg:hidden"><Logo /><span className="display text-[16px]">Bayora</span></Link>
              <div className="hidden items-center gap-2 lg:flex">
                <span className="label">Sandbox</span><span className="label opacity-50">/</span><span className="display text-[15px]">{pageTitle}</span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {live && <Pill tone="red" dot className="hidden sm:inline-flex">run in progress</Pill>}
                <div className="hidden items-center gap-2 border-[3px] border-ink bg-card py-1 pl-2.5 pr-1.5 text-[12.5px] font-semibold md:flex" title={getBrokerUrl()}>
                  <span className={cx("h-2.5 w-2.5 border-2 border-ink", s.brokerOnline ? "bg-green" : s.brokerOnline === false ? "bg-red" : "bg-faint")} />
                  <span className="mono text-[11px] font-bold uppercase tracking-wide">
                    {s.brokerOnline === false ? "broker unreachable" : s.source === "broker" ? `live · ${sinceLastPoll == null ? "…" : sinceLastPoll + "s"}` : s.brokerOnline ? `online${s.mockMode ? " · mock" : ""} · demo` : "checking"}
                  </span>
                  {s.source === "broker"
                    ? <button onClick={s.disconnect} className="b-pill ink cursor-pointer">disconnect</button>
                    : <button onClick={() => setConnectOpen(true)} className="b-pill ink cursor-pointer">connect</button>}
                </div>
                <Button size="sm" to="/app/live" className="hidden sm:inline-flex"><Radio size={14} strokeWidth={2.5} /> Live</Button>
                <button onClick={() => setOpen(true)} aria-label="Open menu" className="border-[3px] border-ink bg-card p-1.5 lg:hidden"><Menu size={18} strokeWidth={2.5} /></button>
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </main>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[290px] flex-col border-r-[3px] border-ink bg-paper px-4 py-5">
            <div className="mb-6 flex items-center justify-between px-1">
              <span className="flex items-center gap-2"><Logo /><span className="display text-[16px]">Bayora Sandbox</span></span>
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="border-[3px] border-ink bg-card p-1.5"><X size={18} strokeWidth={2.5} /></button>
            </div>
            {nav}
            <div className="mt-auto">{sourceBlock}</div>
          </div>
        </div>
      )}

      {connectOpen && <ConnectDialog onClose={() => setConnectOpen(false)} />}
    </div>
  );
}

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center border-[3px] border-ink bg-yellow" style={{ width: size, height: size, boxShadow: "3px 3px 0 var(--color-ink)" }}>
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke="#0d0d0d" strokeWidth="2.6" strokeLinecap="square" strokeLinejoin="miter">
        <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
      </svg>
    </span>
  );
}
