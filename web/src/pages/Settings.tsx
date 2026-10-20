import { useState } from "react";
import { useStore } from "@/lib/store";
import { getBrokerUrl } from "@/lib/api";
import { Button, Card, Pill } from "@/components/ui";
import { ConnectDialog } from "@/components/ConnectDialog";

export function Settings() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  return (
    <div className="mx-auto max-w-[760px] space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight sm:text-[32px]">Settings</h1>
        <p className="mt-1.5 text-[14px] text-muted">Connection and data source.</p>
      </div>
      <Card className="p-5" glow="brand">
        <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted">Broker</div>
        <div className="mono mt-2 break-all text-[13px]">{getBrokerUrl()}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
          Status {s.brokerOnline ? <Pill tone="sealed" dot>online</Pill> : s.brokerOnline === false ? <Pill tone="attack" dot>unreachable</Pill> : <Pill tone="pending">checking</Pill>}
          {s.mockMode && <Pill tone="pending">mock LLM (no ANTHROPIC_API_KEY)</Pill>}
          <Button size="sm" variant="ghost" onClick={s.recheckHealth}>Re-check</Button>
        </div>
        <div className="mt-2 text-[12.5px] text-muted">Change the address from the Connect dialog. It is remembered in this browser.</div>
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
          <li><span className="font-medium text-ink">AUDIT_TOKEN</span>: read the chain, verify it, start a demo run. Only after you paste it.</li>
          <li><span className="font-medium text-ink">RED_TEAM_TOKEN</span>: never held here.</li>
          <li><span className="font-medium text-ink">BLUE_TEAM_TOKEN</span>: never held here.</li>
        </ul>
      </Card>
      {open && <ConnectDialog onClose={() => setOpen(false)} />}
    </div>
  );
}
