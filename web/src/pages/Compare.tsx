import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, GitCompare } from "lucide-react";
import { useStore } from "@/lib/store";
import { statsByModel, techniqueLabel, fmtAgo, type ModelStats } from "@/lib/model";
import { Card, Tile, Pill, Empty, Heading, Button, cx } from "@/components/ui";
import { VerdictRing, VerdictStrip, HBar, Cell, Legend, VERDICT_COLOR } from "@/components/charts";
import { useNow } from "@/lib/store";

/** Side-by-side results per model that answered, from the sealed record. */
export function Compare() {
  const s = useStore();
  const now = useNow(5000);
  const all = useMemo(() => statsByModel(s.entries), [s.entries]);
  const [picked, setPicked] = useState<string[]>([]);
  const chosen = picked.length ? all.filter((m) => picked.includes(m.model)) : all.slice(0, 2);
  const techniques = [...new Set(chosen.flatMap((m) => [...m.byTechnique.keys()]))];
  const toggle = (m: string) => setPicked((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m].slice(-3)));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-[36px] sm:text-[44px]">Compare models</h1>
          <p className="mt-2 text-[14.5px] font-semibold text-ink-2">Same attacks, same blind judge, same sealed record. Only the model differs. Pick up to three.</p>
        </div>
        {s.role === "operator" ? <Button variant="primary" to="/app/settings"><GitCompare size={15} /> Run two models back to back</Button> : <Pill tone="blue">operator login needed to run two models</Pill>}
      </div>

      {all.length < 2 ? (
        <Empty title={all.length === 0 ? "No model results yet" : `Only one model so far: ${all[0].model}`} desc={all.length === 0 ? "Run the suite against a model and it will appear here." : "Run the same suite against a second model to see them side by side. Operators: Settings → Test two models together."} action={s.role === "operator" ? <Button variant="primary" to="/app/settings">Run a second model</Button> : <Button to="/app/runs">See the runs</Button>} />
      ) : (
        <>
          {/* picker */}
          <div className="flex flex-wrap gap-2">
            {all.map((m) => {
              const on = chosen.some((c) => c.model === m.model);
              return (
                <button key={m.model} onClick={() => toggle(m.model)} className={cx("b-btn h-10 px-3 text-[13px]", on && "primary")}>
                  <span className="mono">{m.model}</span><span className={cx("ml-1 text-[11px]", on ? "opacity-80" : "text-muted")}>{m.catchRate}% blocked</span>
                </button>
              );
            })}
          </div>

          {/* summary tiles */}
          <div className={cx("grid gap-6", chosen.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
            {chosen.map((m) => <ModelTile key={m.model} m={m} now={now} />)}
          </div>

          {new Set(chosen.map((m) => m.attacks)).size > 1 && (
            <div role="note" className="rounded-[12px] border border-line bg-amber/30 px-4 py-3 text-[13px] font-semibold text-ink-2">
              Different sample sizes: {chosen.map((m) => `${m.model} was tested with ${m.attacks} attacks`).join(", ")}. Percentages are comparable, but a model with fewer attacks is a weaker signal.
            </div>
          )}

          {/* technique matrix */}
          <Card className="p-5">
            <Heading title="Where they differ" desc="One row per technique. A red cell means at least one attack of that technique got through on that model." right={<Legend items={[{ color: VERDICT_COLOR.blocked, label: "Blocked" }, { color: VERDICT_COLOR.ambiguous, label: "Unsure" }, { color: VERDICT_COLOR.passed_through, label: "Got through" }]} />} />
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr><th className="b-th py-2 pr-4 text-left">Technique</th>{chosen.map((m) => <th key={m.model} className="b-th px-3 py-2 text-left"><span className="mono block">{m.model}</span><span className="block text-[11px] font-normal">blocked / fired · {m.attacks} attacks</span></th>)}</tr></thead>
                <tbody>
                  {techniques.map((t) => (
                    <tr key={t} className="b-row">
                      <td className="py-2.5 pr-4 font-semibold">{techniqueLabel(t)}</td>
                      {chosen.map((m) => {
                        const hits = m.byTechnique.get(t) ?? [];
                        const v = hits.length ? (hits.some((a) => a.verdict?.data.verdict === "passed_through") ? "passed_through" : hits.some((a) => a.verdict?.data.verdict === "ambiguous") ? "ambiguous" : hits.every((a) => a.verdict) ? "blocked" : "pending") : undefined;
                        const blocked = hits.filter((a) => a.verdict?.data.verdict === "blocked").length;
                        return (
                          <td key={m.model} className="px-3 py-2.5">
                            <div className="flex items-center gap-2"><Cell v={v} title={hits.length ? `${blocked}/${hits.length} blocked` : "not fired"} /><span className="mono text-[12px] text-muted">{hits.length ? `${blocked}/${hits.length}` : "–"}</span></div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <p className="text-[12.5px] font-semibold text-ink-2">Every reply above is in the sealed record with the model name on it. <Link to="/app/audit" className="underline decoration-2 underline-offset-4">Open the audit chain</Link></p>
        </>
      )}
    </div>
  );
}

function ModelTile({ m, now }: { m: ModelStats; now: number }) {
  const tone = m.catchRate >= 70 ? "green" : m.catchRate >= 40 ? "amber" : "red";
  return (
    <Tile tone={tone} className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div><div className="display text-[20px]"><span className="mono">{m.model}</span></div><div className="label mt-1 text-muted">{m.attacks} attacks · last {fmtAgo(m.lastAt, now)}</div></div>
        <VerdictRing size={92} stroke={12} blocked={m.blocked} passed={m.passed} ambiguous={m.ambiguous} pending={m.attacks - m.judged} label={<span className="text-[18px]">{m.catchRate}%</span>} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[12.5px]">
        <div><div className="label text-muted">Blocked</div><div className="display text-[20px] text-green-2">{m.blocked}</div></div>
        <div><div className="label text-muted">Through</div><div className={cx("display text-[20px]", m.passed ? "text-red-2" : "")}>{m.passed}</div></div>
        <div><div className="label text-muted">Unsure</div><div className="display text-[20px] text-amber-2">{m.ambiguous}</div></div>
      </div>
      <HBar className="mt-3" value={m.catchRate} color={VERDICT_COLOR[tone === "green" ? "blocked" : tone === "amber" ? "ambiguous" : "passed_through"]} />
      <VerdictStrip className="mt-3" size={10} gap={3} verdicts={[...m.byTechnique.values()].flat().slice(-21).map((a) => a.verdict?.data.verdict ?? "pending")} />
      <Link to="/app/runs" className="label mt-3 inline-flex items-center gap-1 underline decoration-2 underline-offset-4">Runs <ArrowRight size={12} /></Link>
    </Tile>
  );
}
