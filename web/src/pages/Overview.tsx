import { useEffect, useState } from "react";
import { getAudit, type AuditEntry } from "../lib/api";
import { computeStats } from "../lib/stats";
import StatCard from "../components/StatCard";
import TrustSwitch from "../components/TrustSwitch";
import ActivityFeed from "../components/ActivityFeed";
import RoomCard from "../components/RoomCard";
import AttackPipeline from "../components/AttackPipeline";

export default function Overview() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const { entries } = await getAudit();
        if (!cancelled) {
          setEntries(entries);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "could not reach broker");
      }
    }
    poll();
    const id = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const stats = computeStats(entries);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display font-bold text-2xl tracking-tight">Is your AI actually safe?</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-xl">
          The attacker and the defender are kept apart, so the grading isn't rigged. Every exchange
          is written to a notebook nobody can quietly edit.
        </p>
      </div>

      {error && (
        <div className="border border-destructive/40 bg-destructive/5 text-destructive text-sm rounded-card px-4 py-3">
          Can't reach the broker right now — is it running? ({error})
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr] gap-4">
        <TrustSwitch realCatchRate={stats.catchRate} illustrativeLeakyRate={stats.illustrativeLeakyRate} />

        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Attacks tried" value={stats.attacksTested} caption="this run" />
          <StatCard
            label="Caught"
            value={stats.caught}
            tone="caught"
            caption={`${stats.gotThrough} got through · ${stats.unsure} unsure`}
          />
          <StatCard label="Catch rate" value={`${stats.catchRate}%`} tone="defender" />
          <StatCard
            label="Verdicts so far"
            value={`${stats.verdictsSoFar} / ${stats.attacksTested}`}
            caption="scored"
          />
        </div>
      </div>

      <AttackPipeline entries={entries} />

      <ActivityFeed entries={entries} limit={8} />

      <div>
        <h2 className="font-display font-semibold text-sm mb-3">The three rooms</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <RoomCard
            emoji="🎯"
            title="Attacker room"
            description="Invents tricky prompts to trip up the model."
            agentLabel="Red-team agent v4"
            tone="attacker"
          />
          <RoomCard
            emoji="🤖"
            title="Model under test"
            description="Answers whatever it's given."
            agentLabel="Subject model v1"
            tone="default"
          />
          <RoomCard
            emoji="🛡️"
            title="Defender room"
            description="Judges answers as safe or not — never sees the question."
            agentLabel="Safety judge v2"
            tone="defender"
          />
        </div>
      </div>
    </div>
  );
}
