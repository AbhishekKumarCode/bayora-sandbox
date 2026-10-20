import { useEffect, useState } from "react";
import { X, KeyRound, CheckCircle2, XCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { useStore } from "@/lib/store";
import { DEFAULT_BROKER_URL, getBrokerUrl, setBrokerUrl, getHealth } from "@/lib/api";
import { Button, Glow, cx } from "./ui";

type Probe = { state: "idle" | "checking" | "ok" | "fail"; mock?: boolean; msg?: string };

export function ConnectDialog({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [url, setUrl] = useState(getBrokerUrl());
  const [token, setToken] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [probe, setProbe] = useState<Probe>({ state: "idle" });

  // Step 1: can the browser reach the broker at all?
  useEffect(() => {
    let alive = true;
    const clean = url.trim().replace(/\/+$/, "");
    if (!/^https?:\/\//.test(clean)) { setProbe({ state: "fail", msg: "URL must start with http:// or https://" }); return; }
    setProbe({ state: "checking" });
    const id = setTimeout(async () => {
      setBrokerUrl(clean);
      try {
        const h = await getHealth();
        if (alive) setProbe({ state: "ok", mock: h.mockMode });
      } catch (e) {
        if (alive) setProbe({ state: "fail", msg: e instanceof Error ? e.message : String(e) });
      }
    }, 350);
    return () => { alive = false; clearTimeout(id); };
  }, [url]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setBusy(true);
    setErr(null);
    const msg = await s.connect(token);
    setBusy(false);
    if (msg == null) onClose();
    else setErr(msg);
  }

  const tokenLooksOk = /^[0-9a-f]{40,64}$/i.test(token.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} />
      <form onSubmit={submit} className="card relative w-full max-w-lg overflow-hidden p-6 rise">
        <Glow tone="sealed" size={300} className="-top-28 -right-28 opacity-50" />
        <div className="relative">
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-sealed-soft text-sealed"><KeyRound size={18} /></div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-[8px] p-1.5 text-muted hover:bg-canvas"><X size={16} /></button>
          </div>
          <h2 className="mt-4 text-[18px] font-semibold tracking-tight">Connect to your broker</h2>
          <p className="mt-1 text-[13px] text-muted">Two steps: the page must reach the broker, then the broker must accept your audit token.</p>

          {/* Step 1 */}
          <Step n={1} title="Broker address" status={probe.state === "ok" ? "ok" : probe.state === "fail" ? "fail" : "checking"}>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              spellCheck={false}
              className="mono h-10 w-full rounded-[10px] border border-line bg-white px-3 text-[12.5px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <div className="mt-1.5 flex items-center justify-between text-[12px]">
              <span className={cx(probe.state === "ok" ? "text-sealed" : probe.state === "fail" ? "text-attack" : "text-muted")}>
                {probe.state === "checking" && "Checking /health…"}
                {probe.state === "ok" && `Reachable${probe.mock ? " · running in mock mode (no model API key)" : " · real model"}`}
                {probe.state === "fail" && (probe.msg ?? "Unreachable")}
              </span>
              {url !== DEFAULT_BROKER_URL && <button type="button" onClick={() => setUrl(DEFAULT_BROKER_URL)} className="text-brand hover:underline">reset</button>}
            </div>
          </Step>

          {/* Step 2 */}
          <Step n={2} title="Audit token" status={err ? "fail" : tokenLooksOk ? "ok" : "idle"}>
            <div className="relative">
              <input
                autoFocus
                type={show ? "text" : "password"}
                value={token}
                onChange={(e) => { setToken(e.target.value); setErr(null); }}
                placeholder="paste AUDIT_TOKEN"
                spellCheck={false}
                className="mono h-10 w-full rounded-[10px] border border-line bg-white px-3 pr-10 text-[12.5px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide token" : "Show token"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink">{show ? <EyeOff size={15} /> : <Eye size={15} />}</button>
            </div>
            <div className="mt-1.5 text-[12px] text-muted">
              It is the <code className="mono">AUDIT_TOKEN</code> line in the broker's <code className="mono">.env</code> (a long hex string). Not the red or blue token. It stays in this tab only.
              {token && !tokenLooksOk && <span className="text-pending"> This doesn't look like a hex token; check for spaces or quotes.</span>}
            </div>
            {err && <div className="mt-2 rounded-[8px] bg-attack-soft px-3 py-2 text-[12.5px] text-attack">{err}</div>}
          </Step>

          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy || !token.trim() || probe.state !== "ok"}>{busy ? "Connecting…" : "Connect"}</Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Step({ n, title, status, children }: { n: number; title: string; status: "idle" | "checking" | "ok" | "fail"; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-center gap-2 text-[13px] font-medium">
        <span className={cx("flex h-5 w-5 items-center justify-center rounded-full text-[11px]", status === "ok" ? "bg-sealed text-white" : status === "fail" ? "bg-attack text-white" : "bg-[#eceef2] text-muted")}>
          {status === "ok" ? <CheckCircle2 size={13} /> : status === "fail" ? <XCircle size={13} /> : status === "checking" ? <Loader2 size={12} className="animate-spin" /> : n}
        </span>
        {title}
      </div>
      {children}
    </div>
  );
}
