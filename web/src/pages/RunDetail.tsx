import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, ShieldCheck, ShieldAlert } from "lucide-react";
import { useStore, useNow } from "@/lib/store";
import { deriveRuns, fmtDate, fmtTime, fmtDuration } from "@/lib/model";
import { Button, Card, Pill, Stat, Hash, Empty, cx } from "@/components/ui";
import { AttackTrio } from "@/components/Timeline";
import type { VerifyResult } from "@/lib/api";

export function RunDetail() {
  const { id } = useParams();
  const s = useStore();
  const now = useNow(2000);
  const runs = useMemo(() => deriveRuns(s.entries, now), [s.entries, now]);
  const run = runs.find((r) => r.id === id);
  const [filter, setFilter] = useState<"all" | "blocked" | "passed_through" | "ambiguous">("all");
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);

  if (!run) return <Empty title="Run not found" desc="It may belong to a different data source." action={<Button variant="secondary" to="/app/runs">Back to runs</Button>} />;

  const shown = run.attacks.filter((a) => filter === "all" || a.verdict?.data.verdict === filter);
  const entries = s.entries.filter((e) => e.seq >= run.seqFrom && e.seq <= run.seqTo);

  async function doVerify() { setBusy(true); try { setVerify(await s.verify()); } finally { setBusy(false); } }
  function exportJson() {
    const blob = new Blob([JSON.stringify({ run: { id: run!.id, startedAt: run!.startedAt, endedAt: run!.endedAt }, entries }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bayora-${run!.id}-evidence.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/app/runs" className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink"><ArrowLeft size={14} /> Runs</Link>
          <div className="flex items-center gap-3">
            <h1 className="text-[24px] font-semibold tracking-tight">Run {run.index}</h1>
            {run.live ? <Pill tone="attack" dot>Live</Pill> : <Pill tone="sealed">Sealed</Pill>}
          </div>
          <p className="mt-1 text-[13.5px] text-muted">{fmtDate(run.startedAt)} · {fmtTime(run.startedAt)} → {fmtTime(run.endedAt)} · {fmtDuration(run.startedAt, run.endedAt)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportJson}><Download size={15} /> Export evidence</Button>
          <Button onClick={doVerify} disabled={busy}>{busy ? "Verifying…" : "Verify chain"}</Button>
        </div>
      </div>

      {verify && (
        <div className={cx("flex items-center gap-3 rounded-[12px] px-4 py-3 text-[13px] rise", verify.ok ? "bg-sealed-soft text-sealed" : "bg-attack-soft text-attack")}>
          {verify.ok ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
          {verify.ok ? <>Whole chain intact ({verify.count} entries). Final hash <Hash value={verify.finalHash} className="text-sealed" />.</> : <>Chain broken at entry {verify.brokenAtSeq}: {verify.reason}.</>}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Attacks" value={run.attacks.length} tone="attack" />
        <Stat label="Blocked" value={`${run.catchRate}%`} sub={`${run.blocked} of ${run.blocked + run.passed + run.ambiguous} judged`} tone="sealed" />
        <Stat label="Got through" value={run.passed} sub={`${run.ambiguous} unsure · ${run.pending} pending`} tone="judge" />
        <Stat label="Chain span" value={`${run.seqFrom}–${run.seqTo}`} sub={<>ends <Hash value={run.attacks[run.attacks.length - 1].seal?.hash ?? ""} /></>} tone="brand" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[17px] font-semibold tracking-tight">Timeline</h2>
            <div className="flex gap-1 rounded-[10px] bg-[#eceef2] p-1 text-[12.5px]">
              {(["all", "blocked", "passed_through", "ambiguous"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={cx("rounded-[8px] px-2.5 py-1 font-medium capitalize", filter === f ? "bg-white shadow-sm" : "text-muted hover:text-ink")}>
                  {f === "passed_through" ? "got through" : f === "ambiguous" ? "unsure" : f}
                </button>
              ))}
            </div>
          </div>
          <Card className="p-2">
            <div className="divide-y divide-line">
              {shown.map((a, i) => <AttackTrio key={a.attackId} a={a} defaultOpen={i === 0} />)}
              {shown.length === 0 && <div className="py-10 text-center text-[13px] text-muted">Nothing matches this filter.</div>}
            </div>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
          <Card className="p-5" glow="brand">
            <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted">Run facts</div>
            <dl className="mt-3 space-y-2.5 text-[13px]">
              <Row k="Target" v={s.mockMode && s.source === "broker" ? "mock model" : s.source === "demo" ? "demo model" : "model under test"} />
              <Row k="Judge" v="blue room · blind" />
              <Row k="Source" v={s.source === "demo" ? "demo data" : "live broker"} />
              <Row k="Entries" v={`${entries.length} in chain`} />
              <Row k="First hash" v={<Hash value={entries[0]?.hash ?? ""} />} />
              <Row k="Last hash" v={<Hash value={entries[entries.length - 1]?.hash ?? ""} />} />
            </dl>
          </Card>
          <Card className="p-5">
            <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted">What the judge saw</div>
            <p className="mt-2 text-[13px] text-ink-2">Only the model's reply. Never the attack prompt, never the technique label. That is enforced by the broker's <code className="mono">/pending</code> route, not by this UI.</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="font-medium text-ink">{v}</dd></div>;
}
