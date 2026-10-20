import { useState } from "react";
import { X, KeyRound } from "lucide-react";
import { useStore } from "@/lib/store";
import { BROKER_URL } from "@/lib/api";
import { Button, Glow } from "./ui";

export function ConnectDialog({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setBusy(true);
    setErr(null);
    const ok = await s.connect(token);
    setBusy(false);
    if (ok) onClose();
    else setErr(s.error || "Could not connect.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} />
      <form onSubmit={submit} className="card relative w-full max-w-md overflow-hidden p-6 rise">
        <Glow tone="sealed" size={300} className="-top-28 -right-28 opacity-50" />
        <div className="relative">
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-sealed-soft text-sealed"><KeyRound size={18} /></div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-[8px] p-1.5 text-muted hover:bg-canvas"><X size={16} /></button>
          </div>
          <h2 className="mt-4 text-[18px] font-semibold tracking-tight">Connect to the broker</h2>
          <p className="mt-1 text-[13px] text-muted">
            Paste the <code className="mono">AUDIT_TOKEN</code> from your broker's <code className="mono">.env</code>. It stays in this tab's session storage and is sent only to the broker.
          </p>
          <div className="mt-4 rounded-[10px] border border-line bg-canvas px-3 py-2 text-[12px] text-muted">
            Broker <span className="mono text-ink-2">{BROKER_URL}</span>
          </div>
          <input
            autoFocus
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="AUDIT_TOKEN"
            className="mono mt-3 h-11 w-full rounded-[10px] border border-line bg-white px-3 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          {err && <div className="mt-2 text-[13px] text-attack">{err}</div>}
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy || !token.trim()}>{busy ? "Connecting…" : "Connect"}</Button>
          </div>
        </div>
      </form>
    </div>
  );
}
