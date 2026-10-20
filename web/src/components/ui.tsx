import type { ReactNode, ButtonHTMLAttributes, HTMLAttributes } from "react";
import { Link } from "react-router-dom";
import type { Verdict } from "@/lib/api";

export function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

/* ---------- Glow ---------- */
export type Tone = "brand" | "attack" | "judge" | "sealed" | "pending";

export function Glow({ tone = "brand", size = 420, className = "", style, drift }: { tone?: Tone; size?: number; className?: string; style?: React.CSSProperties; drift?: "a" | "b" | "c" }) {
  return (
    <div
      aria-hidden
      className={cx("glow", `glow-${tone}`, drift && `drift-${drift}`, className)}
      style={{ width: size, height: size, ...style }}
    />
  );
}

/* ---------- Buttons ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" | "lg"; to?: string };

const btnBase = "inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50 disabled:pointer-events-none";
const btnVariant = {
  primary: "bg-ink text-white hover:bg-[#23262e] shadow-[0_1px_0_rgb(255_255_255/0.08)_inset,0_1px_2px_rgb(17_19_24/0.2)]",
  secondary: "bg-surface text-ink border border-line hover:border-line-strong hover:bg-canvas",
  ghost: "text-ink-2 hover:bg-[#eceef2]",
  danger: "bg-attack text-white hover:brightness-95",
};
const btnSize = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-[15px]" };

export function Button({ variant = "primary", size = "md", className, to, children, ...rest }: BtnProps) {
  const cls = cx(btnBase, btnVariant[variant], btnSize[size], className);
  if (to) return <Link to={to} className={cls}>{children}</Link>;
  return <button className={cls} {...rest}>{children}</button>;
}

/* ---------- Card ---------- */
export function Card({ className, children, glow, ...rest }: HTMLAttributes<HTMLDivElement> & { glow?: Tone }) {
  return (
    <div className={cx("card relative overflow-hidden", className)} {...rest}>
      {glow && <Glow tone={glow} size={260} className="-top-24 -right-24 opacity-40" />}
      <div className="relative">{children}</div>
    </div>
  );
}

/* ---------- Badges / pills ---------- */
const toneCls: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand",
  attack: "bg-attack-soft text-attack",
  judge: "bg-judge-soft text-judge",
  sealed: "bg-sealed-soft text-sealed",
  pending: "bg-pending-soft text-pending",
};
export function Pill({ tone = "brand", children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium leading-5", toneCls[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function verdictTone(v?: Verdict | null): Tone {
  if (v === "blocked") return "sealed";
  if (v === "passed_through") return "attack";
  if (v === "ambiguous") return "pending";
  return "pending";
}

/* ---------- Actor glyphs (same on landing + app) ---------- */
export function Actor({ kind, size = 36, className }: { kind: "attacker" | "model" | "judge" | "seal"; size?: number; className?: string }) {
  const color = kind === "attacker" ? "var(--color-attack)" : kind === "model" ? "var(--color-brand)" : kind === "judge" ? "var(--color-judge)" : "var(--color-sealed)";
  const soft = kind === "attacker" ? "var(--color-attack-soft)" : kind === "model" ? "var(--color-brand-soft)" : kind === "judge" ? "var(--color-judge-soft)" : "var(--color-sealed-soft)";
  return (
    <span className={cx("inline-flex shrink-0 items-center justify-center rounded-[10px]", className)} style={{ width: size, height: size, background: soft, color }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {kind === "attacker" && (<><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" /><path d="M9 10l6 6M15 10l-6 6" /></>)}
        {kind === "model" && (<><path d="M12 3a4 4 0 0 0-4 4v1a4 4 0 0 0-3 4 4 4 0 0 0 3 4v1a4 4 0 0 0 8 0v-1a4 4 0 0 0 3-4 4 4 0 0 0-3-4V7a4 4 0 0 0-4-4z" /><path d="M12 7v10M8 12h8" /></>)}
        {kind === "judge" && (<><path d="M12 3v18M5 7h14" /><path d="M5 7l-3 7a3 3 0 0 0 6 0L5 7zM19 7l-3 7a3 3 0 0 0 6 0l-3-7z" /></>)}
        {kind === "seal" && (<><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /><path d="M12 15v2" /></>)}
      </svg>
    </span>
  );
}

/* ---------- Misc ---------- */
export function Stat({ label, value, sub, tone, children }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; children?: ReactNode }) {
  return (
    <Card className="p-5" glow={tone}>
      <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted">{label}</div>
      <div className="mt-2 text-[30px] font-semibold leading-none tracking-tight">{value}</div>
      {sub && <div className="mt-2 text-[13px] text-muted">{sub}</div>}
      {children}
    </Card>
  );
}

export function SectionTitle({ eyebrow, title, desc, right }: { eyebrow?: string; title: string; desc?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <div className="mb-1 text-[12px] font-medium uppercase tracking-[0.08em] text-muted">{eyebrow}</div>}
        <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
        {desc && <p className="mt-1 text-[13px] text-muted">{desc}</p>}
      </div>
      {right}
    </div>
  );
}

export function Empty({ icon, title, desc, action }: { icon?: ReactNode; title: string; desc?: ReactNode; action?: ReactNode }) {
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-[14px] border border-dashed border-line-strong px-6 py-14 text-center">
      <Glow tone="brand" size={320} className="-top-32 left-1/2 -translate-x-1/2 opacity-40" />
      <div className="relative">
        {icon && <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-[10px] bg-brand-soft text-brand">{icon}</div>}
        <div className="text-[15px] font-semibold">{title}</div>
        {desc && <div className="mx-auto mt-1 max-w-md text-[13px] text-muted">{desc}</div>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}

export function Hash({ value, n = 6, className }: { value: string; n?: number; className?: string }) {
  const short = value.length > n * 2 ? `${value.slice(0, n)}…${value.slice(-4)}` : value;
  return <code title={value} className={cx("mono text-[12px] text-ink-2", className)}>{short}</code>;
}
