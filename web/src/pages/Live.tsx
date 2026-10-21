import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Plug, RotateCcw, X } from "lucide-react";
import { useStore, useNow } from "@/lib/store";
import { groupAttacks, isLive, fmtAgo, deriveRuns } from "@/lib/model";
import { Button, Card, Pill, cx } from "@/components/ui";
import { AttackCard, AttackMiniCard } from "@/components/Timeline";
import { VerdictStrip } from "@/components/charts";
import { IsoSandbox, StageSteps } from "@/components/IsoSandbox";
import { ConnectDialog } from "@/components/ConnectDialog";

export function Live() {
  const s = useStore();
  const now = useNow(500);
  const live = isLive(s.entries, now);
  const attacks = useMemo(() => groupAttacks(s.entries), [s.entries]);
  const runs = useMemo(() => deriveRuns(s.entries, now), [s.entries, now]);
  const current = runs[0];
  const recent = attacks.slice(-6).reverse();
  const last = s.entries[s.entries.length - 1];
  const [msg, setMsg] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const seen = useRef(new Set(attacks.map((a) => a.attackId)));
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    const n = new Set<string>();
    for (const a of attacks) if (!seen.current.has(a.attackId)) { seen.current.add(a.attackId); n.add(a.attackId); }
    if (n.size) { setFresh(n); const id = setTimeout(() => setFresh(new Set()), 800); return () => clearTimeout(id); }
  }, [attacks]);

  const liveStage: "idle" | "model" | "judge" | "seal" = !live || !last ? "idle" : last.event === "attack_submitted" ? "model" : last.event === "llm_response_received" ? "judge" : "seal";
  const [replay, setReplay] = useState<"model" | "judge" | "seal" | null>(null);
  useEffect(() => {
    if (!replay) return;
    const next = replay === "model" ? "judge" : replay === "judge" ? "seal" : null;
    const id = setTimeout(() => setReplay(next), 1700);
    return () => clearTimeout(id);
  }, [replay]);
  const stage = liveStage !== "idle" ? liveStage : replay ?? "idle";
  const lastVerdict = [...s.entries].reverse().find((e) => e.event === "blue_team_verdict")?.data.verdict ?? null;
  const stageText = stage === "idle"
    ? (s.entries.length ? "Nothing is running right now." : "The record is empty. Start a run to watch the first attack travel through the rooms.")
    : stage === "model" ? "An attack is in the hallway, waiting for the model." : stage === "judge" ? "The reply is on its way to the blue room, which never sees the prompt." : "Verdict in. Sealing it into the ledger.";

  async function start() {
    setStarting(true); setMsg(null);
    try { const st = await s.triggerRun(); setMsg(st === "started" ? "Run started. Attacks appear below as they are sealed." : st); }
    catch (e) { setMsg(e instanceof Error ? e.message : String(e)); } finally { setStarting(false); }
  }
  const opened = open ? attacks.find((a) => a.attackId === open) : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="display text-[36px] sm:text-[44px]">Live run</h1><p className="mt-2 text-[14.5px] text-ink-2">Each attack goes red room → hallway → blue room → ledger. Watch it happen, then read the cards.</p></div>
        <div className="flex gap-3">
          {s.role !== "operator" && <Button onClick={() => setConnectOpen(true)}><Plug size={15} /> Unlock</Button>}
          {!live && <Button variant="ghost" onClick={() => setReplay("model")} disabled={!!replay}><RotateCcw size={14} /> Replay</Button>}
          <Button variant="primary" onClick={start} disabled={starting || s.role !== "operator" || live}><Play size={15} /> {starting ? "Starting…" : "Start a run"}</Button>
        </div>
      </div>
      {msg && <div className={cx("rounded-[12px] border border-line px-4 py-3 text-[13.5px] font-semibold rise", msg.startsWith("Run started") ? "bg-green" : "bg-amber")}>{msg}</div>}

      {/* The sandbox */}
      <Card className="relative overflow-hidden p-5 lg:p-7">
        <div className="grid-dots absolute inset-0" aria-hidden />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-[14px] font-semibold"><span className={cx("h-2.5 w-2.5 shrink-0 rounded-full", live ? "bg-red-2" : replay ? "bg-accent" : "bg-faint")} />{replay && liveStage === "idle" ? `Replay · ${stageText}` : stageText}</div>
            <div className="flex items-center gap-3 text-[12.5px] text-muted">{current && <><span>Run {current.index}</span><VerdictStrip size={10} gap={3} verdicts={current.attacks.map((a) => a.error ? "error" : (a.verdict?.data.verdict ?? "pending"))} /></>}{last && <span>last event {fmtAgo(last.ts, now)}</span>}</div>
          </div>
          <div className="mx-auto mt-2 max-w-[820px]"><IsoSandbox stage={stage} through={current?.passed ?? 0} total={current?.attacks.length ?? 0} model={s.source === "broker" ? s.modelName ?? undefined : undefined} lastVerdict={lastVerdict} /></div>
          <div className="mt-2 flex justify-center"><StageSteps stage={stage} /></div>
        </div>
      </Card>

      {/* Latest attacks as cards */}
      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div><h2 className="display text-[22px]">Latest attacks</h2><p className="mt-1 text-[13.5px] text-muted">Newest first. Click a card for the full exchange.</p></div>
          {s.mockMode && <Pill tone="amber">mock LLM</Pill>}
        </div>
        {recent.length === 0 ? (
          <Card flat className="p-10 text-center"><div className="display text-[18px]">No attacks yet</div><p className="mt-1 text-[13.5px] text-muted">{s.role === "operator" ? "Press Start a run." : "Ask the operator to start a run, or come back in a minute."}</p></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {recent.map((a) => <AttackMiniCard key={a.attackId} a={a} animate={fresh.has(a.attackId)} onOpen={() => setOpen(a.attackId)} />)}
          </div>
        )}
      </section>

      {opened && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setOpen(null)}>
          <div className="absolute inset-0 bg-ink/40" />
          <div className="relative w-full max-w-[860px] rise" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOpen(null)} aria-label="Close" className="absolute -top-3 -right-3 z-10 rounded-full border border-line bg-white p-1.5 shadow"><X size={16} /></button>
            <div className="max-h-[85vh] overflow-y-auto"><AttackCard a={opened} /></div>
          </div>
        </div>
      )}
      {connectOpen && <ConnectDialog onClose={() => setConnectOpen(false)} />}
    </div>
  );
}
