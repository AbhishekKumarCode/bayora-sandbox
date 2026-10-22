import { useEffect, useState } from "react";
import { X, CheckCircle2, XCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { useStore } from "@/lib/store";
import { useDialog } from "@/lib/useDialog";
import { DEFAULT_BROKER_URL, getBrokerUrl, setBrokerUrl, getHealth } from "@/lib/api";
import { Button, cx } from "./ui";

type Probe = { state: "idle" | "checking" | "ok" | "fail"; mock?: boolean; msg?: string };

export function ConnectDialog({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [url, setUrl] = useState(getBrokerUrl());
  const [token, setToken] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [probe, setProbe] = useState<Probe>({ state: "idle" });
  const dialogRef = useDialog(onClose);

  useEffect(() => {
    let alive = true;
    const clean = url.trim().replace(/\/+$/, "");
    if (!/^https?:\/\//.test(clean)) { setProbe({ state: "fail", msg: "URL must start with http:// or https://" }); return; }
    setProbe({ state: "checking" });
    const id = setTimeout(async () => {
      if (clean !== getBrokerUrl()) setBrokerUrl(clean); // only persist a change the user made
      try { const h = await getHealth(); if (alive) setProbe({ state: "ok", mock: h.mockMode }); }
      catch (e) { if (alive) setProbe({ state: "fail", msg: e instanceof Error ? e.message : String(e) }); }
    }, 350);
    return () => { alive = false; clearTimeout(id); };
  }, [url]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setBusy(true); setErr(null);
    const msg = await s.connect(token, remember);
    setBusy(false);
    if (msg == null) onClose(); else setErr(msg);
  }
  const tokenLooksOk = /^[0-9a-f]{40,64}$/i.test(token.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="modal-backdrop absolute inset-0" onClick={onClose} />
      <form ref={dialogRef as unknown as React.RefObject<HTMLFormElement>} onSubmit={submit} role="dialog" aria-modal="true" aria-label="Operator login" className="modal-surface b-card relative w-full max-w-lg rounded-[18px] p-6 rise">
        <div className="flex items-start justify-between">
          <h2 className="display text-[24px]">Operator login</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="border border-line bg-card p-1"><X size={16} strokeWidth={2.5} /></button>
        </div>
        <p className="mt-2 text-[13.5px] text-ink-2">You do not need this to look around or to start a run: visitors can do both. The audit token adds switching the model, comparing two models, and reading the exact attack prompts.</p>

        <Step n={1} title="Broker address" status={probe.state === "ok" ? "ok" : probe.state === "fail" ? "fail" : "checking"}>
          <input id="broker-url" value={url} onChange={(e) => setUrl(e.target.value)} spellCheck={false} className="b-input text-[12.5px]" />
          <div className="mt-2 flex items-center justify-between text-[12.5px] font-semibold">
            <span className={cx(probe.state === "ok" ? "text-green-2" : probe.state === "fail" ? "text-red-2" : "text-muted")}>
              {probe.state === "checking" && "Checking /health…"}
              {probe.state === "ok" && `Reachable${probe.mock ? " · mock mode (no model configured)" : " · real model"}`}
              {probe.state === "fail" && (probe.msg ?? "Unreachable")}
            </span>
            {url !== DEFAULT_BROKER_URL && <button type="button" onClick={() => setUrl(DEFAULT_BROKER_URL)} className="label underline">reset</button>}
          </div>
        </Step>

        <Step n={2} title="Audit token" status={err ? "fail" : tokenLooksOk ? "ok" : "idle"}>
          <div className="relative">
            <input id="audit-token" autoFocus type={show ? "text" : "password"} value={token} onChange={(e) => { setToken(e.target.value); setErr(null); }} placeholder="paste AUDIT_TOKEN" spellCheck={false} className="b-input pr-11 text-[12.5px]" />
            <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide token" : "Show token"} className="absolute right-2 top-1/2 -translate-y-1/2 p-1">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </div>
          <div className="mt-2 text-[12.5px] text-ink-2">
            The <code className="mono font-bold">AUDIT_TOKEN</code> line in the broker's <code className="mono font-bold">.env</code>, a long hex string. Not the red or blue token. It stays in this tab only.
            {token && !tokenLooksOk && <span className="font-semibold text-amber-2"> This doesn't look like a hex token; check for spaces or quotes.</span>}
          </div>
          {err && <div className="mt-3 border border-line bg-red px-3 py-2 text-[12.5px] font-semibold text-white">{err}</div>}
        </Step>

        <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-[13px] text-ink-2">
          <input id="remember-token" type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#4a5be6]" />
          <span><span className="font-semibold text-ink">Stay signed in on this device.</span> Stored in this browser only and sent only to the broker. Use "Sign out" to forget it.</span>
        </label>

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy || !token.trim() || probe.state !== "ok"}>{busy ? "Signing in…" : "Sign in"}</Button>
        </div>
      </form>
    </div>
  );
}

function Step({ n, title, status, children }: { n: number; title: string; status: "idle" | "checking" | "ok" | "fail"; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center gap-2">
        <span className={cx("flex h-6 w-6 items-center justify-center border border-line text-[11px] font-bold", status === "ok" ? "bg-green" : status === "fail" ? "bg-red text-white" : "bg-card")}>
          {status === "ok" ? <CheckCircle2 size={14} /> : status === "fail" ? <XCircle size={14} /> : status === "checking" ? <Loader2 size={13} className="animate-spin" /> : n}
        </span>
        <span className="display text-[15px]">{title}</span>
      </div>
      {children}
    </div>
  );
}
