import { useEffect, useState } from "react";
import { getAudit, type AuditEntry } from "../lib/api";
import { computeStats } from "../lib/stats";
import { Card, PageHead } from "../components/ui";
import { useCountUp } from "../lib/useCountUp";

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  const match = value.match(/^-?\d+/);
  const animated = useCountUp(match ? parseInt(match[0], 10) : 0);
  const suffix = match ? value.slice(match[0].length) : value;
  return (
    <Card>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-display mt-1.5 text-[28px] font-semibold leading-none tabular-nums">
        {match ? animated : ""}
        {suffix}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{sub}</p>
    </Card>
  );
}

// NOTE: there is no durable run-history storage yet (see docs/PRD.md,
// Open Questions #2) — the broker only keeps one continuous audit log, not
// separate named "runs". This page shows the current session's totals
// honestly, rather than pretending to have a run-by-run history we haven't
// built.
export default function History() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    function poll() {
      getAudit()
        .then(({ entries }) => {
          if (!cancelled) setEntries(entries);
        })
        .catch(() => {});
    }
    poll();
    const id = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const stats = computeStats(entries);
  const hasData = entries.length > 0;

  return (
    <div className="flex flex-col gap-6 stagger">
      <PageHead
        title="History"
        sub="Totals for this session's notebook — run history is on the roadmap (see the PRD); right now everything lives in one continuous log, not separate named runs."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Kpi label="Total attacks" value={String(stats.attacksTested)} sub="this session" />
        <Kpi label="Catch rate" value={`${stats.catchRate}%`} sub="the real number" />
        <Kpi label="Illustrative leaky rate" value={`${stats.illustrativeLeakyRate}%`} sub="the flattering number" />
      </div>

      {!hasData && (
        <Card className="py-16 text-center">
          <p className="text-sm text-muted-foreground mb-3">No runs yet.</p>
          <a
            href="/"
            className="inline-block font-display font-semibold text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            Start your first run
          </a>
        </Card>
      )}
    </div>
  );
}
