import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ShieldCheck } from "lucide-react";
import type { Attack } from "@/lib/model";
import { fmtTime, techniqueLabel, verdictLabel } from "@/lib/model";
import { Actor, Hash, Pill, verdictTone, cx } from "./ui";

/** One attack rendered as attack → model → blind verdict → sealed. */
export function AttackTrio({ a, defaultOpen = false, animate = false }: { a: Attack; defaultOpen?: boolean; animate?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const v = a.verdict?.data.verdict;
  const tone = a.error ? "attack" : verdictTone(v);

  return (
    <div className={cx("relative", animate && "rise")}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left hover:bg-canvas">
        <Actor kind="attacker" size={30} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-semibold">{techniqueLabel(a.technique)}</span>
            <Hash value={a.attackId} n={4} className="text-faint" />
          </div>
          <div className="mt-0.5 text-[12px] text-muted">{fmtTime(a.ts)} · seq {a.seq}{a.seal && a.seal.seq !== a.seq ? `–${a.seal.seq}` : ""}</div>
        </div>
        <Pill tone={tone} dot>{a.error ? "Model error" : verdictLabel(v)}</Pill>
        <ChevronDown size={16} className={cx("text-faint transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="ml-[15px] border-l border-line pl-6 pb-3 pt-1">
          <Step tone="attack" title="Attack fired" meta={`${fmtTime(a.ts)} · red room`} actor="attacker">
            <div className="text-[13px] text-ink-2">Technique <span className="mono text-ink">{a.technique}</span>. The prompt itself is held by the broker and never shown to the judge.</div>
          </Step>
          {a.error ? (
            <Step tone="attack" title="Model error" meta={fmtTime(a.error.ts)} actor="model">
              <pre className="mono whitespace-pre-wrap rounded-[10px] bg-attack-soft p-3 text-[12px] text-attack">{a.error.data.error}</pre>
            </Step>
          ) : a.response ? (
            <Step tone="brand" title="Model replied" meta={`${fmtTime(a.response.ts)}${a.response.data.mock ? " · mock model" : ""}`} actor="model">
              <pre className="mono whitespace-pre-wrap rounded-[10px] bg-canvas p-3 text-[12px] leading-relaxed text-ink-2">{a.response.data.responsePreview}{(a.response.data.responsePreview?.length ?? 0) >= 120 ? "…" : ""}</pre>
            </Step>
          ) : (
            <Step tone="pending" title="Waiting for the model" meta="in progress" actor="model" pending />
          )}
          {a.verdict ? (
            <Step tone="judge" title={`Blind verdict · ${verdictLabel(v)}`} meta={`${fmtTime(a.verdict.ts)} · confidence ${Math.round((a.verdict.data.confidence ?? 0) * 100)}%`} actor="judge">
              {a.verdict.data.notes && <div className="text-[13px] text-ink-2">{a.verdict.data.notes}</div>}
            </Step>
          ) : !a.error ? (
            <Step tone="pending" title="Awaiting blind verdict" meta="judge sees only the reply" actor="judge" pending />
          ) : null}
          {a.seal && (
            <div className="relative mt-3 flex items-center gap-3 rounded-[12px] bg-sealed-soft/70 px-3 py-2.5">
              <span className="absolute -left-[31px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-sealed ring-4 ring-sealed/20" />
              <ShieldCheck size={16} className="text-sealed" />
              <div className="min-w-0 flex-1 text-[12.5px]">
                <span className="font-medium text-sealed">Sealed</span>
                <span className="text-muted"> · entry {a.seal.seq} · </span>
                <Hash value={a.seal.hash} />
                <span className="text-muted"> ← prev </span>
                <Hash value={a.seal.prevHash} />
              </div>
              <Link to={`/app/audit#seq-${a.seal.seq}`} className="text-[12px] font-medium text-sealed hover:underline">View in chain</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Step({ title, meta, children, actor, pending }: { tone: string; title: string; meta: string; children?: React.ReactNode; actor: "attacker" | "model" | "judge"; pending?: boolean }) {
  return (
    <div className="relative py-2">
      <span className={cx("absolute -left-[29px] top-3 h-2 w-2 rounded-full", actor === "attacker" ? "bg-attack" : actor === "model" ? "bg-brand" : "bg-judge", pending && "pulse-ring text-pending bg-pending")} />
      <div className="flex items-center gap-2">
        <Actor kind={actor} size={22} />
        <span className="text-[13px] font-semibold">{title}</span>
        <span className="text-[12px] text-muted">· {meta}</span>
      </div>
      {children && <div className="mt-2 pl-[30px]">{children}</div>}
    </div>
  );
}
