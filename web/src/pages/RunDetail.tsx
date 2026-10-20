import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, ShieldCheck, ShieldAlert } from "lucide-react";
import { useStore, useNow } from "@/lib/store";
import { deriveRuns, fmtDate, fmtTime, fmtDuration } from "@/lib/model";
import { Button, Card, Pill, Hash, Empty, cx } from "@/components/ui";
import { AttackCard } from "@/components/Timeline";
import { Heading } from "./Overview";
import type { VerifyResult } from "@/lib/api";

export function RunDetail() {
  const { id } = useParams();
  const s = useStore();
  const now = useNow(2000);
  const runs = useMemo(() => deriveRuns(s.entries, now), [s.entries, now]);
  const run = runs.find((r) => r.id === id);
  const [filter, setFilter] = useState<"all" | "passed_through">("all");
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
    <div className="mx-auto max-w-[920px] space-y-8">
      <div>
        <Link to="/app/runs" className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink"><ArrowLeft size={14} /> All runs</Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]">
              Run {run.index}: <span className={run.passed ? "text-attack" : "text-sealed"}>{run.passed ? `${run.passed} of ${run.attacks.length} got through` : `all ${run.attacks.length} blocked`}</span>
            </h1>
            <p className="mt-1.5 text-[14px] text-muted">
              {fmtDate(run.startedAt)}, {fmtTime(run.startedAt)} · took {fmtDuration(run.startedAt, run.endedAt)} · {run.blocked} blocked, {run.ambiguous} unsure{run.pending ? `, ${run.pending} still judging` : ""}
              {" · "}{run.live ? <Pill tone="attack" dot>live</Pill> : <Pill tone="sealed">sealed</Pill>}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={exportJson}><Download size={15} /> Export</Button>
            <Button onClick={doVerify} disabled={busy}>{busy ? "Checking…" : "Verify record"}</Button>
          </div>
        </div>
      </div>

      {verify && (
        <div className={cx("flex items-center gap-3 rounded-[12px] px-4 py-3 text-[13.5px] rise", verify.ok ? "bg-sealed-soft text-sealed" : "bg-attack-soft text-attack")}>
          {verify.ok ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
          {verify.ok ? <>The whole record is intact: all {verify.count} entries recompute to the same hashes.</> : <>The record is broken at entry {verify.brokenAtSeq}: {verify.reason}.</>}
        </div>
      )}

      <section>
        <Heading
          title="Every attack in this run"
          sub="Top to bottom: what the attacker sent, what the model replied, what the blind judge decided."
          right={
            <div className="flex gap-1 rounded-[10px] bg-[#eceef2] p-1 text-[12.5px]">
              <button onClick={() => setFilter("all")} className={cx("rounded-[8px] px-2.5 py-1 font-medium", filter === "all" ? "bg-white shadow-sm" : "text-muted hover:text-ink")}>All {run.attacks.length}</button>
              <button onClick={() => setFilter("passed_through")} className={cx("rounded-[8px] px-2.5 py-1 font-medium", filter === "passed_through" ? "bg-white shadow-sm text-attack" : "text-muted hover:text-ink")}>Got through {run.passed}</button>
            </div>
          }
        />
        <div className="space-y-3">
          {shown.map((a, i) => <AttackCard key={a.attackId} a={a} index={run.attacks.indexOf(a) + 1} animate={i === 0 && false} />)}
          {shown.length === 0 && <Card className="p-8 text-center text-[13px] text-muted">Nothing got through in this run.</Card>}
        </div>
      </section>

      <p className="text-[12.5px] text-muted">
        This run is entries {run.seqFrom} to {run.seqTo} of the record. First hash <Hash value={entries[0]?.hash ?? ""} />, last hash <Hash value={entries[entries.length - 1]?.hash ?? ""} />. The judge only ever received the model's reply text, never the prompt. That is enforced by the broker, not by this page.
      </p>
    </div>
  );
}
