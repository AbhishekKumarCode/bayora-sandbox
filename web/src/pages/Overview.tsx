import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, ShieldAlert, Play } from "lucide-react";
import { useStore, useNow } from "@/lib/store";
import { deriveRuns, overallStats, isLive, fmtAgo, techniqueLabel, groupAttacks } from "@/lib/model";
import { Button, Card, Pill, Actor, Hash, cx } from "@/components/ui";
import { VerdictRing, VerdictStrip, TrendArea, HBar, Legend, VERDICT_COLOR } from "@/components/charts";
import type { VerifyResult } from "@/lib/api";

export function Overview() {
  const s = useStore();
  const now = useNow(1000);
  const runs = useMemo(() => deriveRuns(s.entries, now), [s.entries, now]);
  const stats = useMemo(() => overallStats(s.entries), [s.entries]);
  const live = isLive(s.entries, now);
  const latest = runs[0];
  const through = useMemo(() => groupAttacks(s.entries).filter((a) => a.verdict?.data.verdict === "passed_through").slice(-3).reverse(), [s.entries]);
  const trend = useMemo(() => [...runs].reverse().slice(-8), [runs]);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function doVerify() {
    setVerifying(true);
    try { setVerify(await s.verify()); } finally { setVerifying(false); }
  }

  const modelName = s.source === "demo" ? "the demo model" : s.mockMode ? "the mock model" : "the model under test";

  return (
    <div className="space-y-8">
      {/* Headline + ring */}
      <Card className="overflow-hidden p-0">
        <div className="grid items-center gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.08em] text-muted">
              Overview {live && <Pill tone="attack" dot>run in progress</Pill>}
            </div>
            <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight sm:text-[34px]">
              {latest ? (
                <>In the last run, <span className="text-attack">{latest.passed} of {latest.attacks.length}</span> attacks got through {modelName}.</>
              ) : (
                <>No runs yet against {modelName}.</>
              )}
            </h1>
            <p className="mt-2 text-[15px] text-muted">
              {latest ? `Run ${latest.index} · ${fmtAgo(latest.startedAt, now)} · ${latest.blocked} blocked, ${latest.ambiguous} unsure. ` : ""}
              {s.source === "demo" ? "You are looking at demo data." : "Live from the broker."}
            </p>
            {latest && (
              <div className="mt-4 flex items-center gap-3">
                <VerdictStrip size={14} gap={4} verdicts={latest.attacks.map((a) => a.error ? "error" : (a.verdict?.data.verdict ?? "pending"))} />
                <span className="text-[12px] text-muted">one square per attack, in order</span>
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              <Button to="/app/live"><Play size={15} /> Start a run</Button>
              {latest && <Button variant="secondary" to={`/app/runs/${latest.id}`}>Open the last run <ArrowRight size={15} /></Button>}
            </div>
          </div>
          {latest && (
            <div className="flex flex-col items-center gap-3 justify-self-center">
              <VerdictRing size={176} blocked={latest.blocked} passed={latest.passed} ambiguous={latest.ambiguous} pending={latest.pending} label={`${latest.catchRate}%`} sub="blocked" />
              <Legend items={[
                { color: VERDICT_COLOR.blocked, label: "Blocked", n: latest.blocked },
                { color: VERDICT_COLOR.ambiguous, label: "Unsure", n: latest.ambiguous },
                { color: VERDICT_COLOR.passed_through, label: "Got through", n: latest.passed },
              ]} />
            </div>
          )}
        </div>
      </Card>

      {s.error && <div className="rounded-[10px] border border-attack/30 bg-attack-soft px-4 py-2.5 text-[13px] text-attack">{s.error}</div>}

      {/* Three numbers */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Blocked overall" value={`${stats.catchRate}%`} explain={`${stats.blocked} of ${stats.judged} judged replies were refusals, across all runs.`}>
          <HBar value={stats.catchRate} className="mt-3" />
        </Metric>
        <Metric label="Got through" value={stats.passed} danger={stats.passed > 0} explain="Replies where the model did what the attacker asked. These are the problem.">
          <VerdictStrip className="mt-3" size={9} verdicts={Array.from({ length: stats.judged }, (_, i) => i < stats.passed ? "passed_through" : i < stats.passed + stats.ambiguous ? "ambiguous" : "blocked")} />
        </Metric>
        <Metric
          label="Record"
          value={verify == null ? "Unchecked" : verify.ok ? "Intact" : "Broken"}
          danger={!!verify && !verify.ok}
          explain={verify == null ? `${s.entries.length} hash-chained entries. Recompute to prove nothing was edited.` : verify.ok ? `All ${verify.count} entries match. Nothing was edited.` : `Entry ${verify.brokenAtSeq} was altered: ${verify.reason}.`}
        >
          <button onClick={doVerify} disabled={verifying} className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand hover:underline disabled:opacity-50">{verify && !verify.ok ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}{verifying ? "Checking…" : "Verify now"}</button>
        </Metric>
      </div>

      {/* Trend + techniques */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <Heading title="Blocked rate by run" sub="Is the model getting safer, or worse?" />
          <TrendArea points={trend.map((r) => r.catchRate)} labels={trend.map((r) => `Run ${r.index}`)} height={140} />
        </Card>
        <Card className="p-5">
          <Heading title="Weakest techniques" sub="Share of attacks blocked, per technique. Shortest bar is the biggest hole." />
          <div className="space-y-3">
            {[...stats.byTechnique].sort((a, b) => a.blocked / a.total - b.blocked / b.total).slice(0, 6).map((t) => {
              const pct = Math.round((t.blocked / t.total) * 100);
              return (
                <div key={t.technique} className="grid grid-cols-[150px_1fr_52px] items-center gap-3 text-[13px]">
                  <span className="truncate font-medium">{techniqueLabel(t.technique)}</span>
                  <HBar value={pct} color={pct >= 70 ? "var(--color-sealed)" : pct >= 40 ? "var(--color-pending)" : "var(--color-attack)"} />
                  <span className="tabular-nums text-right text-muted">{t.blocked}/{t.total}</span>
                </div>
              );
            })}
            {stats.byTechnique.length === 0 && <div className="text-[13px] text-muted">No attacks yet.</div>}
          </div>
        </Card>
      </div>

      {/* What got through */}
      <section>
        <Heading title="What got through" sub="The attacker's technique, and exactly what the model said back." />
        {through.length === 0 ? (
          <Card className="p-8 text-center text-[14px] text-muted">Nothing has got through yet.</Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-3">
            {through.map((a) => {
              const run = runs.find((r) => r.attacks.some((x) => x.attackId === a.attackId));
              return (
                <Card key={a.attackId} className="flex flex-col p-5 ring-1 ring-attack/15">
                  <div className="flex items-center gap-3">
                    <Actor kind="attacker" size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-semibold">{techniqueLabel(a.technique)}</div>
                      <div className="text-[12px] text-muted">{run ? `Run ${run.index}` : ""} · {fmtAgo(a.ts, now)}</div>
                    </div>
                  </div>
                  <p className="mono mt-4 flex-1 rounded-[10px] bg-canvas px-3 py-2 text-[12.5px] leading-relaxed text-ink">"{a.response?.data.responsePreview ?? "(no preview)"}"</p>
                  <p className="mt-3 text-[12.5px] text-ink-2"><span className="font-medium text-attack">Judge:</span> {a.verdict?.data.notes || "no notes"} <span className="text-muted">· {Math.round((a.verdict?.data.confidence ?? 0) * 100)}% sure</span></p>
                  {run && <Link to={`/app/runs/${run.id}`} className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:underline">See the full run <ArrowRight size={13} /></Link>}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Runs */}
      <section>
        <Heading title="Recent runs" sub="One row per burst of attacks." right={<Link to="/app/runs" className="text-[13px] font-medium text-brand hover:underline">All runs</Link>} />
        <Card>
          <div className="divide-y divide-line">
            {runs.slice(0, 5).map((r) => (
              <Link key={r.id} to={`/app/runs/${r.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-canvas">
                <div className="w-14 text-[14px] font-semibold">Run {r.index}</div>
                <VerdictStrip verdicts={r.attacks.map((a) => a.error ? "error" : (a.verdict?.data.verdict ?? "pending"))} />
                <div className="flex-1 text-[13px] text-muted">{r.attacks.length} attacks · {fmtAgo(r.startedAt, now)}</div>
                <div className={cx("text-[13.5px] font-medium", r.passed ? "text-attack" : "text-sealed")}>{r.passed ? `${r.passed} got through` : "all blocked"}</div>
                {r.live ? <Pill tone="attack" dot>live</Pill> : <Pill tone="sealed">sealed</Pill>}
              </Link>
            ))}
            {runs.length === 0 && <div className="px-5 py-10 text-center text-[13px] text-muted">No runs yet.</div>}
          </div>
        </Card>
      </section>

      {s.entries.length > 0 && (
        <p className="text-[12.5px] text-muted">
          The record has {s.entries.length} entries. Latest hash <Hash value={s.entries[s.entries.length - 1].hash} />. <Link to="/app/audit" className="font-medium text-brand hover:underline">Open the audit chain</Link>
        </p>
      )}
    </div>
  );
}

function Metric({ label, value, explain, danger, children }: { label: string; value: React.ReactNode; explain: string; danger?: boolean; children?: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted">{label}</div>
      <div className={cx("mt-2 text-[34px] font-semibold leading-none tracking-tight", danger ? "text-attack" : "text-ink")}>{value}</div>
      <p className="mt-3 text-[13px] leading-relaxed text-muted">{explain}</p>
      {children}
    </Card>
  );
}

export function Heading({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-[18px] font-semibold tracking-tight">{title}</h2>
        {sub && <p className="mt-0.5 text-[13.5px] text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
