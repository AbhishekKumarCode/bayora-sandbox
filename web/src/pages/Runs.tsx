import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useStore, useNow } from "@/lib/store";
import { deriveRuns, fmtDate, fmtTime, fmtDuration, fmtAgo } from "@/lib/model";
import { Card, Pill, Empty } from "@/components/ui";

export function Runs() {
  const s = useStore();
  const now = useNow(2000);
  const runs = useMemo(() => deriveRuns(s.entries, now), [s.entries, now]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight">Runs</h1>
        <p className="mt-1 text-[13.5px] text-muted">One row per burst of attacks. Open a run to read every attack, reply and verdict.</p>
      </div>

      {runs.length === 0 ? (
        <Empty title="No runs recorded" desc="Start a run from the Live page, or connect a broker that already has an audit log." />
      ) : (
        <Card>
          <div className="divide-y divide-line">
            {runs.map((r) => (
              <Link key={r.id} to={`/app/runs/${r.id}`} className="group flex items-center gap-4 px-5 py-4 hover:bg-canvas">
                <div className="w-16 text-[14px] font-semibold">Run {r.index}</div>
                <div className="flex-1">
                  <div className="text-[13.5px] text-ink">{r.attacks.length} attacks · {fmtDuration(r.startedAt, r.endedAt)}</div>
                  <div className="text-[12px] text-muted">{fmtDate(r.startedAt)} {fmtTime(r.startedAt)} · {fmtAgo(r.startedAt, now)}</div>
                </div>
                <div className={`text-[13.5px] font-medium ${r.passed ? "text-attack" : "text-sealed"}`}>{r.passed ? `${r.passed} got through` : "all blocked"}{r.ambiguous ? <span className="font-normal text-muted"> · {r.ambiguous} unsure</span> : null}</div>
                <div className="hidden sm:block">{r.live ? <Pill tone="attack" dot>live</Pill> : r.pending ? <Pill tone="pending" dot>judging</Pill> : <Pill tone="sealed">sealed</Pill>}</div>
                <ChevronRight size={16} className="text-faint group-hover:text-ink" />
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
