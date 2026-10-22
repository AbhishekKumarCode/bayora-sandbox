import { useEffect, useState } from "react";
import { Cpu, RefreshCw, Check, GitCompare } from "lucide-react";
import { useStore } from "@/lib/store";
import { getBrokerUrl, getConfig, getModels, setModel, type BrokerConfig } from "@/lib/api";
import { Link } from "react-router-dom";
import { Button, Card, Tile, Pill, cx } from "@/components/ui";
import { ConnectDialog } from "@/components/ConnectDialog";

export function Settings() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  return (
    <div className="mx-auto max-w-[800px] space-y-7">
      <div>
        <h1 className="display text-[36px] sm:text-[44px]">Settings</h1>
        <p className="mt-2 text-[14.5px] font-semibold text-ink-2">Connection, the model under test, and the data source.</p>
      </div>

      {s.source === "broker" && s.role === "operator" ? <ModelCard /> : (
        <Tile tone="violet" className="p-5">
          <div className="label text-muted">Model under test</div>
          <p className="mt-2 text-[13.5px] text-ink-2">{s.source === "broker" ? `Currently under test: ${s.modelName ?? (s.mockMode ? "mock" : "…")}. Sign in as the operator to switch it.` : "Connect a broker to see which model is being attacked and switch it from here."}</p>
          <Button variant="primary" className="mt-4" onClick={() => setOpen(true)}>{s.source === "broker" ? "Operator login" : "Connect broker"}</Button>
        </Tile>
      )}

      <Card className="p-5">
        <div className="label text-muted">Broker</div>
        <div className="mono mt-2 break-all text-[13px] font-bold">{getBrokerUrl()}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
          Status {s.brokerOnline ? <Pill tone="green" dot>online</Pill> : s.brokerOnline === false ? <Pill tone="red" dot>unreachable</Pill> : <Pill tone="amber">checking</Pill>}
          {s.mockMode && <Pill tone="amber">mock mode</Pill>}
          <Button size="sm" onClick={s.recheckHealth}>Re-check</Button>
        </div>
        <div className="mt-2 text-[12.5px] font-semibold text-ink-2">Change the address from the Connect dialog. It is remembered in this browser.</div>
      </Card>

      <Card className="p-5">
        <div className="label text-muted">Data source</div>
        <div className="display mt-2 text-[20px]">{s.source === "broker" ? "Live broker" : "Not connected"}</div>
        <div className="mt-1 text-[13px] font-semibold text-ink-2">{s.source === "broker" ? (s.role === "operator" ? "Your operator token is stored in this browser (or only this tab, if you unticked \"Stay signed in\"). Sign out removes it. It is never sent anywhere except the broker." : "Visitors use a read-only token and store nothing secret.") : "No broker reachable. Nothing to show."}</div>
        <div className="mt-4 flex gap-2">
          {s.role === "operator" ? <Button onClick={s.disconnect}>Sign out</Button> : s.source !== "broker" ? <Button variant="primary" onClick={() => setOpen(true)}>Connect broker</Button> : <span className="text-[13px] text-muted">Visitor session. Sign in from the model card above.</span>}
        </div>
      </Card>

      <Card className="p-5">
        <div className="label text-muted">Roles this UI holds</div>
        <ul className="mt-2 space-y-1.5 text-[13px] font-semibold text-ink-2">
          <li><span className="mono font-bold text-ink">AUDIT_TOKEN</span>: read the chain, verify it, start a run, switch the model under test. Only after you sign in.</li>
          <li><span className="mono font-bold text-ink">RED_TEAM_TOKEN</span>: never held here.</li>
          <li><span className="mono font-bold text-ink">BLUE_TEAM_TOKEN</span>: never held here. The judge's model is set in the blue container, not from this page, so the operator cannot quietly swap the judge.</li>
        </ul>
      </Card>
      {open && <ConnectDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function ModelCard() {
  const s = useStore();
  const [cfg, setCfg] = useState<BrokerConfig | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState<"load" | "save" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [second, setSecond] = useState("");
  const [cmpMsg, setCmpMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [cmpBusy, setCmpBusy] = useState(false);

  async function load() {
    setBusy("load"); setMsg(null);
    try {
      const [c, m] = await Promise.all([getConfig(), getModels().catch(() => ({ models: [], current: "" }))]);
      setCfg(c); setModels(m.models); setChoice(c.model);
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) }); }
    finally { setBusy(null); }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!choice || choice === cfg?.model) return;
    setBusy("save"); setMsg(null);
    try {
      const c = await setModel(choice);
      setCfg((prev) => prev ? { ...prev, model: c.model } : prev);
      setMsg({ ok: true, text: `Model under test is now ${c.model}. The next run will attack it.` });
      s.recheckHealth();
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) }); }
    finally { setBusy(null); }
  }

  async function runBoth() {
    if (!cfg || !second || second === cfg.model) return;
    setCmpBusy(true); setCmpMsg(null);
    try {
      await s.triggerCompare([cfg.model, second]);
      setCmpMsg({ ok: true, text: `Running the full suite against ${cfg.model}, then ${second}. Each run is sealed separately with the model name on every reply; the Compare page fills in as they land (about two minutes).` });
    } catch (e) { setCmpMsg({ ok: false, text: e instanceof Error ? e.message : String(e) }); }
    finally { setCmpBusy(false); }
  }

  return (
    <Tile tone="violet" className="p-5">
      <div className="flex items-center justify-between">
        <div className="label text-muted">Model under test</div>
        <button onClick={load} disabled={busy != null} className="label flex items-center gap-1 underline decoration-2 underline-offset-4 disabled:opacity-50"><RefreshCw size={12} className={cx(busy === "load" && "animate-spin")} /> refresh</button>
      </div>
      {cfg && (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Cpu size={16} className="text-brand" />
            <span className="display text-[20px]">{cfg.model}</span>
            <Pill tone={cfg.mockMode ? "amber" : "violet"}>{cfg.mockMode ? "mock" : cfg.provider}</Pill>
            {cfg.baseUrl && <span className="mono text-[12px] font-bold text-muted">{cfg.baseUrl.replace(/^https?:\/\//, "")}</span>}
            {cfg.runInProgress && <Pill tone="red" dot>run in progress</Pill>}
          </div>
          {!cfg.mockMode && (
            <div className="mt-4">
              <label htmlFor="model-select" className="label">Switch model</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {models.length > 0 ? (
                  <select value={choice} onChange={(e) => setChoice(e.target.value)} id="model-select" className="b-input min-w-[260px] flex-1">
                    {models.map((m) => <option key={m} value={m}>{m}</option>)}
                    {!models.includes(choice) && choice && <option value={choice}>{choice}</option>}
                  </select>
                ) : (
                  <input value={choice} onChange={(e) => setChoice(e.target.value)} id="model-select" placeholder="model id" className="b-input min-w-[260px] flex-1" />
                )}
                <Button variant="primary" onClick={save} disabled={busy != null || !choice || choice === cfg.model || cfg.runInProgress}><Check size={15} /> {busy === "save" ? "Switching…" : "Use this model"}</Button>
              </div>
              <p className="mt-2 text-[12.5px] font-semibold text-ink-2">Takes effect on the next run. Each reply in the log records which model answered, so runs against different models stay comparable.</p>
            </div>
          )}
          {msg && <div className={cx("mt-3 border border-line px-3 py-2 text-[12.5px] font-semibold rise", msg.ok ? "bg-green" : "bg-red text-white")}>{msg.text}</div>}
          {!cfg.mockMode && models.length > 1 && (
            <div className="mt-5 rounded-[12px] border border-dashed border-line-strong p-4">
              <div className="flex items-center gap-2"><GitCompare size={16} className="text-accent" /><span className="display text-[15px]">Test two models together</span></div>
              <p className="mt-1 text-[12.5px] text-ink-2">Runs the whole attack suite against the current model, then against a second one, back to back. Same prompts, same blind judge. Results land on the <Link to="/app/compare" className="underline decoration-2 underline-offset-4">Compare</Link> page.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="mono rounded-[10px] border border-line bg-white/70 px-3 py-2 text-[13px]">{cfg.model}</span>
                <span className="label text-muted">then</span>
                <select id="second-model" value={second} onChange={(e) => setSecond(e.target.value)} className="b-input h-10 min-w-[220px] flex-1">
                  <option value="">pick a second model</option>
                  {models.filter((m) => m !== cfg.model).map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <Button variant="primary" onClick={runBoth} disabled={cmpBusy || !second || cfg.runInProgress || !!cfg.compare}><GitCompare size={15} /> {cmpBusy ? "Starting…" : "Run both"}</Button>
              </div>
              {cfg.compare && <div className="label mt-2 text-accent">comparison in progress · model {cfg.compare.index + 1} of {cfg.compare.models.length}: {cfg.compare.models[cfg.compare.index]}</div>}
              {cmpMsg && <div className={cx("mt-3 border border-line px-3 py-2 text-[12.5px] font-semibold rise", cmpMsg.ok ? "bg-green" : "bg-red text-white")}>{cmpMsg.text}</div>}
            </div>
          )}
          <div className="mt-4 border-t border-line pt-3">
            <button onClick={() => setShowPrompt((v) => !v)} className="label underline decoration-2 underline-offset-4">{showPrompt ? "Hide" : "Show"} the system prompt the model runs with</button>
            {showPrompt && <pre className="mono mt-2 whitespace-pre-wrap border border-line bg-white p-3 text-[12px] leading-relaxed">{cfg.systemPrompt}</pre>}
            <p className="mt-2 text-[12.5px] font-semibold text-ink-2">It contains a fake secret on purpose, so a prompt-leak attack has something real to leak. The judge never sees it either.</p>
          </div>
        </>
      )}
      {!cfg && !msg && <div className="skeleton mt-3 h-7 w-64" />}
      {!cfg && msg && <div className="mt-2 text-[13px] font-semibold text-red-2">{msg.text}</div>}
    </Tile>
  );
}
