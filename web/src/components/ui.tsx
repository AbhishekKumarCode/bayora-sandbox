import type { ReactNode, ButtonHTMLAttributes, HTMLAttributes, CSSProperties } from "react";
import { Link } from "react-router-dom";
import type { Verdict } from "@/lib/api";

export function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

export type Tone = "yellow" | "red" | "green" | "blue" | "violet" | "amber" | "ink";
export const TONE_HEX: Record<Tone, string> = { yellow: "#7a6a2a", red: "#b8514c", green: "#2f8a5f", blue: "#3f66c4", violet: "#7b66c9", amber: "#a87a1f", ink: "#1f2430" };

/* ---------- Buttons ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ink" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" | "lg"; to?: string };
const sizes = { sm: "h-9 px-3 text-[13px]", md: "h-11 px-4 text-[14px]", lg: "h-14 px-6 text-[16px]" };
export function Button({ variant = "secondary", size = "md", className, to, children, ...rest }: BtnProps) {
  const cls = cx("b-btn", variant !== "secondary" && variant, sizes[size], className);
  if (to) return <Link to={to} className={cls}>{children}</Link>;
  return <button className={cls} {...rest}>{children}</button>;
}

/* ---------- Surfaces ---------- */
export function Card({ className, children, flat, ...rest }: HTMLAttributes<HTMLDivElement> & { flat?: boolean }) {
  return <div className={cx(flat ? "b-card-flat" : "b-card", className)} {...rest}>{children}</div>;
}
/** Extruded block: the isometric tile. */
export function Tile({ tone = "ink", className, children, depth, ...rest }: HTMLAttributes<HTMLDivElement> & { tone?: Tone; depth?: number }) {
  return <div className={cx("b-tile", tone, className)} style={depth ? ({ "--depth": `${depth}px` } as CSSProperties) : undefined} {...rest}>{children}</div>;
}

/* ---------- Pills, stamps ---------- */
export function Pill({ tone = "yellow", children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return <span className={cx("b-pill", tone, className)}>{dot && <span className="h-2 w-2 bg-current" />}{children}</span>;
}
export function Stamp({ tone = "green", children, className, animate }: { tone?: Tone; children: ReactNode; className?: string; animate?: boolean }) {
  return <span className={cx("b-stamp", animate && "stamp-in", className)} style={{ color: TONE_HEX[tone] }}>{children}</span>;
}
export function verdictTone(v?: Verdict | null): Tone {
  if (v === "blocked") return "green";
  if (v === "passed_through") return "red";
  return "amber";
}

/* ---------- Actor glyphs ---------- */
export function Actor({ kind, size = 36, className }: { kind: "attacker" | "model" | "judge" | "seal"; size?: number; className?: string }) {
  const bg = kind === "attacker" ? "rgb(227 139 134 / .35)" : kind === "model" ? "rgb(195 182 242 / .45)" : kind === "judge" ? "rgb(157 183 240 / .4)" : "rgb(143 211 176 / .4)";
  const fg = kind === "attacker" ? "var(--color-red-2)" : kind === "model" ? "var(--color-violet-2)" : kind === "judge" ? "var(--color-blue-2)" : "var(--color-green-2)";
  return (
    <span className={cx("inline-flex shrink-0 items-center justify-center rounded-[9px]", className)} style={{ width: size, height: size, background: bg, color: fg }}>
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {kind === "attacker" && (<><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" /><path d="M9 10l6 6M15 10l-6 6" /></>)}
        {kind === "model" && (<><rect x="4" y="5" width="16" height="14" /><path d="M8 9h8M8 13h8M8 17h5" /></>)}
        {kind === "judge" && (<><path d="M12 3v18M5 7h14" /><path d="M5 7l-3 7h6zM19 7l-3 7h6z" /></>)}
        {kind === "seal" && (<><rect x="4" y="10" width="16" height="11" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>)}
      </svg>
    </span>
  );
}

/* ---------- Text blocks ---------- */
export function SectionTitle({ eyebrow, title, desc, right }: { eyebrow?: string; title: string; desc?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <div className="label mb-1 text-muted">{eyebrow}</div>}
        <h2 className="display text-[22px]">{title}</h2>
        {desc && <p className="mt-1 text-[13.5px] text-ink-2">{desc}</p>}
      </div>
      {right}
    </div>
  );
}
export const Heading = SectionTitle;

export function Empty({ title, desc, action }: { icon?: ReactNode; title: string; desc?: ReactNode; action?: ReactNode }) {
  return (
    <div className="b-card-flat flex flex-col items-center justify-center px-6 py-14 text-center" style={{ borderStyle: "dashed" }}>
      <div className="display text-[20px]">{title}</div>
      {desc && <div className="mx-auto mt-1 max-w-md text-[13.5px] text-ink-2">{desc}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Hash({ value, n = 6, className }: { value: string; n?: number; className?: string }) {
  const short = value.length > n * 2 ? `${value.slice(0, n)}…${value.slice(-4)}` : value;
  return <code title={value} className={cx("mono text-[12px] font-bold", className)}>{short}</code>;
}

/* kept for API compatibility; the brutal system has no glows */
export function Glow(_: { tone?: string; size?: number; className?: string; style?: CSSProperties; drift?: string }) { return null; }
export function Stat(props: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; children?: ReactNode }) {
  return (
    <Tile tone={props.tone ?? "ink"} className="p-5">
      <div className="label text-muted">{props.label}</div>
      <div className="display mt-2 text-[40px]">{props.value}</div>
      {props.sub && <div className="mt-2 text-[13px] text-ink-2">{props.sub}</div>}
      {props.children}
    </Tile>
  );
}
