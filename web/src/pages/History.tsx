import { useEffect, useState } from "react";
import { getAudit, type AuditEntry } from "../lib/api";
import { computeStats } from "../lib/stats";
import StatCard from "../components/StatCard";

// NOTE: there is no durable run-history storage yet (see docs/PRD.md,
// Open Questions #2) — the broker only keeps one continuous audit log, not
// separate named "runs". This page shows the current session's totals
// honestly, rather than pretending to have a run-by-run history we haven't
// built.
export default function History() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    getAudit()
      .then(({ entries }) => setEntries(entries))
      .catch(() => {});
  }, []);

  const stats = computeStats(entries);
  const hasData = entries.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display font-bold text-2xl tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-xl">
          Totals for this session's notebook, newest-first run history is on the roadmap (see the
          PRD) — right now everything lives in one continuous log, not separate named runs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="Total attacks" value={stats.attacksTested} caption="this session" />
        <StatCard label="Catch rate" value={`${stats.catchRate}%`} tone="caught" caption="the real number" />
        <StatCard
          label="Illustrative leaky rate"
          value={`${stats.illustrativeLeakyRate}%`}
          tone="leak"
          caption="the flattering number"
        />
      </div>

      {!hasData && (
        <div className="bg-card border border-border rounded-card card-shadow p-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">No runs yet.</p>
          <a
            href="/"
            className="inline-block font-display font-semibold text-sm bg-primary text-primary-foreground px-4 py-1.5 rounded-lg hover:opacity-90"
          >
            Start your first run
          </a>
        </div>
      )}
    </div>
  );
}
