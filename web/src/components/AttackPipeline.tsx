import { useEffect, useRef, useState } from "react";
import type { AuditEntry } from "../lib/api";

type Pulse = { id: number; stage: "attacker" | "model" | "defender"; kind?: "caught" | "leak" | "unsure" };

const STAGES: { key: "attacker" | "model" | "defender"; emoji: string; label: string }[] = [
  { key: "attacker", emoji: "🎯", label: "Attacker" },
  { key: "model", emoji: "🤖", label: "Model" },
  { key: "defender", emoji: "🛡️", label: "Defender" },
];

// Watches new audit entries arrive and animates a pulse through the three
// rooms live — this is what makes a running demo actually visible, instead
// of judges having to read a log line to understand what's happening.
export default function AttackPipeline({ entries }: { entries: AuditEntry[] }) {
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [flash, setFlash] = useState<"caught" | "leak" | "unsure" | null>(null);
  const seenSeq = useRef<number>(0);
  const idCounter = useRef(0);

  useEffect(() => {
    if (entries.length === 0) return;
    const fresh = entries.filter((e) => e.seq > seenSeq.current);
    seenSeq.current = entries[entries.length - 1].seq;
    if (seenSeq.current === 0 && fresh.length === entries.length && entries.length > 3) {
      // first load with a big backlog — don't replay the whole history at once
      return;
    }

    for (const entry of fresh) {
      let stage: Pulse["stage"] | null = null;
      let kind: Pulse["kind"];
      if (entry.event === "attack_submitted") stage = "attacker";
      else if (entry.event === "llm_response_received" || entry.event === "llm_error") stage = "model";
      else if (entry.event === "blue_team_verdict") {
        stage = "defender";
        const v = String(entry.data.verdict);
        kind = v === "blocked" ? "caught" : v === "passed_through" ? "leak" : "unsure";
      }
      if (!stage) continue;

      const id = ++idCounter.current;
      setPulses((p) => [...p.slice(-5), { id, stage, kind }]);
      setTimeout(() => setPulses((p) => p.filter((x) => x.id !== id)), 1400);

      if (kind) {
        setFlash(kind);
        setTimeout(() => setFlash((f) => (f === kind ? null : f)), 1200);
      }
    }
  }, [entries]);

  return (
    <div className="bg-card border border-border rounded-card card-shadow p-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display font-semibold text-sm">Live pipeline</h2>
        <span className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-caught opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-caught" />
          </span>
          watching
        </span>
      </div>

      <div className="relative flex items-center justify-between px-2">
        <div className="absolute left-[10%] right-[10%] top-1/2 -translate-y-1/2 h-px bg-border" />
        {STAGES.map((stage, i) => {
          const active = pulses.some((p) => p.stage === stage.key);
          const isDefender = stage.key === "defender";
          const ring =
            isDefender && flash === "caught"
              ? "ring-4 ring-caught/30 border-caught"
              : isDefender && flash === "leak"
              ? "ring-4 ring-leak/30 border-leak animate-pulse"
              : active
              ? "ring-4 ring-primary/15 border-primary/40 scale-110"
              : "border-border";
          return (
            <div key={stage.key} className="relative z-10 flex flex-col items-center gap-2 flex-1">
              <div
                className={`w-14 h-14 rounded-full bg-card border-2 grid place-items-center text-2xl transition-all duration-300 ${ring}`}
              >
                {stage.emoji}
              </div>
              <span className="text-xs font-medium text-muted-foreground">{stage.label}</span>
              {isDefender && flash && (
                <span
                  className={`absolute -top-6 text-[11px] font-display font-bold px-2 py-0.5 rounded-full animate-bounce ${
                    flash === "caught"
                      ? "bg-caught-soft text-caught"
                      : flash === "leak"
                      ? "bg-leak-soft text-leak"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {flash === "caught" ? "Caught!" : flash === "leak" ? "Got through" : "Unsure"}
                </span>
              )}
              {i < STAGES.length - 1 && null}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground text-center mt-4">
        Every dot above is a real event from the broker's audit log, polled every 2s — nothing here is canned.
      </p>
    </div>
  );
}
