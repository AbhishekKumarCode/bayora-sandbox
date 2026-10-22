import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, ShieldAlert, Play, Lock } from "lucide-react";
import { useStore, useNow } from "@/lib/store";
import { deriveRuns, overallStats, isLive, fmtAgo, fmtTime, fmtDate, fmtDuration, techniqueLabel, groupAttacks } from "@/lib/model";
import { Button, Card, Tile, Pill, Actor, Hash, Heading, Leak, Empty, cx } from "@/components/ui";
import { VerdictStrip, TrendArea, HBar, VERDICT_COLOR } from "@/components/charts";
import { ConnectDialog } from "@/components/ConnectDialog";
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
  const [connectOpen, setConnectOpen] = useState(false);
  async function doVerify() { setVerifying(true); try { setVerify(await s.verify()); } finally { setVerifying(false); } }
  const modelName = s.mockMode ? "the mock model" : s.modelName ?? "the model under test";
  const latestModel = latest?.attacks.find((a) => a.response?.data.model)?.response?.data.model ?? s.modelName;

  if (s.source !== "broker") {
    return <Empty title="Not connected to a broker" desc="The dashboard reads the sealed record from a running broker. Connect one to see live results." action={<Button variant="primary" onClick={() => setConnectOpen(true)}>Connect broker</Button>} />;
  }

  return (
    <div className="space-y-10">
      {/* Headline */}
      <Card className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="label">Overview</span>
          {live && <Pill tone="red" dot>run in progress</Pill>}
        </div>
        <h1 className="display mt-3 text-[34px] sm:text-[44px]" style={{ textWrap: "balance" }}>
          {latest ? <>In the last run, <span className="text-red-2">{latest.passed} of {latest.attacks.length}</span> attacks got through <span className="mono">{latestModel ?? modelName}</span>.</> : <>No runs yet against {modelName}.</>}
        </h1>
        <p className="mt-3 text-[15px] text-ink-2">{latest ? `Run ${latest.index} · started ${fmtDate(latest.startedAt)} ${fmtTime(latest.startedAt)} · took ${fmtDuration(latest.startedAt, latest.endedAt)} · ${latest.blocked} blocked, ${latest.ambiguous} unsure.` : "Start a run to attack it."}</p>
        {latest && <div className="mt-5 flex items-center gap-3"><VerdictStrip size={16} verdicts={latest.attacks.map((a) => a.error ? "error" : (a.verdict?.data.verdict ?? "pending"))} /><span className="text-[12.5px] text-muted">one block per attack, in order</span></div>}
        <div className="mt-7 flex flex-wrap gap-3">
          {latest && <Button variant="secondary" to={`/app/runs/${latest.id}`}>Open the last run <ArrowRight size={16} /></Button>}
          {s.canRun
            ? <Button variant="primary" to="/app/live"><Play size={16} /> Start a run</Button>
            : <Button variant="ghost" disabled title="Visitors cannot start runs on this broker"><Lock size={14} /> Start a run</Button>}
          <Button variant="ghost" to="/app/live">Watch the live view</Button>
        </div>
      </Card>

      {s.error && <div className="rounded-[12px] border border-line bg-red px-4 py-3 text-[13.5px] font-semibold text-white">{s.error}</div>}

      {/* Four facts */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile tone="violet" className="p-5"><div className="label">Model under test</div><div className="mono mt-2 break-all text-[20px] font-bold">{s.mockMode ? "mock" : s.modelName ?? "…"}</div><p className="mt-2 text-[12.5px] text-muted">Every reply records which model answered.</p></Tile>
        <Tile tone="blue" className="p-5"><div className="label">Blind judge</div><div className="mono mt-2 break-all text-[20px] font-bold">{s.judgeModel ?? "…"}</div><p className="mt-2 text-[12.5px] text-muted">Sees only the reply, never the prompt.</p></Tile>
        <Tile tone={stats.judged === 0 ? "ink" : stats.catchRate >= 70 ? "green" : stats.catchRate >= 40 ? "amber" : "red"} className="p-5"><div className="label">Blocked across all runs</div><div className={cx("display mt-2 text-[34px]", stats.judged > 0 && stats.catchRate < 40 && "text-red-2")}>{stats.judged ? `${stats.catchRate}%` : "–"}</div><p className="mt-2 text-[12.5px] text-muted">{stats.blocked} blocked, {stats.passed} through, {stats.ambiguous} unsure of {stats.judged} judged.</p></Tile>
        <Tile tone={verify && !verify.ok ? "red" : verify?.ok ? "green" : "ink"} className="p-5">
          <div className="label">Record</div>
          <div className="display mt-2 text-[34px]">{verify == null ? s.entries.length : verify.ok ? "Intact" : "Broken"}</div>
          <p className="mt-2 text-[12.5px] text-muted">{verify == null ? "hash-chained entries · not yet verified" : verify.ok ? `All ${verify.count} entries match.` : `Entry ${verify.brokenAtSeq}: ${verify.reason}.`}</p>
          <div className="mt-2 flex gap-3"><button onClick={doVerify} disabled={verifying} className="label inline-flex items-center gap-1.5 text-ink underline decoration-2 underline-offset-4 disabled:opacity-50">{verify && !verify.ok ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}{verifying ? "Checking…" : "Verify now"}</button><Link to="/app/audit" className="label underline decoration-2 underline-offset-4">Open the chain</Link></div>
        </Tile>
      </div>

      {/* Runs */}
      <section>
        <Heading title="Runs" desc="One row per burst of attacks. Newest first." right={<Link to="/app/runs" className="label underline decoration-2 underline-offset-4">All runs</Link>} />
        <Card className="p-0">
          {runs.slice(0, 5).map((r) => {
            const m = r.attacks.find((a) => a.response?.data.model)?.response?.data.model;
            return (
              <Link key={r.id} to={`/app/runs/${r.id}`} className="b-row flex flex-col gap-2 px-5 py-3.5 hover:bg-white/60 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex items-center gap-3">
                  <span className="display w-14 text-[16px]">Run {r.index}</span>
                  <VerdictStrip size={12} gap={3} verdicts={r.attacks.map((a) => a.error ? "error" : (a.verdict?.data.verdict ?? "pending"))} />
                  <span className="ml-auto sm:hidden">{r.live ? <Pill tone="red" dot>live</Pill> : <Pill tone="green">sealed</Pill>}</span>
                </div>
                <div className="min-w-0 flex-1 text-[13px] text-ink-2"><span className="mono font-semibold text-ink">{m ?? "model"}</span> · {r.attacks.length} attacks · {fmtDate(r.startedAt)} {fmtTime(r.startedAt)}</div>
                <div className={cx("text-[13.5px] font-semibold", r.passed ? "text-red-2" : "text-green-2")}>{r.passed ? `${r.passed} got through` : "all blocked"}</div>
                <span className="hidden sm:inline">{r.live ? <Pill tone="red" dot>live</Pill> : <Pill tone="green">sealed</Pill>}</span>
              </Link>
            );
          })}
          {runs.length === 0 && <div className="px-5 py-10 text-center text-[13px] text-muted">No runs yet.</div>}
        </Card>
      </section>

      {/* What got through */}
      <section>
        <Heading title="What got through" desc="The judge's reason first, then the reply. Secrets from the system prompt are marked." />
        {through.length === 0 ? <Card flat className="p-8 text-center text-[14px] font-semibold">Nothing has got through yet.</Card> : (
          <div className="grid gap-6 lg:grid-cols-3">
            {through.map((a) => {
              const run = runs.find((r) => r.attacks.some((x) => x.attackId === a.attackId));
              return (
                <Tile key={a.attackId} tone="red" className="flex flex-col p-5">
                  <div className="flex items-center gap-3">
                    <Actor kind="attacker" size={32} />
                    <div className="min-w-0 flex-1"><div className="display truncate text-[16px]">{techniqueLabel(a.technique)}</div><div className="text-[12px] text-muted">{run ? `Run ${run.index}` : ""} · {fmtTime(a.ts)} · <span className="mono">{a.response?.data.model ?? ""}</span></div></div>
                  </div>
                  <p className="mt-3 text-[13px]"><span className="font-semibold text-red-2">Judge:</span> <Leak text={(a.verdict?.data.notes || "no notes").replace(/^llm judge \([^)]*\): /, "")} markers={s.secretMarkers} /> <span className="text-muted">· {Math.round((a.verdict?.data.confidence ?? 0) * 100)}% judge confidence</span></p>
                  <p className="mono mt-3 line-clamp-4 rounded-[12px] border border-line bg-white/70 p-3 text-[12px] leading-relaxed"><Leak text={`"${a.response?.data.response ?? a.response?.data.responsePreview ?? "(no reply recorded)"}"`} markers={s.secretMarkers} /></p>
                  {run && <Link to={`/app/runs/${run.id}`} className="label mt-3 inline-flex items-center gap-1 text-ink underline decoration-2 underline-offset-4">Full exchange <ArrowRight size={13} /></Link>}
                </Tile>
              );
            })}
          </div>
        )}
      </section>

      {/* Trends, only when there is a trend */}
      {runs.length >= 2 ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5"><Heading title="Blocked rate by run" desc="Is the model getting safer, or worse?" /><TrendArea points={trend.map((r) => r.catchRate)} labels={trend.map((r) => `R${r.index}`)} height={150} /></Card>
          <Card className="p-5">
            <Heading title="Weakest techniques" desc="Share of attacks blocked, per technique." />
            <div className="space-y-3">
              {[...stats.byTechnique].sort((a, b) => a.blocked / a.total - b.blocked / b.total).map((t) => {
                const pct = Math.round((t.blocked / t.total) * 100);
                return <div key={t.technique} className="grid grid-cols-[1fr_44px] items-center gap-3"><div><div className="flex justify-between text-[12.5px] font-semibold"><span className="truncate">{techniqueLabel(t.technique)}</span><span className="mono text-muted">{t.blocked}/{t.total}</span></div><HBar className="mt-1" value={pct} height={10} color={pct >= 70 ? VERDICT_COLOR.blocked : pct >= 40 ? VERDICT_COLOR.ambiguous : VERDICT_COLOR.passed_through} /></div><span className="mono text-right text-[12px] font-bold">{pct}%</span></div>;
              })}
            </div>
          </Card>
        </div>
      ) : runs.length === 1 ? (
        <Card flat className="p-5 text-[13.5px] text-ink-2">Trends appear after a second run. {s.canRun ? <Link to="/app/live" className="font-semibold underline decoration-2 underline-offset-4">Start one</Link> : "Ask the operator to run the suite again."}</Card>
      ) : null}

      {s.entries.length > 0 && <p className="text-[12.5px] text-ink-2">The record has {s.entries.length} entries. Latest hash <Hash value={s.entries[s.entries.length - 1].hash} /> · {fmtAgo(s.entries[s.entries.length - 1].ts, now)}.</p>}
      {connectOpen && <ConnectDialog onClose={() => setConnectOpen(false)} />}
    </div>
  );
}
