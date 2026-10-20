import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, ShieldAlert, Play, Radio } from "lucide-react";
import { useStore, useNow } from "@/lib/store";
import { deriveRuns, overallStats, isLive, fmtAgo, techniqueLabel, verdictLabel, groupAttacks } from "@/lib/model";
import { Button, Card, Pill, SectionTitle, Stat, Actor, Hash, verdictTone, cx } from "@/components/ui";
import type { VerifyResult } from "@/lib/api";

export function Overview() {
  const s = useStore();
  const now = useNow(1000);
  const runs = useMemo(() => deriveRuns(s.entries, now), [s.entries, now]);
  const stats = useMemo(() => overallStats(s.entries), [s.entries]);
  const live = isLive(s.entries, now);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const last = s.entries[s.entries.length - 1];
  const through = useMemo(() => groupAttacks(s.entries).filter((a) => a.verdict?.data.verdict === "passed_through").slice(-4).reverse(), [s.entries]);
  const trend = useMemo(() => [...runs].reverse().slice(-8), [runs]);

  async function doVerify() {
    setVerifying(true);
    try { setVerify(await s.verify()); } finally { setVerifying(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {s.source === "demo" ? "Showing demo data. Connect a broker from the sidebar to see real runs." : `Live from the broker · last poll ${s.lastPollAt ? fmtAgo(new Date(s.lastPollAt).toISOString(), now) : "…"}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" to="/app/live"><Radio size={15} /> Live run</Button>
          <Button to="/app/live"><Play size={15} /> Start a run</Button>
        </div>
      </div>

      {s.error && <div className="rounded-[10px] border border-attack/30 bg-attack-soft px-4 py-2.5 text-[13px] text-attack">{s.error}</div>}

      {/* Chain status banner */}
      <Card className="p-5" glow={verify && !verify.ok ? "attack" : "sealed"}>
        <div className="flex flex-wrap items-center gap-4">
          <div className={cx("flex h-12 w-12 items-center justify-center rounded-[12px]", verify && !verify.ok ? "bg-attack-soft text-attack" : "bg-sealed-soft text-sealed")}>
            {verify && !verify.ok ? <ShieldAlert size={22} /> : <ShieldCheck size={22} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold">
              {verify == null ? "Audit chain not verified yet" : verify.ok ? `Chain intact · ${verify.count} entries` : `Chain broken at entry ${verify.brokenAtSeq}`}
            </div>
            <div className="mt-0.5 text-[13px] text-muted">
              {verify == null && last && <>Latest entry {last.seq} · <Hash value={last.hash} /> · HMAC-SHA256 chained</>}
              {verify?.ok && <>Final hash <Hash value={verify.finalHash} /> recomputed and matched.</>}
              {verify && !verify.ok && <>Reason: {verify.reason}. Every later entry inherits the break.</>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {live && <Pill tone="attack" dot>Run in progress</Pill>}
            <Button variant="secondary" onClick={doVerify} disabled={verifying}>{verifying ? "Verifying…" : "Verify chain"}</Button>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Attacks fired" value={stats.attacks} sub={`${runs.length} run${runs.length === 1 ? "" : "s"} recorded`} tone="attack" />
        <Stat label="Catch rate" value={`${stats.catchRate}%`} sub={`${stats.blocked} blocked of ${stats.judged} judged`} tone="sealed">
          <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-canvas">
            <span className="bg-sealed" style={{ width: `${stats.judged ? (stats.blocked / stats.judged) * 100 : 0}%` }} />
            <span className="bg-pending" style={{ width: `${stats.judged ? (stats.ambiguous / stats.judged) * 100 : 0}%` }} />
            <span className="bg-attack" style={{ width: `${stats.judged ? (stats.passed / stats.judged) * 100 : 0}%` }} />
          </div>
        </Stat>
        <Stat label="Got through" value={stats.passed} sub={`${stats.ambiguous} unsure`} tone="judge" />
        <Stat label="Chain length" value={s.entries.length} sub={last ? `last entry ${fmtAgo(last.ts, now)}` : "empty"} tone="brand" />
      </div>

      {/* Exposure + trend */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SectionTitle title="Exposure" desc="Attacks the blind judge marked as got through. These are the ones that matter." right={through.length > 0 && <Pill tone="attack" dot>{through.length} recent</Pill>} />
          <Card glow={through.length ? "attack" : undefined}>
            {through.length === 0 ? (
              <div className="px-5 py-10 text-center text-[13px] text-muted">Nothing got through in the current data.</div>
            ) : (
              <div className="divide-y divide-line">
                {through.map((a) => {
                  const run = runs.find((r) => r.attacks.some((x) => x.attackId === a.attackId));
                  return (
                    <Link key={a.attackId} to={run ? `/app/runs/${run.id}` : "/app/runs"} className="flex gap-3 px-5 py-4 hover:bg-canvas">
                      <Actor kind="attacker" size={30} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13.5px] font-semibold">{techniqueLabel(a.technique)}</span>
                          <span className="text-[12px] text-muted">{run ? `Run ${run.index}` : ""} · {fmtAgo(a.ts, now)} · confidence {Math.round((a.verdict?.data.confidence ?? 0) * 100)}%</span>
                        </div>
                        <p className="mono mt-1.5 truncate rounded-[8px] bg-canvas px-2.5 py-1.5 text-[12px] text-ink-2">{a.response?.data.responsePreview ?? "(no preview)"}</p>
                        {a.verdict?.data.notes && <div className="mt-1 text-[12px] text-muted">Judge: {a.verdict.data.notes}</div>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
        <div className="lg:col-span-2">
          <SectionTitle title="Catch rate by run" desc="Oldest to newest" />
          <Card className="p-5">
            <div className="flex h-[150px] items-end gap-2">
              {trend.map((r) => (
                <Link key={r.id} to={`/app/runs/${r.id}`} className="group flex flex-1 flex-col items-center justify-end gap-1.5 self-stretch" title={`Run ${r.index}: ${r.catchRate}%`}>
                  <span className="text-[11px] tabular-nums text-muted opacity-0 transition group-hover:opacity-100">{r.catchRate}%</span>
                  <span className="w-full rounded-[6px] bg-gradient-to-t from-judge to-sealed transition group-hover:brightness-110" style={{ height: `${Math.max(6, r.catchRate)}%` }} />
                  <span className="mono text-[10px] text-faint">{r.index}</span>
                </Link>
              ))}
              {trend.length === 0 && <div className="w-full text-center text-[13px] text-muted">No runs yet.</div>}
            </div>
            <div className="mt-3 flex items-center justify-between text-[12px] text-muted">
              <span>latest {trend.length ? `${trend[trend.length - 1].catchRate}%` : "–"}</span>
              <span>{trend.length > 1 ? `${trend[trend.length - 1].catchRate - trend[0].catchRate >= 0 ? "+" : ""}${trend[trend.length - 1].catchRate - trend[0].catchRate} pts since run ${trend[0].index}` : ""}</span>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Recent runs */}
        <div className="lg:col-span-3">
          <SectionTitle title="Recent runs" right={<Link to="/app/runs" className="flex items-center gap-1 text-[13px] font-medium text-brand hover:underline">All runs <ArrowRight size={14} /></Link>} />
          <Card>
            <div className="divide-y divide-line">
              {runs.slice(0, 5).map((r) => (
                <Link key={r.id} to={`/app/runs/${r.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-canvas">
                  <div className="w-16 text-[13px] font-semibold">Run {r.index}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px]">{r.attacks.length} attacks · {fmtAgo(r.startedAt, now)}</div>
                    <div className="mt-1.5 flex h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-canvas">
                      <span className="bg-sealed" style={{ width: `${(r.blocked / r.attacks.length) * 100}%` }} />
                      <span className="bg-pending" style={{ width: `${(r.ambiguous / r.attacks.length) * 100}%` }} />
                      <span className="bg-attack" style={{ width: `${(r.passed / r.attacks.length) * 100}%` }} />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[15px] font-semibold tabular-nums">{r.catchRate}%</div>
                    <div className="text-[11px] text-muted">caught</div>
                  </div>
                  {r.live ? <Pill tone="attack" dot>Live</Pill> : <Pill tone="sealed">Sealed</Pill>}
                </Link>
              ))}
              {runs.length === 0 && <div className="px-5 py-10 text-center text-[13px] text-muted">No runs yet.</div>}
            </div>
          </Card>
        </div>

        {/* Techniques */}
        <div className="lg:col-span-2">
          <SectionTitle title="By technique" desc="Catch rate per attack family" />
          <Card className="p-5">
            <div className="space-y-3.5">
              {stats.byTechnique.slice(0, 7).map((t) => (
                <div key={t.technique}>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-medium">{techniqueLabel(t.technique)}</span>
                    <span className="tabular-nums text-muted">{t.blocked}/{t.total}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-canvas">
                    <div className="h-full rounded-full bg-gradient-to-r from-judge to-sealed" style={{ width: `${(t.blocked / t.total) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Latest verdicts strip */}
      <div>
        <SectionTitle title="Latest verdicts" desc="What the blind judge decided most recently" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...s.entries].filter((e) => e.event === "blue_team_verdict").slice(-6).reverse().map((e) => (
            <Card key={e.seq} className="p-4">
              <div className="flex items-center gap-3">
                <Actor kind="judge" size={30} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold">{verdictLabel(e.data.verdict)}</div>
                  <div className="truncate text-[12px] text-muted">{e.data.notes || "no notes"}</div>
                </div>
                <Pill tone={verdictTone(e.data.verdict)}>{Math.round((e.data.confidence ?? 0) * 100)}%</Pill>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
