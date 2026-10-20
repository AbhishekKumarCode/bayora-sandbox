import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Radio, Plug } from "lucide-react";
import { useStore, useNow } from "@/lib/store";
import { groupAttacks, isLive, fmtAgo, techniqueLabel, verdictLabel } from "@/lib/model";
import { Button, Card, Pill, Glow, Actor, cx, verdictTone } from "@/components/ui";
import { AttackTrio } from "@/components/Timeline";
import { ConnectDialog } from "@/components/ConnectDialog";

export function Live() {
  const s = useStore();
  const now = useNow(500);
  const live = isLive(s.entries, now);
  const attacks = useMemo(() => groupAttacks(s.entries), [s.entries]);
  const recent = attacks.slice(-8).reverse();
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

  // which stage is hot right now
  const stage: "idle" | "model" | "judge" | "seal" =
    !live || !last ? "idle" : last.event === "attack_submitted" ? "model" : last.event === "llm_response_received" ? "judge" : "seal";

  async function start() {
    setStarting(true); setMsg(null);
    try { const st = await s.triggerRun(); setMsg(st === "started" ? "Run started. Attacks will land below as the broker logs them." : st); }
    catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
    finally { setStarting(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight">Live run</h1>
          <p className="mt-1 text-[13.5px] text-muted">Watch attacks move through the rooms as the broker records them. Polling every 2s.</p>
        </div>
        <div className="flex gap-2">
          {s.source !== "broker" && <Button variant="secondary" onClick={() => setConnectOpen(true)}><Plug size={15} /> Connect broker</Button>}
          <Button onClick={start} disabled={starting || s.source !== "broker"}><Play size={15} /> {starting ? "Starting…" : "Start a run"}</Button>
        </div>
      </div>
      {msg && <div className={cx("rounded-[10px] px-4 py-2.5 text-[13px] rise", msg.startsWith("Run started") ? "bg-sealed-soft text-sealed" : "bg-pending-soft text-pending")}>{msg}</div>}

      {/* Pipeline stage */}
      <Card className="overflow-hidden p-0">
        <div className="relative px-6 py-10 sm:px-10">
          <div className="grid-paper absolute inset-0" aria-hidden />
          <Glow tone="attack" size={360} className={cx("left-[6%] top-1/2 -translate-y-1/2 transition-opacity duration-700", stage === "model" ? "opacity-70" : "opacity-20")} />
          <Glow tone="brand" size={360} className={cx("left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-700", stage === "judge" ? "opacity-70" : "opacity-25")} />
          <Glow tone="judge" size={360} className={cx("right-[6%] top-1/2 -translate-y-1/2 transition-opacity duration-700", stage === "seal" ? "opacity-70" : "opacity-20")} />

          <div className="relative grid grid-cols-3 items-center gap-2">
            <svg className="pointer-events-none absolute inset-x-0 top-[36px] h-2 w-full" aria-hidden>
              <line x1="22%" x2="44%" y1="4" y2="4" stroke="var(--color-attack)" strokeWidth="2" className={cx(live && "flow-line")} opacity={live ? 0.9 : 0.3} />
              <line x1="56%" x2="78%" y1="4" y2="4" stroke="var(--color-judge)" strokeWidth="2" className={cx(live && "flow-line")} opacity={live ? 0.9 : 0.3} />
            </svg>
            <Node kind="attacker" label="Red room" sub="fires attacks" hot={stage === "model"} />
            <Node kind="model" label="Model" sub="under test" hot={stage === "judge"} />
            <Node kind="judge" label="Blue room" sub="judges blind" hot={stage === "seal"} />
          </div>

          <div className="relative mt-8 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-line bg-white/80 px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-2 text-[13px]">
              <span className={cx("relative h-2.5 w-2.5 rounded-full", live ? "bg-attack pulse-ring text-attack" : "bg-faint")} />
              <span className="font-semibold">{live ? "Run in progress" : "Idle"}</span>
              <span className="text-muted">{last ? `· last event ${fmtAgo(last.ts, now)}` : "· waiting for first event"}</span>
            </div>
            <div className="flex items-center gap-2 text-[12.5px] text-muted">
              <Actor kind="seal" size={20} />
              {s.entries.length} sealed entries
              {s.source === "demo" && <Pill tone="brand">demo</Pill>}
              {s.mockMode && s.source === "broker" && <Pill tone="pending">mock LLM</Pill>}
            </div>
          </div>
        </div>
      </Card>

      {/* Event stream */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-[17px] font-semibold tracking-tight">Event stream</h2>
          <Card className="p-2">
            <div className="divide-y divide-line">
              {recent.map((a) => <AttackTrio key={a.attackId} a={a} animate={fresh.has(a.attackId)} defaultOpen={fresh.has(a.attackId)} />)}
              {recent.length === 0 && <div className="py-10 text-center text-[13px] text-muted">No events yet.</div>}
            </div>
          </Card>
        </div>
        <aside className="space-y-4">
          <Card className="p-5" glow="judge">
            <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted">Latest verdict</div>
            {(() => {
              const v = [...s.entries].reverse().find((e) => e.event === "blue_team_verdict");
              if (!v) return <div className="mt-2 text-[13px] text-muted">None yet.</div>;
              const a = attacks.find((x) => x.attackId === v.data.attackId);
              return (
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <Actor kind="judge" size={28} />
                    <span className="text-[15px] font-semibold">{verdictLabel(v.data.verdict)}</span>
                    <Pill tone={verdictTone(v.data.verdict)} className="ml-auto">{Math.round((v.data.confidence ?? 0) * 100)}%</Pill>
                  </div>
                  <div className="mt-2 text-[13px] text-ink-2">{v.data.notes}</div>
                  {a && <div className="mt-2 text-[12px] text-muted">on {techniqueLabel(a.technique)} · {fmtAgo(v.ts, now)}</div>}
                </div>
              );
            })()}
          </Card>
          <Card className="p-5">
            <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted">Isolation</div>
            <ul className="mt-2 space-y-1.5 text-[13px] text-ink-2">
              <li>Red room → broker only, on <code className="mono">red-net</code></li>
              <li>Blue room → broker only, on <code className="mono">blue-net</code></li>
              <li>No shared network between rooms</li>
              <li>Judge receives reply text only</li>
            </ul>
          </Card>
        </aside>
      </div>

      {connectOpen && <ConnectDialog onClose={() => setConnectOpen(false)} />}
      <Radio className="hidden" />
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
