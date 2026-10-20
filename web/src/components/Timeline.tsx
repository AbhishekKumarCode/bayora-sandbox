import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import type { Attack } from "@/lib/model";
import { fmtTime, techniqueLabel, verdictLabel } from "@/lib/model";
import { Actor, Hash, Pill, verdictTone, cx } from "./ui";

/** One attack as a single readable card: what was sent, what came back, what the judge said. */
export function AttackCard({ a, index, animate = false }: { a: Attack; index?: number; animate?: boolean }) {
  const v = a.verdict?.data.verdict;
  const tone = a.error ? "attack" : verdictTone(v);

  return (
    <div className={cx("card p-5", animate && "rise", v === "passed_through" && "ring-1 ring-attack/30")}>
      <div className="flex flex-wrap items-center gap-3">
        {index != null && <span className="mono text-[12px] text-faint">{String(index).padStart(2, "0")}</span>}
        <span className="text-[15px] font-semibold">{techniqueLabel(a.technique)}</span>
        <span className="text-[12.5px] text-muted">{fmtTime(a.ts)}</span>
        <Pill tone={tone} dot className="ml-auto">{a.error ? "Model error" : verdictLabel(v)}</Pill>
      </div>

      <div className="mt-4 space-y-3">
        <Line kind="attacker" label="Attacker sent">
          <span className="text-ink-2">a prompt using <span className="mono text-ink">{a.technique}</span>. The judge is never shown this.</span>
        </Line>
        <Line kind="model" label="Model replied">
          {a.error ? (
            <span className="mono text-attack">{a.error.data.error}</span>
          ) : a.response ? (
            <span className="mono whitespace-pre-wrap text-ink">"{a.response.data.response ?? a.response.data.responsePreview}{!a.response.data.response && (a.response.data.responsePreview?.length ?? 0) >= 120 ? "…" : ""}"</span>
          ) : (
            <span className="text-pending">waiting…</span>
          )}
        </Line>
        <Line kind="judge" label="Judge decided">
          {a.verdict ? (
            <span className="text-ink-2">
              <span className={cx("font-semibold", v === "passed_through" ? "text-attack" : v === "blocked" ? "text-sealed" : "text-pending")}>{verdictLabel(v)}</span>
              {" · "}{a.verdict.data.notes || "no notes"} <span className="text-muted">· {Math.round((a.verdict.data.confidence ?? 0) * 100)}% sure</span>
            </span>
          ) : a.error ? (
            <span className="text-muted">nothing to judge</span>
          ) : (
            <span className="text-pending">waiting for the blind verdict…</span>
          )}
        </Line>
      </div>

      {a.seal && (
        <div className="mt-4 flex items-center gap-2 border-t border-line pt-3 text-[12px] text-muted">
          <ShieldCheck size={13} className="text-sealed" />
          <span>Sealed as entry {a.seal.seq}</span>
          <Hash value={a.seal.hash} />
          <Link to={`/app/audit#seq-${a.seal.seq}`} className="ml-auto font-medium text-brand hover:underline">View in chain</Link>
        </div>
      )}
    </div>
  );
}

function Line({ kind, label, children }: { kind: "attacker" | "model" | "judge"; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[28px_118px_1fr] items-start gap-3 text-[13.5px] leading-relaxed">
      <Actor kind={kind} size={26} />
      <span className="pt-0.5 text-[12.5px] font-medium text-muted">{label}</span>
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}
