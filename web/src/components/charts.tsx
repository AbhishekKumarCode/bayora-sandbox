import type { Verdict } from "@/lib/api";
import { cx } from "./ui";

export const VERDICT_COLOR: Record<Verdict | "pending" | "error", string> = {
  blocked: "var(--color-green)",
  passed_through: "var(--color-red)",
  ambiguous: "var(--color-amber)",
  pending: "#dfe2ea",
  error: "var(--color-red)",
};
const INK = "var(--color-line-strong)";

/* ---------- Ring with hard black outline ---------- */
export function VerdictRing({ blocked, passed, ambiguous, pending = 0, size = 160, stroke = 22, label, sub }: { blocked: number; passed: number; ambiguous: number; pending?: number; size?: number; stroke?: number; label?: React.ReactNode; sub?: React.ReactNode }) {
  const total = Math.max(1, blocked + passed + ambiguous + pending);
  const r = (size - stroke) / 2 - 3;
  const c = 2 * Math.PI * r;
  const segs: Array<[number, string]> = [[blocked, VERDICT_COLOR.blocked], [ambiguous, VERDICT_COLOR.ambiguous], [passed, VERDICT_COLOR.passed_through], [pending, VERDICT_COLOR.pending]];
  let offset = 0;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={INK} strokeWidth={stroke + 2} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ffffff" strokeWidth={stroke} />
        {segs.map(([n, color], i) => {
          const len = (n / total) * c;
          const el = n > 0 ? <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} style={{ transition: "stroke-dasharray .5s, stroke-dashoffset .5s" }} /> : null;
          offset += len; return el;
        })}
        
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="display text-[30px]">{label}</div>
        {sub && <div className="label mt-1 text-muted">{sub}</div>}
      </div>
    </div>
  );
}

/* ---------- Strip: one block per attack ---------- */
export function VerdictStrip({ verdicts, size = 14, gap = 4, className }: { verdicts: Array<Verdict | "pending" | "error">; size?: number; gap?: number; className?: string }) {
  return (
    <div className={cx("flex flex-wrap", className)} style={{ gap }}>
      {verdicts.map((v, i) => <span key={i} title={v} className="block rounded-[4px]" style={{ width: size, height: size, background: VERDICT_COLOR[v] }} />)}
    </div>
  );
}

/* ---------- Trend: stepped bars, black outlines ---------- */
export function TrendArea({ points, height = 140, className, labels }: { points: number[]; height?: number; className?: string; labels?: string[] }) {
  if (points.length === 0) return <div className="text-[13px] text-muted">No data.</div>;
  return (
    <div className={cx("", className)}>
      <div className="flex items-end gap-3 border-b border-line" style={{ height }}>
        {points.map((p, i) => (
          <div key={i} className="group relative flex flex-1 flex-col items-center justify-end self-stretch">
            <span className="label mb-1 text-ink">{p}%</span>
            <div className="w-full rounded-t-[8px]" style={{ height: `${Math.max(4, p)}%`, background: p >= 70 ? VERDICT_COLOR.blocked : p >= 40 ? VERDICT_COLOR.ambiguous : VERDICT_COLOR.passed_through }} />
          </div>
        ))}
      </div>
      {labels && <div className="mt-2 flex gap-3">{labels.map((l, i) => <span key={i} className="label flex-1 text-center text-muted">{l}</span>)}</div>}
    </div>
  );
}

/* ---------- Horizontal bar ---------- */
export function HBar({ value, max = 100, color = "var(--color-green)", height = 14, className }: { value: number; max?: number; color?: string; height?: number; className?: string }) {
  return (
    <div className={cx("w-full overflow-hidden rounded-full bg-ink/10", className)} style={{ height }}>
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color, transition: "width .4s" }} />
    </div>
  );
}

/* ---------- Gauge ---------- */
export function Gauge({ pct, size = 64, stroke = 10 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2 - 2;
  const c = Math.PI * r;
  const color = pct >= 70 ? VERDICT_COLOR.blocked : pct >= 40 ? VERDICT_COLOR.ambiguous : VERDICT_COLOR.passed_through;
  const d = `M ${size / 2 - r} ${size / 2} A ${r} ${r} 0 0 1 ${size / 2 + r} ${size / 2}`;
  return (
    <div className="relative" style={{ width: size, height: size / 2 + 8 }}>
      <svg width={size} height={size / 2 + 6} viewBox={`0 0 ${size} ${size / 2 + 6}`}>
        <path d={d} fill="none" stroke={INK} strokeWidth={stroke + 1} />
        <path d={d} fill="none" stroke="#fff" strokeWidth={stroke} />
        <path d={d} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={`${(pct / 100) * c} ${c}`} />
      </svg>
      <div className="display absolute inset-x-0 bottom-0 text-center text-[14px]">{pct}%</div>
    </div>
  );
}

export function Cell({ v, title }: { v?: Verdict | "pending"; title?: string }) {
  return <span title={title} className="block h-6 w-6 rounded-[6px]" style={{ background: v ? VERDICT_COLOR[v] : "rgb(255 255 255 / .7)", boxShadow: "0 0 0 1px var(--color-line)" }} />;
}

export function Legend({ items, className }: { items: Array<{ color: string; label: string; n?: number }>; className?: string }) {
  return (
    <div className={cx("flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] font-semibold", className)}>
      {items.map((it) => <span key={it.label} className="flex items-center gap-1.5"><span className="h-3 w-3 border border-line" style={{ background: it.color }} />{it.label}{it.n != null && <span className="mono text-muted">{it.n}</span>}</span>)}
    </div>
  );
}
