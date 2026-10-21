import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, ShieldAlert, Play } from "lucide-react";
import { useStore, useNow } from "@/lib/store";
import { deriveRuns, overallStats, isLive, fmtAgo, techniqueLabel, groupAttacks } from "@/lib/model";
import { Button, Card, Tile, Pill, Actor, Hash, Stamp, Heading, cx } from "@/components/ui";
import { VerdictRing, VerdictStrip, TrendArea, HBar, Legend, VERDICT_COLOR } from "@/components/charts";
import { IsoSandbox } from "@/components/IsoSandbox";
import type { VerifyResult } from "@/lib/api";

export function Overview() {
  const s = useStore();
  const now = useNow(1000);
  const runs = useMemo(() => deriveRuns(s.entries, now), [s.entries, now]);
  const stats = useMemo(() => overallStats(s.entries), [s.entries]);
  const live = isLive(s.entries, now);
  const latest = runs[0];
  const last = s.entries[s.entries.length - 1];
  const stage = !live || !last ? "idle" : last.event === "attack_submitted" ? "model" : last.event === "llm_response_received" ? "judge" : "seal";
  const through = useMemo(() => groupAttacks(s.entries).filter((a) => a.verdict?.data.verdict === "passed_through").slice(-3).reverse(), [s.entries]);
  const trend = useMemo(() => [...runs].reverse().slice(-8), [runs]);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  async function doVerify() { setVerifying(true); try { setVerify(await s.verify()); } finally { setVerifying(false); } }
  const modelName = s.source === "demo" ? "the demo model" : s.mockMode ? "the mock model" : s.modelName ?? "the model under test";

  return (
    <div className="space-y-10">
      {/* Headline + isometric model */}
      <div className="grid gap-6 lg:grid-cols-12 lg:items-stretch">
        <Card className="p-6 sm:p-8 lg:col-span-7">
          <div className="flex items-center gap-2">
            <span className="label text-muted">Overview</span>
            {live && <Pill tone="red" dot>run in progress</Pill>}
            {s.source === "demo" && <Pill tone="amber">demo data</Pill>}
          </div>
          <h1 className="display mt-3 text-[34px] sm:text-[44px]" style={{ textWrap: "balance" }}>
            {latest ? <>In the last run, <span className="text-red-2">{latest.passed} of {latest.attacks.length}</span> attacks got through {modelName}.</> : <>No runs yet against {modelName}.</>}
          </h1>
          <p className="mt-3 text-[15px] text-ink-2">{latest ? `Run ${latest.index} · ${fmtAgo(latest.startedAt, now)} · ${latest.blocked} blocked, ${latest.ambiguous} unsure.` : "Start a run to attack it."}</p>
          {latest && <div className="mt-5 flex items-center gap-3"><VerdictStrip size={16} verdicts={latest.attacks.map((a) => a.error ? "error" : (a.verdict?.data.verdict ?? "pending"))} /><span className="label text-muted">one block per attack</span></div>}
          <div className="mt-7 flex flex-wrap gap-3">
            <Button variant="primary" to="/app/live"><Play size={16} strokeWidth={2.5} /> Start a run</Button>
            {latest && <Button to={`/app/runs/${latest.id}`}>Open the last run <ArrowRight size={16} strokeWidth={2.5} /></Button>}
          </div>
        </Card>
        <Card className="relative overflow-hidden p-4 lg:col-span-5">
          <div className="grid-dots absolute inset-0" aria-hidden />
          <div className="relative">
            <div className="flex items-center justify-between"><span className="label">The sandbox</span><span className="label text-muted">{stage === "idle" ? "idle" : stage === "model" ? "attack in flight" : stage === "judge" ? "judging" : "sealing"}</span></div>
            <IsoSandbox stage={stage} through={latest?.passed ?? 0} total={latest?.attacks.length ?? 0} model={s.source === "broker" ? s.modelName ?? undefined : undefined} compact lastVerdict={last?.event === "blue_team_verdict" ? last.data.verdict ?? null : null} />
          </div>
        </Card>
      </div>

      {s.error && <div className="border border-line bg-red px-4 py-3 text-[13.5px] font-semibold text-white">{s.error}</div>}

      {/* Three tiles */}
      <div className="grid gap-6 sm:grid-cols-3">
        <Tile tone="green" className="p-5">
          <div className="label text-muted">Blocked overall</div>
          <div className="display mt-2 text-[44px]">{stats.catchRate}%</div>
          <p className="mt-2 text-[13px] text-ink-2">{stats.blocked} of {stats.judged} judged replies were refusals.</p>
          <HBar value={stats.catchRate} className="mt-3" />
        </Tile>
        <Tile tone="red" className="p-5">
          <div className="label text-muted">Got through</div>
          <div className={cx("display mt-2 text-[44px]", stats.passed > 0 && "text-red-2")}>{stats.passed}</div>
          <p className="mt-2 text-[13px] text-ink-2">Replies where the model did what the attacker asked.</p>
          <VerdictStrip className="mt-3" size={11} gap={3} verdicts={Array.from({ length: stats.judged }, (_, i) => i < stats.passed ? "passed_through" : i < stats.passed + stats.ambiguous ? "ambiguous" : "blocked")} />
        </Tile>
        <Tile tone={verify && !verify.ok ? "red" : "yellow"} className="p-5">
          <div className="label text-muted">Record</div>
          <div className="mt-2 flex items-center gap-3">
            <span className="display text-[44px]">{verify == null ? "?" : verify.ok ? "OK" : "BAD"}</span>
            {verify && <Stamp tone={verify.ok ? "green" : "red"} animate>{verify.ok ? "intact" : "broken"}</Stamp>}
          </div>
          <p className="mt-2 text-[13px] text-ink-2">{verify == null ? `${s.entries.length} hash-chained entries. Recompute to prove nothing was edited.` : verify.ok ? `All ${verify.count} entries match.` : `Entry ${verify.brokenAtSeq} was altered: ${verify.reason}.`}</p>
          <button onClick={doVerify} disabled={verifying} className="label mt-3 inline-flex items-center gap-1.5 underline decoration-2 underline-offset-4 disabled:opacity-50">{verify && !verify.ok ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}{verifying ? "Checking…" : "Verify now"}</button>
        </Tile>
      </div>

      {/* Ring + trend + weakest */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="flex flex-col items-center p-5">
          <div className="label self-start">Last run</div>
          {latest ? <><VerdictRing size={190} blocked={latest.blocked} passed={latest.passed} ambiguous={latest.ambiguous} pending={latest.pending} label={`${latest.catchRate}%`} sub="blocked" /><Legend className="mt-3" items={[{ color: VERDICT_COLOR.blocked, label: "Blocked", n: latest.blocked }, { color: VERDICT_COLOR.ambiguous, label: "Unsure", n: latest.ambiguous }, { color: VERDICT_COLOR.passed_through, label: "Through", n: latest.passed }]} /></> : <div className="py-10 text-[13px] text-muted">No runs yet.</div>}
        </Card>
        <Card className="p-5">
          <Heading title="Blocked rate by run" desc="Is the model getting safer, or worse?" />
          <TrendArea points={trend.map((r) => r.catchRate)} labels={trend.map((r) => `R${r.index}`)} height={150} />
        </Card>
        <Card className="p-5">
          <Heading title="Weakest techniques" desc="Shortest bar is the biggest hole." />
          <div className="space-y-3">
            {[...stats.byTechnique].sort((a, b) => a.blocked / a.total - b.blocked / b.total).slice(0, 6).map((t) => {
              const pct = Math.round((t.blocked / t.total) * 100);
              return (
                <div key={t.technique} className="grid grid-cols-[1fr_40px] items-center gap-3">
                  <div><div className="flex justify-between text-[12.5px] font-bold"><span className="truncate">{techniqueLabel(t.technique)}</span><span className="mono text-muted">{t.blocked}/{t.total}</span></div><HBar className="mt-1" value={pct} height={10} color={pct >= 70 ? VERDICT_COLOR.blocked : pct >= 40 ? VERDICT_COLOR.ambiguous : VERDICT_COLOR.passed_through} /></div>
                  <span className="mono text-right text-[12px] font-bold">{pct}%</span>
                </div>
              );
            })}
            {stats.byTechnique.length === 0 && <div className="text-[13px] text-muted">No attacks yet.</div>}
          </div>
        </Card>
      </div>

      {/* What got through */}
      <section>
        <Heading title="What got through" desc="The attacker's technique, and exactly what the model said back." />
        {through.length === 0 ? <Card flat className="p-8 text-center text-[14px] font-semibold">Nothing has got through yet.</Card> : (
          <div className="grid gap-6 lg:grid-cols-3">
            {through.map((a) => {
              const run = runs.find((r) => r.attacks.some((x) => x.attackId === a.attackId));
              return (
                <Tile key={a.attackId} tone="red" className="flex flex-col p-5">
                  <div className="flex items-center gap-3">
                    <Actor kind="attacker" size={34} />
                    <div className="min-w-0 flex-1"><div className="display truncate text-[16px]">{techniqueLabel(a.technique)}</div><div className="label text-muted">{run ? `Run ${run.index}` : ""} · {fmtAgo(a.ts, now)}</div></div>
                  </div>
                  <p className="mono mt-4 flex-1 border border-line bg-white p-3 text-[12px] leading-relaxed">"{a.response?.data.response ?? a.response?.data.responsePreview ?? "(no reply recorded)"}"</p>
                  <p className="mt-3 text-[12.5px]"><span className="display text-red-2">Judge:</span> {a.verdict?.data.notes || "no notes"} <span className="mono text-muted">· {Math.round((a.verdict?.data.confidence ?? 0) * 100)}%</span></p>
                  {run && <Link to={`/app/runs/${run.id}`} className="label mt-3 inline-flex items-center gap-1 underline decoration-2 underline-offset-4">See the full run <ArrowRight size={13} /></Link>}
                </Tile>
              );
            })}
          </div>
        )}
      </section>

      {/* Runs */}
      <section>
        <Heading title="Recent runs" desc="One row per burst of attacks." right={<Link to="/app/runs" className="label underline decoration-2 underline-offset-4">All runs</Link>} />
        <Card className="p-0">
          {runs.slice(0, 5).map((r) => (
            <Link key={r.id} to={`/app/runs/${r.id}`} className="b-row flex items-center gap-4 px-5 py-4 hover:bg-white/60">
              <div className="display w-16 text-[16px]">Run {r.index}</div>
              <VerdictStrip size={12} gap={3} verdicts={r.attacks.map((a) => a.error ? "error" : (a.verdict?.data.verdict ?? "pending"))} />
              <div className="flex-1 text-[13px] font-semibold text-ink-2">{r.attacks.length} attacks · {fmtAgo(r.startedAt, now)}</div>
              <div className={cx("display text-[14px]", r.passed ? "text-red-2" : "text-green-2")}>{r.passed ? `${r.passed} got through` : "all blocked"}</div>
              {r.live ? <Pill tone="red" dot>live</Pill> : <Pill tone="green">sealed</Pill>}
            </Link>
          ))}
          {runs.length === 0 && <div className="px-5 py-10 text-center text-[13px] text-muted">No runs yet.</div>}
        </Card>
      </section>

      {s.entries.length > 0 && <p className="text-[12.5px] font-semibold text-ink-2">The record has {s.entries.length} entries. Latest hash <Hash value={s.entries[s.entries.length - 1].hash} />. <Link to="/app/audit" className="underline decoration-2 underline-offset-4">Open the audit chain</Link></p>}
    </div>
  );
}
