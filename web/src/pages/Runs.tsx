import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useStore, useNow } from "@/lib/store";
import { deriveRuns, fmtDate, fmtTime, fmtDuration, fmtAgo } from "@/lib/model";
import { Card, Pill, Hash, Empty } from "@/components/ui";

export function Runs() {
  const s = useStore();
  const now = useNow(2000);
  const runs = useMemo(() => deriveRuns(s.entries, now), [s.entries, now]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight">Runs</h1>
        <p className="mt-1 text-[13.5px] text-muted">Each run is a burst of attacks against the model, judged blind and sealed into the audit chain.</p>
      </div>

      {runs.length === 0 ? (
        <Empty title="No runs recorded" desc="Start a run from the Live page, or connect a broker that already has an audit log." />
      ) : (
        <Card>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[11.5px] uppercase tracking-[0.08em] text-muted">
                <th className="px-5 py-3 font-medium">Run</th>
                <th className="px-3 py-3 font-medium">Started</th>
                <th className="px-3 py-3 font-medium">Attacks</th>
                <th className="hidden px-3 py-3 font-medium md:table-cell">Outcome</th>
                <th className="px-3 py-3 font-medium">Catch rate</th>
                <th className="hidden px-3 py-3 font-medium lg:table-cell">Duration</th>
                <th className="hidden px-3 py-3 font-medium lg:table-cell">Seal</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {runs.map((r) => (
                <tr key={r.id} className="group hover:bg-canvas">
                  <td className="px-5 py-3.5 font-semibold"><Link to={`/app/runs/${r.id}`} className="block">Run {r.index}</Link></td>
                  <td className="px-3 py-3.5 text-ink-2">{fmtDate(r.startedAt)} <span className="text-muted">{fmtTime(r.startedAt)}</span><div className="text-[11.5px] text-faint">{fmtAgo(r.startedAt, now)}</div></td>
                  <td className="px-3 py-3.5 tabular-nums">{r.attacks.length}</td>
                  <td className="hidden px-3 py-3.5 md:table-cell">
                    <div className="flex items-center gap-1.5 text-[12px]">
                      <span className="rounded-full bg-sealed-soft px-2 py-0.5 text-sealed">{r.blocked} blocked</span>
                      {r.passed > 0 && <span className="rounded-full bg-attack-soft px-2 py-0.5 text-attack">{r.passed} through</span>}
                      {r.ambiguous > 0 && <span className="rounded-full bg-pending-soft px-2 py-0.5 text-pending">{r.ambiguous} unsure</span>}
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="w-10 font-semibold tabular-nums">{r.catchRate}%</span>
                      <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-canvas sm:flex">
                        <span className="bg-sealed" style={{ width: `${(r.blocked / r.attacks.length) * 100}%` }} />
                        <span className="bg-pending" style={{ width: `${(r.ambiguous / r.attacks.length) * 100}%` }} />
                        <span className="bg-attack" style={{ width: `${(r.passed / r.attacks.length) * 100}%` }} />
                      </span>
                    </div>
                  </td>
                  <td className="hidden px-3 py-3.5 tabular-nums text-ink-2 lg:table-cell">{fmtDuration(r.startedAt, r.endedAt)}</td>
                  <td className="hidden px-3 py-3.5 lg:table-cell"><Hash value={r.attacks[r.attacks.length - 1].seal?.hash ?? ""} /></td>
                  <td className="px-3 py-3.5">{r.live ? <Pill tone="attack" dot>Live</Pill> : r.pending ? <Pill tone="pending" dot>Pending</Pill> : <Pill tone="sealed">Sealed</Pill>}</td>
                  <td className="pr-4"><Link to={`/app/runs/${r.id}`} aria-label="Open run"><ChevronRight size={16} className="text-faint group-hover:text-ink" /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
