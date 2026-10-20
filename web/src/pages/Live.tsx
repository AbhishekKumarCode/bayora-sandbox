import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Plug } from "lucide-react";
import { useStore, useNow } from "@/lib/store";
import { groupAttacks, isLive, fmtAgo, deriveRuns, techniqueLabel } from "@/lib/model";
import { Button, Card, Pill, Glow, Actor, cx } from "@/components/ui";
import { AttackCard } from "@/components/Timeline";
import { VerdictStrip, VERDICT_COLOR } from "@/components/charts";
import { ConnectDialog } from "@/components/ConnectDialog";
import { Heading } from "./Overview";

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

  const stage: "idle" | "model" | "judge" | "seal" =
    !live || !last ? "idle" : last.event === "attack_submitted" ? "model" : last.event === "llm_response_received" ? "judge" : "seal";
  const stageText = stage === "idle" ? "Idle. Nothing is running." : stage === "model" ? "An attack was just sent. Waiting for the model to reply." : stage === "judge" ? "The model replied. The blind judge is scoring it." : "Verdict sealed into the record. Next attack coming up.";
  const lastAttack = attacks[attacks.length - 1];

  async function start() {
    setStarting(true); setMsg(null);
    try { const st = await s.triggerRun(); setMsg(st === "started" ? "Run started. Attacks will appear below as the broker logs them." : st); }
    catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
    finally { setStarting(false); }
  }

  // verdict confidence bars for the current run
  const bars = (current?.attacks ?? []).map((a) => ({ id: a.attackId, t: techniqueLabel(a.technique), v: (a.verdict?.data.verdict ?? "pending") as "blocked" | "passed_through" | "ambiguous" | "pending", c: a.verdict?.data.confidence ?? 0 }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight sm:text-[32px]">Live run</h1>
          <p className="mt-1.5 text-[14px] text-muted">Start a run and watch each attack move through the three rooms.{s.source !== "broker" && " Starting one needs a connected broker; demo data is read-only."}</p>
        </div>
        <div className="flex gap-2">
          {s.source !== "broker" && <Button variant="secondary" onClick={() => setConnectOpen(true)}><Plug size={15} /> Connect broker</Button>}
          <Button onClick={start} disabled={starting || s.source !== "broker"}><Play size={15} /> {starting ? "Starting…" : "Start a run"}</Button>
        </div>
      </div>
      {msg && <div className={cx("rounded-[10px] px-4 py-2.5 text-[13px] rise", msg.startsWith("Run started") ? "bg-sealed-soft text-sealed" : "bg-pending-soft text-pending")}>{msg}</div>}

      {/* Pipeline */}
      <Card className="overflow-hidden p-0">
        <div className="relative px-6 pt-10 pb-6 sm:px-10">
          <div className="grid-paper absolute inset-0" aria-hidden />
          <Glow tone="attack" size={360} className={cx("left-[2%] top-[30%] -translate-y-1/2 transition-opacity duration-700", stage === "model" ? "opacity-70" : "opacity-15")} />
          <Glow tone="brand" size={360} className={cx("left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-700", stage === "judge" ? "opacity-70" : "opacity-15")} />
          <Glow tone="judge" size={360} className={cx("right-[2%] top-[30%] -translate-y-1/2 transition-opacity duration-700", stage === "seal" ? "opacity-70" : "opacity-15")} />

          <div className="relative grid grid-cols-3 items-start gap-2">
            <svg className="pointer-events-none absolute inset-x-0 top-[36px] h-3 w-full overflow-visible" aria-hidden>
              <line x1="22%" x2="44%" y1="4" y2="4" stroke="var(--color-attack)" strokeWidth="2" className={cx(live && "flow-line")} opacity={live ? 0.9 : 0.25} />
              <line x1="56%" x2="78%" y1="4" y2="4" stroke="var(--color-judge)" strokeWidth="2" className={cx(live && "flow-line")} opacity={live ? 0.9 : 0.25} />
              {stage === "model" && <circle r="5" cy="4" fill="var(--color-attack)" className="packet-a" />}
              {stage === "judge" && <circle r="5" cy="4" fill="var(--color-judge)" className="packet-b" />}
            </svg>
            <Node kind="attacker" label="1 · Attacker" sub={stage === "model" && lastAttack ? techniqueLabel(lastAttack.technique) : "sends a jailbreak prompt"} hot={stage === "model"} />
            <Node kind="model" label="2 · Model" sub={stage === "judge" ? "replied" : "replies, unaware it's a test"} hot={stage === "judge"} />
            <Node kind="judge" label="3 · Blind judge" sub={stage === "seal" ? "sealed the verdict" : "scores the reply only"} hot={stage === "seal"} />
          </div>

          <div className="relative mt-8 flex items-center gap-3 rounded-[12px] border border-line bg-white px-4 py-3 text-[13.5px]">
            <span className={cx("relative h-2.5 w-2.5 shrink-0 rounded-full", live ? "bg-attack pulse-ring text-attack" : "bg-faint")} />
            <span className="text-ink">{stageText}</span>
            <span className="ml-auto shrink-0 text-[12.5px] text-muted">{last ? `last event ${fmtAgo(last.ts, now)}` : "no events yet"}</span>
          </div>
        </div>

        {/* Current run progress */}
        {current && (
          <div className="border-t border-line px-6 py-5 sm:px-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-[13.5px]"><span className="font-semibold">Run {current.index}</span> <span className="text-muted">· {current.attacks.length} attacks · {current.blocked} blocked · <span className={current.passed ? "text-attack" : ""}>{current.passed} got through</span>{current.pending ? ` · ${current.pending} judging` : ""}</span></div>
              <VerdictStrip size={14} gap={4} verdicts={current.attacks.map((a) => a.error ? "error" : (a.verdict?.data.verdict ?? "pending"))} />
            </div>
            <div className="mt-4 grid gap-2">
              {bars.map((b) => (
                <div key={b.id} className="grid grid-cols-[160px_1fr_60px] items-center gap-3 text-[12.5px]">
                  <span className="truncate font-medium">{b.t}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-canvas">
                    <div className="h-full rounded-full" style={{ width: `${b.v === "pending" ? 0 : b.c * 100}%`, background: VERDICT_COLOR[b.v], transition: "width .6s cubic-bezier(.16,1,.3,1)" }} />
                  </div>
                  <span className={cx("text-right tabular-nums", b.v === "passed_through" ? "text-attack" : b.v === "blocked" ? "text-sealed" : "text-muted")}>{b.v === "pending" ? "…" : `${Math.round(b.c * 100)}%`}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[11.5px] text-faint">Bar length is how sure the judge was. Colour is the verdict.</div>
          </div>
        )}
      </Card>

      <section>
        <Heading title="Latest attacks" sub="Newest first. Each card is one attack: sent, replied, judged." right={s.source === "demo" ? <Pill tone="brand">demo</Pill> : s.mockMode ? <Pill tone="pending">mock LLM</Pill> : undefined} />
        <div className="space-y-3">
          {recent.map((a) => <AttackCard key={a.attackId} a={a} animate={fresh.has(a.attackId)} />)}
          {recent.length === 0 && <Card className="p-8 text-center text-[13px] text-muted">No attacks yet.</Card>}
        </div>
      </section>

      {connectOpen && <ConnectDialog onClose={() => setConnectOpen(false)} />}
    </div>
  );
}

function Node({ kind, label, sub, hot }: { kind: "attacker" | "model" | "judge"; label: string; sub: string; hot: boolean }) {
  return (
    <div className="relative flex flex-col items-center text-center">
      <div className={cx("relative rounded-[18px] bg-white p-2 shadow-[0_1px_2px_rgb(17_19_24/0.06),0_0_0_1px_rgb(17_19_24/0.05)] transition-transform duration-500", hot && "scale-110")}>
        <Actor kind={kind} size={56} />
        {hot && <span className={cx("absolute inset-0 rounded-[18px] pulse-ring", kind === "attacker" ? "text-attack" : kind === "model" ? "text-brand" : "text-judge")} />}
      </div>
      <div className="mt-3 text-[13.5px] font-semibold">{label}</div>
      <div className={cx("text-[12px]", hot ? "font-medium text-ink" : "text-muted")}>{sub}</div>
    </div>
  );
}
