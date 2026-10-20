import { useEffect, useState } from "react";
import { getAudit, verifyChain, type AuditEntry, type VerifyResult } from "../lib/api";
import { roomOf } from "../lib/stats";
import ActivityFeed from "../components/ActivityFeed";

const roomCounterLabels: Record<ReturnType<typeof roomOf>, string> = {
  attacker: "🎯 Attacker",
  model: "🤖 Model",
  defender: "🛡️ Defender",
  hallway: "🚪 Hallway",
};

export default function Notebook() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [tamperArmed, setTamperArmed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const { entries } = await getAudit();
        if (!cancelled) setEntries(entries);
      } catch {
        // surfaced elsewhere; this page can just show what it has
      }
    }
    poll();
    const id = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function handleVerify() {
    setChecking(true);
    try {
      const tamperSeq = tamperArmed && entries.length > 0 ? entries[Math.floor(entries.length / 2)].seq : undefined;
      const res = await verifyChain(tamperSeq);
      setResult(res);
    } finally {
      setChecking(false);
    }
  }

  const counts = (Object.keys(roomCounterLabels) as (keyof typeof roomCounterLabels)[]).reduce(
    (acc, room) => {
      acc[room] = entries.filter((e) => roomOf(e.event) === room).length;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display font-bold text-2xl tracking-tight">Notebook</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-xl">
          Each line is sealed with a fingerprint of the line before it. Change one word, and Verify
          points straight at the altered line — recomputed server-side, not just displayed.
        </p>
      </div>

      <div className="bg-card border border-border rounded-card card-shadow p-5 flex flex-col gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setTamperArmed((t) => !t)}
            className={`text-sm font-medium px-4 py-1.5 rounded-lg border transition-colors ${
              tamperArmed
                ? "bg-destructive/10 border-destructive/40 text-destructive"
                : "bg-secondary border-border text-foreground hover:bg-accent"
            }`}
          >
            {tamperArmed ? "Tamper armed — will simulate on next Verify" : "Tamper"}
          </button>
          <button
            onClick={handleVerify}
            disabled={checking}
            className="font-display font-semibold text-sm bg-primary text-primary-foreground px-4 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {checking ? "Checking…" : "Verify"}
          </button>
          <span className="text-xs text-muted-foreground">
            Tamper never touches the real log — it's a safe, in-memory simulation.
          </span>
        </div>

        {entries.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
              Chain — each link's hash depends on the one before it
            </div>
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {entries.slice(-24).map((e) => {
                const isBroken = !!result && !result.ok && e.seq === result.brokenAtSeq;
                return (
                  <div
                    key={e.seq}
                    title={`seq ${e.seq} · ${e.hash.slice(0, 12)}…`}
                    className={`shrink-0 font-mono text-[10px] px-2 py-1 rounded border transition-colors ${
                      isBroken
                        ? "bg-destructive/10 border-destructive text-destructive animate-pulse"
                        : "bg-secondary border-border text-muted-foreground"
                    }`}
                  >
                    {e.hash.slice(0, 6)}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {result && (
          <div
            className={`text-sm rounded-card px-4 py-3 border ${
              result.ok
                ? "bg-caught-soft border-caught/30 text-caught"
                : "bg-destructive/10 border-destructive/30 text-destructive"
            }`}
          >
            {result.ok
              ? `✓ Chain verified — ${result.count} entries intact, recomputed server-side.`
              : `✗ Chain broken at seq=${result.brokenAtSeq} — ${result.reason}.`}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(roomCounterLabels) as (keyof typeof roomCounterLabels)[]).map((room) => (
          <div key={room} className="bg-card border border-border rounded-card px-4 py-3">
            <div className="text-xs text-muted-foreground">{roomCounterLabels[room]}</div>
            <div className="font-display font-bold text-xl mt-1">{counts[room] ?? 0}</div>
          </div>
        ))}
      </div>

      <ActivityFeed entries={entries} />
    </div>
  );
}
