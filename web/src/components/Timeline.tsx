import { Link } from "react-router-dom";
import type { Attack } from "@/lib/model";
import { fmtTime, techniqueLabel, verdictLabel } from "@/lib/model";
import { Actor, Hash, Stamp, verdictTone, cx } from "./ui";

/** One attack as a readable card: what was sent, what came back, what the judge said. */
export function AttackCard({ a, index, animate = false }: { a: Attack; index?: number; animate?: boolean }) {
  const v = a.verdict?.data.verdict;
  const tone = a.error ? "red" : verdictTone(v);
  const through = v === "passed_through";

  return (
    <div className={cx("b-card p-5", animate && "rise")} style={through ? { boxShadow: "6px 6px 0 var(--color-red), 6px 6px 0 3px var(--color-ink)" } : undefined}>
      <div className="flex flex-wrap items-center gap-3">
        {index != null && <span className="mono text-[12px] font-bold text-muted">{String(index).padStart(2, "0")}</span>}
        <span className="display text-[18px]">{techniqueLabel(a.technique)}</span>
        <span className="mono text-[12px] text-muted">{fmtTime(a.ts)}</span>
        <span className="ml-auto">
          {a.verdict || a.error ? <Stamp tone={tone} animate={animate}>{a.error ? "Model error" : verdictLabel(v)}</Stamp> : <span className="b-pill amber blink">judging</span>}
        </span>
      </div>

      <div className="mt-5 space-y-4">
        <Line kind="attacker" label="Attacker sent">
          {a.prompt ? <span className="mono whitespace-pre-wrap text-[12.5px] leading-relaxed">"{a.prompt}"</span> : <span className="text-ink-2">a prompt using <span className="mono font-bold">{a.technique}</span> (prompt not recorded in this log).</span>}
          <span className="label mt-1.5 block text-muted">judge never sees this{a.source === "broker" && " · fired by the broker, not the red container"}</span>
        </Line>
        <Line kind="model" label="Model replied">
          {a.error ? <span className="mono text-[12.5px] text-red-2">{a.error.data.error}</span>
            : a.response ? <span className="mono whitespace-pre-wrap text-[12.5px] leading-relaxed">"{a.response.data.response ?? a.response.data.responsePreview}"</span>
            : <span className="label text-amber-2 blink">waiting…</span>}
        </Line>
        <Line kind="judge" label="Judge decided">
          {a.verdict ? (
            <span className="text-[13.5px]">
              <span className={cx("display text-[15px]", through ? "text-red-2" : v === "blocked" ? "text-green-2" : "text-amber-2")}>{verdictLabel(v)}</span>
              <span className="text-ink-2"> · {a.verdict.data.notes || "no notes"}</span> <span className="mono text-[12px] text-muted">{Math.round((a.verdict.data.confidence ?? 0) * 100)}% sure</span>
            </span>
          ) : a.error ? <span className="text-muted">nothing to judge</span> : <span className="label text-amber-2 blink">awaiting blind verdict…</span>}
        </Line>
      </div>

      {a.seal && (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t-[3px] border-ink pt-3 text-[12px]">
          <Actor kind="seal" size={22} />
          <span className="label">Sealed · entry {a.seal.seq}</span>
          <Hash value={a.seal.hash} />
          <Link to={`/app/audit#seq-${a.seal.seq}`} className="label ml-auto underline decoration-2 underline-offset-4">View in chain</Link>
        </div>
      )}
    </div>
  );
}

function Line({ kind, label, children }: { kind: "attacker" | "model" | "judge"; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[32px_120px_1fr] items-start gap-3">
      <Actor kind={kind} size={30} />
      <span className="label pt-2 text-muted">{label}</span>
      <div className="min-w-0 break-words pt-1.5">{children}</div>
    </div>
  );
}
