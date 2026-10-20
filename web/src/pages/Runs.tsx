import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useStore, useNow } from "@/lib/store";
import { deriveRuns, fmtDate, fmtTime, fmtDuration, fmtAgo, techniqueLabel } from "@/lib/model";
import { Card, Pill, Empty, Hash, cx } from "@/components/ui";
import { VerdictRing, VerdictStrip, TrendArea, Legend, VERDICT_COLOR } from "@/components/charts";
import { Heading } from "./Overview";

export function Runs() {
  const s = useStore();
  const now = useNow(2000);
  const runs = useMemo(() => deriveRuns(s.entries, now), [s.entries, now]);
  const trend = [...runs].reverse();
  const totals = runs.reduce((acc, r) => ({ attacks: acc.attacks + r.attacks.length, passed: acc.passed + r.passed }), { attacks: 0, passed: 0 });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight sm:text-[32px]">Runs</h1>
          <p className="mt-1.5 text-[14px] text-muted">{runs.length} runs · {totals.attacks} attacks · <span className={totals.passed ? "text-attack" : "text-sealed"}>{totals.passed} got through</span>. Open a run to read every attack, reply and verdict.</p>
        </div>
        <Legend items={[
          { color: VERDICT_COLOR.blocked, label: "Blocked" },
          { color: VERDICT_COLOR.ambiguous, label: "Unsure" },
          { color: VERDICT_COLOR.passed_through, label: "Got through" },
        ]} />
      </div>

      {runs.length === 0 ? (
        <Empty title="No runs recorded" desc="Start a run from the Live page, or connect a broker that already has an audit log." />
      ) : (
        <>
          <Card className="p-5">
            <Heading title="Blocked rate over time" sub="Each dot is one run, oldest on the left." />
            <TrendArea points={trend.map((r) => r.catchRate)} labels={trend.map((r) => `Run ${r.index}`)} height={120} />
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {runs.map((r) => {
              const worst = r.attacks.filter((a) => a.verdict?.data.verdict === "passed_through").map((a) => techniqueLabel(a.technique));
              return (
                <Link key={r.id} to={`/app/runs/${r.id}`} className="card group flex flex-col p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_rgb(17_19_24/0.25)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[16px] font-semibold">Run {r.index}</div>
                      <div className="mt-0.5 text-[12.5px] text-muted">{fmtDate(r.startedAt)} {fmtTime(r.startedAt)} · {fmtAgo(r.startedAt, now)}</div>
                    </div>
                    {r.live ? <Pill tone="attack" dot>live</Pill> : r.pending ? <Pill tone="pending" dot>judging</Pill> : <Pill tone="sealed">sealed</Pill>}
                  </div>
                  <div className="mt-4 flex items-center gap-5">
                    <VerdictRing size={92} stroke={10} blocked={r.blocked} passed={r.passed} ambiguous={r.ambiguous} pending={r.pending} label={<span className="text-[18px]">{r.catchRate}%</span>} />
                    <div className="min-w-0 flex-1 space-y-1.5 text-[13px]">
                      <div className="flex justify-between"><span className="text-muted">Attacks</span><span className="font-medium tabular-nums">{r.attacks.length}</span></div>
                      <div className="flex justify-between"><span className="text-muted">Got through</span><span className={cx("font-medium tabular-nums", r.passed ? "text-attack" : "text-sealed")}>{r.passed}</span></div>
                      <div className="flex justify-between"><span className="text-muted">Took</span><span className="font-medium tabular-nums">{fmtDuration(r.startedAt, r.endedAt)}</span></div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <VerdictStrip size={12} gap={4} verdicts={r.attacks.map((a) => a.error ? "error" : (a.verdict?.data.verdict ?? "pending"))} />
                  </div>
                  <div className="mt-3 min-h-[18px] text-[12.5px] text-ink-2">
                    {worst.length ? <><span className="font-medium text-attack">Weak to:</span> {worst.join(", ")}</> : <span className="text-sealed">Every attack was blocked.</span>}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[12px] text-muted">
                    <span>seal <Hash value={r.attacks[r.attacks.length - 1].seal?.hash ?? ""} /></span>
                    <span className="flex items-center gap-1 font-medium text-brand group-hover:underline">Open <ArrowRight size={12} /></span>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
