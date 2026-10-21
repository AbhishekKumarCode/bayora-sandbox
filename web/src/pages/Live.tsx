import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Plug, RotateCcw } from "lucide-react";
import { useStore, useNow } from "@/lib/store";
import { groupAttacks, isLive, fmtAgo, deriveRuns, techniqueLabel } from "@/lib/model";
import { Button, Card, Pill, Heading, cx } from "@/components/ui";
import { AttackCard } from "@/components/Timeline";
import { VerdictStrip, VERDICT_COLOR } from "@/components/charts";
import { IsoSandbox, StageSteps } from "@/components/IsoSandbox";
import { ConnectDialog } from "@/components/ConnectDialog";

export function Live() {
  const s = useStore();
  const now = useNow(500);
  const live = isLive(s.entries, now);
  const attacks = useMemo(() => groupAttacks(s.entries), [s.entries]);
  const runs = useMemo(() => deriveRuns(s.entries, now), [s.entries, now]);
  const current = runs[0];
  const recent = attacks.slice(-4).reverse();
  const last = s.entries[s.entries.length - 1];
  const [msg, setMsg] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const seen = useRef(new Set(attacks.map((a) => a.attackId)));
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    const n = new Set<string>();
    for (const a of attacks) if (!seen.current.has(a.attackId)) { seen.current.add(a.attackId); n.add(a.attackId); }
    if (n.size) { setFresh(n); const id = setTimeout(() => setFresh(new Set()), 800); return () => clearTimeout(id); }
  }, [attacks]);
  const liveStage: "idle" | "model" | "judge" | "seal" = !live || !last ? "idle" : last.event === "attack_submitted" ? "model" : last.event === "llm_response_received" ? "judge" : "seal";
  // Replay: when nothing is running, play the three steps once so a visitor can see the path.
  const [replay, setReplay] = useState<"model" | "judge" | "seal" | null>(null);
  useEffect(() => {
    if (!replay) return;
    const next = replay === "model" ? "judge" : replay === "judge" ? "seal" : null;
    const id = setTimeout(() => setReplay(next), 1500);
    return () => clearTimeout(id);
  }, [replay]);
  const stage = liveStage !== "idle" ? liveStage : replay ?? "idle";
  const lastVerdict = [...s.entries].reverse().find((e) => e.event === "blue_team_verdict")?.data.verdict ?? null;
  const stageText = stage === "idle" ? "Idle. Start a run to watch an attack travel through the rooms." : stage === "model" ? "Step 1: an attack is in the hallway, waiting for the model to reply." : stage === "judge" ? "Step 2: the reply is on its way to the blue room, which never sees the prompt." : "Step 3: verdict in. Sealing it into the ledger.";
  async function start() {
    setStarting(true); setMsg(null);
    try { const st = await s.triggerRun(); setMsg(st === "started" ? "Run started. The red container is firing; attacks appear below as they are sealed." : st); }
    catch (e) { setMsg(e instanceof Error ? e.message : String(e)); } finally { setStarting(false); }
  }
  const bars = (current?.attacks ?? []).map((a) => ({ id: a.attackId, t: techniqueLabel(a.technique), v: (a.verdict?.data.verdict ?? "pending") as "blocked" | "passed_through" | "ambiguous" | "pending", c: a.verdict?.data.confidence ?? 0 }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="display text-[36px] sm:text-[44px]">Live run</h1><p className="mt-2 text-[14.5px] font-semibold text-ink-2">Watch each attack move through the rooms.{s.role !== "operator" && " Starting one needs the operator token; visitors can watch."}</p></div>
        <div className="flex gap-3">{s.role !== "operator" && <Button onClick={() => setConnectOpen(true)}><Plug size={15} /> Unlock</Button>}<Button variant="primary" onClick={start} disabled={starting || s.role !== "operator"}><Play size={15} strokeWidth={2.5} /> {starting ? "Starting…" : "Start a run"}</Button></div>
      </div>
      {msg && <div className={cx("border border-line px-4 py-3 text-[13.5px] font-semibold rise", msg.startsWith("Run started") ? "bg-green" : "bg-amber")}>{msg}</div>}

      <Card className="relative overflow-hidden p-0">
        <div className="grid-dots absolute inset-0" aria-hidden />
        <div className="relative grid gap-4 p-5 lg:grid-cols-[1.4fr_1fr] lg:p-7">
          <div><IsoSandbox stage={stage} through={current?.passed ?? 0} total={current?.attacks.length ?? 0} model={s.source === "broker" ? s.modelName ?? undefined : undefined} lastVerdict={lastVerdict} /><div className="mt-3"><StageSteps stage={stage} /></div></div>
          <div className="flex flex-col justify-center gap-4">
            <div className="b-inset flex items-center gap-3 px-4 py-3 text-[14px] font-semibold"><span className={cx("h-3 w-3 shrink-0 rounded-full", live ? "bg-red-2" : replay ? "bg-accent" : "bg-faint")} /><span>{replay && liveStage === "idle" ? `Replay · ${stageText}` : stageText}</span></div>
            {!live && <Button size="sm" variant="ghost" onClick={() => setReplay("model")} disabled={!!replay} className="self-start"><RotateCcw size={14} /> Replay last attack</Button>}
            <div className="label text-muted">{last ? `last event ${fmtAgo(last.ts, now)}` : "no events yet"}</div>
            {current && (
              <div className="b-inset p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="display text-[15px]">Run {current.index}</span><VerdictStrip size={12} gap={3} verdicts={current.attacks.map((a) => a.error ? "error" : (a.verdict?.data.verdict ?? "pending"))} /></div>
                <div className="mt-3 space-y-2">
                  {bars.map((b) => (
                    <div key={b.id} className="grid grid-cols-[130px_1fr_44px] items-center gap-2 text-[12px] font-bold">
                      <span className="truncate">{b.t}</span>
                      <div className="h-3 border border-line bg-white"><div className="h-full" style={{ width: `${b.v === "pending" ? 0 : b.c * 100}%`, background: VERDICT_COLOR[b.v], transition: "width .4s" }} /></div>
                      <span className={cx("mono text-right", b.v === "passed_through" ? "text-red-2" : b.v === "blocked" ? "text-green-2" : "text-muted")}>{b.v === "pending" ? "…" : `${Math.round(b.c * 100)}%`}</span>
                    </div>
                  ))}
                </div>
                <div className="label mt-2 text-muted">bar = judge confidence · colour = verdict</div>
              </div>
            )}
          </div>
        </div>
      </Card>

      <section>
        <Heading title="Latest attacks" desc="Newest first." right={s.source === "demo" ? <Pill tone="amber">demo</Pill> : s.mockMode ? <Pill tone="amber">mock LLM</Pill> : undefined} />
        <div className="space-y-6">{recent.map((a) => <AttackCard key={a.attackId} a={a} animate={fresh.has(a.attackId)} />)}{recent.length === 0 && <Card flat className="p-8 text-center text-[13px] font-semibold">No attacks yet.</Card>}</div>
      </section>
      {connectOpen && <ConnectDialog onClose={() => setConnectOpen(false)} />}
    </div>
  );
}
