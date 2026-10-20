import type { Verdict } from "@/lib/api";
import { cx } from "./ui";

export const VERDICT_COLOR: Record<Verdict | "pending" | "error", string> = {
  blocked: "var(--color-sealed)",
  passed_through: "var(--color-attack)",
  ambiguous: "var(--color-pending)",
  pending: "var(--color-faint)",
  error: "var(--color-attack)",
};

/* ---------- Ring: blocked / through / unsure ---------- */
export function VerdictRing({ blocked, passed, ambiguous, pending = 0, size = 160, stroke = 14, label, sub }: { blocked: number; passed: number; ambiguous: number; pending?: number; size?: number; stroke?: number; label?: React.ReactNode; sub?: React.ReactNode }) {
  const total = Math.max(1, blocked + passed + ambiguous + pending);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const segs: Array<[number, string]> = [
    [blocked, VERDICT_COLOR.blocked],
    [ambiguous, VERDICT_COLOR.ambiguous],
    [passed, VERDICT_COLOR.passed_through],
    [pending, VERDICT_COLOR.pending],
  ];
  let offset = 0;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={stroke} />
        {segs.map(([n, color], i) => {
          const len = (n / total) * c;
          const el = n > 0 ? (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={`${Math.max(0, len - 3)} ${c - Math.max(0, len - 3)}`} strokeDashoffset={-offset} strokeLinecap="butt" style={{ transition: "stroke-dasharray .6s cubic-bezier(.16,1,.3,1), stroke-dashoffset .6s" }} />
          ) : null;
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-[26px] font-semibold leading-none tracking-tight">{label}</div>
        {sub && <div className="mt-1 text-[11.5px] text-muted">{sub}</div>}
      </div>
    </div>
  );
}

/* ---------- Strip: one square per attack ---------- */
export function VerdictStrip({ verdicts, size = 10, gap = 3, className }: { verdicts: Array<Verdict | "pending" | "error">; size?: number; gap?: number; className?: string }) {
  return (
    <div className={cx("flex flex-wrap", className)} style={{ gap }}>
      {verdicts.map((v, i) => (
        <span key={i} title={v} className="rounded-[2px]" style={{ width: size, height: size, background: VERDICT_COLOR[v], opacity: v === "pending" ? 0.5 : 1 }} />
      ))}
    </div>
  );
}

/* ---------- Trend: area line of catch rate per run ---------- */
export function TrendArea({ points, height = 120, className, labels }: { points: number[]; height?: number; className?: string; labels?: string[] }) {
  const w = 100; // percent-based viewBox
  const n = points.length;
  if (n === 0) return <div className="text-[13px] text-muted">No data.</div>;
  const xs = points.map((_, i) => (n === 1 ? 50 : (i / (n - 1)) * w));
  const ys = points.map((p) => height - 8 - (p / 100) * (height - 20));
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  const area = `${path} L${xs[n - 1]},${height} L${xs[0]},${height} Z`;
  return (
    <div className={cx("relative", className)}>
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="h-full w-full" style={{ height }}>
        <defs>
          <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--color-judge)" stopOpacity=".35" />
            <stop offset="1" stopColor="var(--color-judge)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[25, 50, 75].map((g) => <line key={g} x1="0" x2={w} y1={height - 8 - (g / 100) * (height - 20)} y2={height - 8 - (g / 100) * (height - 20)} stroke="var(--color-line)" strokeWidth=".4" vectorEffect="non-scaling-stroke" />)}
        <path d={area} fill="url(#trendFill)" />
        <path d={path} fill="none" stroke="var(--color-judge)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      {/* dots + labels in HTML so they don't stretch */}
      {xs.map((x, i) => (
        <div key={i} className="absolute flex -translate-x-1/2 flex-col items-center" style={{ left: `${x}%`, top: ys[i] - 5 }}>
          <span className="h-2.5 w-2.5 rounded-full border-2 border-white" style={{ background: points[i] >= 70 ? "var(--color-sealed)" : points[i] >= 40 ? "var(--color-pending)" : "var(--color-attack)" }} title={`${points[i]}%`} />
        </div>
      ))}
      {labels && (
        <div className="mt-1 flex justify-between text-[11px] text-faint">
          {labels.map((l, i) => <span key={i}>{l}</span>)}
        </div>
      )}
    </div>
  );
}

/* ---------- Horizontal bar ---------- */
export function HBar({ value, max = 100, color = "var(--color-sealed)", height = 8, className }: { value: number; max?: number; color?: string; height?: number; className?: string }) {
  return (
    <div className={cx("w-full overflow-hidden rounded-full bg-canvas", className)} style={{ height }}>
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color, transition: "width .6s cubic-bezier(.16,1,.3,1)" }} />
    </div>
  );
}

/* ---------- Gauge: small arc for a percentage ---------- */
export function Gauge({ pct, size = 56, stroke = 6 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = Math.PI * r; // half circle
  const color = pct >= 70 ? "var(--color-sealed)" : pct >= 40 ? "var(--color-pending)" : "var(--color-attack)";
  return (
    <div className="relative" style={{ width: size, height: size / 2 + 6 }}>
      <svg width={size} height={size / 2 + 4} viewBox={`0 0 ${size} ${size / 2 + 4}`}>
        <path d={`M ${stroke / 2} ${size / 2} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${size / 2}`} fill="none" stroke="var(--color-line)" strokeWidth={stroke} strokeLinecap="round" />
        <path d={`M ${stroke / 2} ${size / 2} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${size / 2}`} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} style={{ transition: "stroke-dasharray .6s" }} />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center text-[12px] font-semibold tabular-nums">{pct}%</div>
    </div>
  );
}

/* ---------- Heatmap cell ---------- */
export function Cell({ v, title }: { v?: Verdict | "pending"; title?: string }) {
  return <span title={title} className="block h-5 w-5 rounded-[4px]" style={{ background: v ? VERDICT_COLOR[v] : "var(--color-line)", opacity: v ? 1 : 0.6 }} />;
}

/* ---------- Legend ---------- */
export function Legend({ items, className }: { items: Array<{ color: string; label: string; n?: number }>; className?: string }) {
  return (
    <div className={cx("flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-2", className)}>
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: it.color }} />{it.label}{it.n != null && <span className="tabular-nums text-muted">{it.n}</span>}</span>
      ))}
    </div>
  );
}
