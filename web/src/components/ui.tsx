export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-card border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,18,38,0.04)] ${className}`}>
      {children}
    </section>
  );
}

export function PageHead({ title, sub, right }: { title: string; sub: string; right?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-display text-[28px] font-semibold leading-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
      </div>
      {right}
    </div>
  );
}

export function Chip({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "attacker" | "defender" | "caught" | "leak" }) {
  const toneClasses: Record<string, string> = {
    default: "bg-secondary text-foreground",
    attacker: "bg-attacker-soft text-attacker",
    defender: "bg-defender-soft text-defender",
    caught: "bg-caught-soft text-caught",
    leak: "bg-leak-soft text-leak",
  };
  return <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${toneClasses[tone]}`}>{children}</span>;
}

const RING_COLOR: Record<string, string> = {
  caught: "#16a34a",
  leak: "#d97706",
  attacker: "#dc2626",
  defender: "#4f46e5",
};

/** Score as a ring: the arc fills in proportion to the 0-100 value. */
export function ScoreRing({
  value,
  size = 48,
  tone = "defender",
  dark = false,
}: {
  value: number;
  size?: number;
  tone?: "caught" | "leak" | "attacker" | "defender";
  dark?: boolean;
}) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span
      className="relative inline-grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${value} of 100`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={dark ? "rgba(255,255,255,0.14)" : "#e2e8f0"} strokeWidth="4" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={RING_COLOR[tone]}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.2,0.7,0.2,1)" }}
        />
      </svg>
      <span
        className={`font-display absolute font-semibold tabular-nums ${dark ? "text-white" : ""}`}
        style={{ fontSize: size >= 52 ? 18 : 13 }}
      >
        {value}
      </span>
    </span>
  );
}
