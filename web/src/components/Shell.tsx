import { useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { LayoutGrid, ListChecks, Radio, Library, Link2, Settings2, Menu, X, Plug, PlugZap, Database } from "lucide-react";
import { useStore, useNow } from "@/lib/store";
import { isLive } from "@/lib/model";
import { Button, Glow, Pill, cx } from "./ui";
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

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            cx(
              "group flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13.5px] font-medium transition-colors",
              isActive ? "bg-white text-ink shadow-[0_1px_2px_rgb(17_19_24/0.06),0_0_0_1px_rgb(17_19_24/0.05)]" : "text-ink-2 hover:bg-white/60 hover:text-ink",
            )
          }
        >
          <Icon size={16} className="text-muted group-[.active]:text-brand" />
          {label}
          {label === "Live run" && live && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-attack shadow-[0_0_0_3px_rgb(229_72_77/0.2)]" />}
        </NavLink>
      ))}
    </nav>
  );

  const sourceBlock = (
    <div className="rounded-[12px] border border-line bg-white p-3">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-medium text-muted">Data source</div>
        <span className={cx("h-2 w-2 rounded-full", s.brokerOnline ? "bg-sealed" : s.brokerOnline === false ? "bg-attack" : "bg-faint")} title={s.brokerOnline ? "Broker online" : "Broker unreachable"} />
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        {s.source === "broker" ? <PlugZap size={15} className="text-sealed" /> : <Database size={15} className="text-brand" />}
        <div className="text-[13px] font-semibold">{s.source === "broker" ? "Live broker" : "Demo data"}</div>
        {s.mockMode && s.source === "broker" && <Pill tone="pending" className="ml-auto">mock LLM</Pill>}
      </div>
      <div className="mt-2.5 flex gap-1.5">
        {s.source === "broker" ? (
          <Button size="sm" variant="secondary" className="flex-1" onClick={s.disconnect}>Disconnect</Button>
        ) : (
          <Button size="sm" variant="secondary" className="flex-1" onClick={() => setConnectOpen(true)}><Plug size={13} /> Connect broker</Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* page glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <Glow tone="brand" size={800} className="-top-96 right-[-15%] opacity-20" />
      </div>

      <div className="relative flex min-h-screen">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r border-line/80 bg-[#f1f2f5]/80 px-3 py-4 backdrop-blur lg:flex">
          <Link to="/" className="mb-6 flex items-center gap-2 px-2">
            <Logo />
            <span className="text-[14px] font-semibold tracking-tight">Bayora Sandbox</span>
          </Link>
          {nav}
          <div className="mt-auto space-y-2">
            {sourceBlock}
            <NavLink to="/app/settings" className="flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13.5px] font-medium text-ink-2 hover:bg-white/60">
              <Settings2 size={16} className="text-muted" /> Settings
            </NavLink>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar */}
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line/80 bg-canvas/80 px-4 backdrop-blur lg:hidden">
            <Link to="/" className="flex items-center gap-2"><Logo /><span className="text-[14px] font-semibold">Bayora</span></Link>
            <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-[8px] p-2 hover:bg-white"><Menu size={18} /></button>
          </header>

          <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[280px] flex-col bg-[#f1f2f5] px-3 py-4">
            <div className="mb-6 flex items-center justify-between px-2">
              <span className="flex items-center gap-2"><Logo /><span className="text-[14px] font-semibold">Bayora Sandbox</span></span>
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-[8px] p-2 hover:bg-white"><X size={18} /></button>
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

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <span className="absolute inset-0 rounded-[8px] bg-brand shadow-[0_0_18px_rgb(109_93_246/0.45)]" />
      <svg className="relative" width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
      </svg>
    </span>
  );
}
