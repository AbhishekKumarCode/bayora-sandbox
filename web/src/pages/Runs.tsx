import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useStore, useNow } from "@/lib/store";
import { deriveRuns, fmtDate, fmtTime, fmtDuration, fmtAgo, techniqueLabel } from "@/lib/model";
import { Card, Tile, Pill, Empty, Hash, Heading, cx } from "@/components/ui";
import { VerdictRing, VerdictStrip, TrendArea, Legend, VERDICT_COLOR } from "@/components/charts";

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
          <h1 className="display text-[36px] sm:text-[44px]">Runs</h1>
          <p className="mt-2 text-[14.5px] font-semibold text-ink-2">{runs.length} runs · {totals.attacks} attacks · <span className={totals.passed ? "text-red-2" : "text-green-2"}>{totals.passed} got through</span></p>
        </div>
        <Legend items={[{ color: VERDICT_COLOR.blocked, label: "Blocked" }, { color: VERDICT_COLOR.ambiguous, label: "Unsure" }, { color: VERDICT_COLOR.passed_through, label: "Got through" }]} />
      </div>

      {runs.length === 0 ? <Empty title="No runs recorded" desc="Start a run from the Live page, or connect a broker that already has an audit log." /> : (
        <>
          {runs.length >= 2 && <Card className="p-5"><Heading title="Blocked rate over time" desc="Oldest on the left." /><TrendArea points={trend.map((r) => r.catchRate)} labels={trend.map((r) => `Run ${r.index}`)} subLabels={trend.map((r) => `${r.blocked + r.passed + r.ambiguous} judged`)} caption="Share of judged attacks the model blocked in each run." height={130} /></Card>}
          <div className="grid gap-7 md:grid-cols-2 xl:grid-cols-3">
            {runs.map((r) => {
              const worst = r.attacks.filter((a) => a.verdict?.data.verdict === "passed_through").map((a) => techniqueLabel(a.technique));
              return (
                <Link key={r.id} to={`/app/runs/${r.id}`} className="block">
                  <Tile tone={r.passed ? "red" : "green"} className="flex h-full flex-col p-5 transition-transform hover:-translate-x-[2px] hover:-translate-y-[2px]">
                    <div className="flex items-start justify-between gap-3">
                      <div><div className="display text-[22px]">Run {r.index}</div><div className="label mt-1 text-muted">{fmtDate(r.startedAt)} {fmtTime(r.startedAt)} · {fmtAgo(r.startedAt, now)}</div></div>
                      {r.live ? <Pill tone="red" dot>live</Pill> : r.pending ? <Pill tone="amber" dot>judging</Pill> : <Pill tone="green">sealed</Pill>}
                    </div>
                    <div className="mt-4 flex items-center gap-5">
                      <VerdictRing size={100} stroke={14} blocked={r.blocked} passed={r.passed} ambiguous={r.ambiguous} pending={r.pending} label={<span className="text-[20px]">{r.catchRate}%</span>} />
                      <div className="min-w-0 flex-1 space-y-1.5 text-[13px] font-semibold">
                        <div className="flex justify-between"><span className="text-muted">Attacks</span><span className="mono">{r.attacks.length}</span></div>
                        <div className="flex justify-between"><span className="text-muted">Got through</span><span className={cx("mono", r.passed ? "text-red-2" : "text-green-2")}>{r.passed}</span></div>
                        <div className="flex justify-between"><span className="text-muted">Took</span><span className="mono">{fmtDuration(r.startedAt, r.endedAt)}</span></div>
                      </div>
                    </div>
                    <VerdictStrip className="mt-4" size={13} gap={4} verdicts={r.attacks.map((a) => a.error ? "error" : (a.verdict?.data.verdict ?? "pending"))} />
                    <div className="mt-3 min-h-[18px] text-[12.5px] font-semibold">{worst.length ? <><span className="text-red-2">Weak to:</span> {worst.join(", ")}</> : <span className="text-green-2">Every attack was blocked.</span>}</div>
                    <div className="mt-4 flex items-center justify-between border-t border-line pt-3"><span className="label text-muted">seal <Hash value={r.attacks[r.attacks.length - 1].seal?.hash ?? ""} /></span><span className="label flex items-center gap-1">Open <ArrowRight size={12} /></span></div>
                  </Tile>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
