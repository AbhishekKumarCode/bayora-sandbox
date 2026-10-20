import { useState } from "react";
import { useStore } from "@/lib/store";
import { BROKER_URL } from "@/lib/api";
import { Button, Card, Pill } from "@/components/ui";
import { ConnectDialog } from "@/components/ConnectDialog";

export function Settings() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-[13.5px] text-muted">Connection and data source.</p>
      </div>
      <Card className="p-5" glow="brand">
        <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted">Broker</div>
        <div className="mono mt-2 text-[13px]">{BROKER_URL}</div>
        <div className="mt-2 flex items-center gap-2 text-[13px]">
          Status {s.brokerOnline ? <Pill tone="sealed" dot>online</Pill> : s.brokerOnline === false ? <Pill tone="attack" dot>unreachable</Pill> : <Pill tone="pending">checking</Pill>}
          {s.mockMode && <Pill tone="pending">mock LLM (no ANTHROPIC_API_KEY)</Pill>}
        </div>
        <div className="mt-2 text-[12.5px] text-muted">Set <code className="mono">VITE_BROKER_URL</code> at build time to point at a different broker.</div>
      </Card>
      <Card className="p-5">
        <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted">Data source</div>
        <div className="mt-2 text-[14px] font-semibold">{s.source === "broker" ? "Live broker" : "Demo data"}</div>
        <div className="mt-1 text-[13px] text-muted">{s.source === "broker" ? "The audit token lives in this tab's session storage only." : "Built-in sample log. Nothing is sent anywhere."}</div>
        <div className="mt-4 flex gap-2">
          {s.source === "broker" ? <Button variant="secondary" onClick={s.disconnect}>Disconnect and use demo data</Button> : <Button onClick={() => setOpen(true)}>Connect broker</Button>}
        </div>
      </Card>
      <Card className="p-5">
        <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted">Roles this UI holds</div>
        <ul className="mt-2 space-y-1.5 text-[13px] text-ink-2">
          <li><span className="font-medium text-ink">AUDIT_TOKEN</span> — read the chain, verify it, start a demo run. Only after you paste it.</li>
          <li><span className="font-medium text-ink">RED_TEAM_TOKEN</span> — never held here.</li>
          <li><span className="font-medium text-ink">BLUE_TEAM_TOKEN</span> — never held here.</li>
        </ul>
      </Card>
      {open && <ConnectDialog onClose={() => setOpen(false)} />}
    </div>
  );
}
