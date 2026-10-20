import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Plug } from "lucide-react";
import { useStore, useNow } from "@/lib/store";
import { groupAttacks, isLive, fmtAgo } from "@/lib/model";
import { Button, Card, Pill, Glow, Actor, cx } from "@/components/ui";
import { AttackCard } from "@/components/Timeline";
import { ConnectDialog } from "@/components/ConnectDialog";
import { Heading } from "./Overview";

export function Live() {
  const s = useStore();
  const now = useNow(500);
  const live = isLive(s.entries, now);
  const attacks = useMemo(() => groupAttacks(s.entries), [s.entries]);
  const recent = attacks.slice(-5).reverse();
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

  // which room is working right now
  const stage: "idle" | "model" | "judge" | "seal" =
    !live || !last ? "idle" : last.event === "attack_submitted" ? "model" : last.event === "llm_response_received" ? "judge" : "seal";
  const stageText = stage === "idle" ? "Idle. Nothing is running." : stage === "model" ? "An attack was just sent. Waiting for the model to reply." : stage === "judge" ? "The model replied. The blind judge is scoring it." : "Verdict sealed into the record. Next attack coming up.";

  async function start() {
    setStarting(true); setMsg(null);
    try { const st = await s.triggerRun(); setMsg(st === "started" ? "Run started. Attacks will appear below as the broker logs them." : st); }
    catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
    finally { setStarting(false); }
  }

  return (
    <div className="mx-auto max-w-[920px] space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight sm:text-[32px]">Live run</h1>
          <p className="mt-1.5 text-[14px] text-muted">Start a run and watch each attack move through the three rooms.</p>
        </div>
        <div className="flex gap-2">
          {s.source !== "broker" && <Button variant="secondary" onClick={() => setConnectOpen(true)}><Plug size={15} /> Connect broker</Button>}
          <Button onClick={start} disabled={starting || s.source !== "broker"}><Play size={15} /> {starting ? "Starting…" : "Start a run"}</Button>
        </div>
      </div>
      {s.source !== "broker" && <p className="-mt-4 text-[13px] text-muted">Starting a run needs a connected broker. Demo data is read-only.</p>}
      {msg && <div className={cx("rounded-[10px] px-4 py-2.5 text-[13px] rise", msg.startsWith("Run started") ? "bg-sealed-soft text-sealed" : "bg-pending-soft text-pending")}>{msg}</div>}

      {/* The three rooms */}
      <Card className="overflow-hidden p-0">
        <div className="relative px-6 py-9 sm:px-10">
          <Glow tone="attack" size={320} className={cx("left-[4%] top-1/2 -translate-y-1/2 transition-opacity duration-700", stage === "model" ? "opacity-60" : "opacity-0")} />
          <Glow tone="brand" size={320} className={cx("left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-700", stage === "judge" ? "opacity-60" : "opacity-0")} />
          <Glow tone="judge" size={320} className={cx("right-[4%] top-1/2 -translate-y-1/2 transition-opacity duration-700", stage === "seal" ? "opacity-60" : "opacity-0")} />
          <div className="relative grid grid-cols-3 items-start gap-2">
            <svg className="pointer-events-none absolute inset-x-0 top-[36px] h-2 w-full" aria-hidden>
              <line x1="22%" x2="44%" y1="4" y2="4" stroke="var(--color-attack)" strokeWidth="2" className={cx(live && "flow-line")} opacity={live ? 0.9 : 0.25} />
              <line x1="56%" x2="78%" y1="4" y2="4" stroke="var(--color-judge)" strokeWidth="2" className={cx(live && "flow-line")} opacity={live ? 0.9 : 0.25} />
            </svg>
            <Node kind="attacker" label="1 · Attacker" sub="sends a jailbreak prompt" hot={stage === "model"} />
            <Node kind="model" label="2 · Model" sub="replies, unaware it's a test" hot={stage === "judge"} />
            <Node kind="judge" label="3 · Blind judge" sub="scores the reply only" hot={stage === "seal"} />
          </div>
          <div className="relative mt-8 flex items-center gap-3 rounded-[12px] border border-line bg-white px-4 py-3 text-[13.5px]">
            <span className={cx("relative h-2.5 w-2.5 shrink-0 rounded-full", live ? "bg-attack pulse-ring text-attack" : "bg-faint")} />
            <span className="text-ink">{stageText}</span>
            <span className="ml-auto shrink-0 text-[12.5px] text-muted">{last ? `last event ${fmtAgo(last.ts, now)}` : "no events yet"}</span>
          </div>
        </div>
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
      <div className="text-[12px] text-muted">{sub}</div>
    </div>
  );
}
