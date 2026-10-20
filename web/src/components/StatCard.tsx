import { useCountUp } from "../lib/useCountUp";

type Props = {
  label: string;
  value: string | number;
  caption?: string;
  tone?: "default" | "caught" | "leak" | "attacker" | "defender";
};

const toneClasses: Record<NonNullable<Props["tone"]>, string> = {
  default: "text-foreground",
  caught: "text-caught",
  leak: "text-leak",
  attacker: "text-attacker",
  defender: "text-defender",
};

function AnimatedNumber({ value }: { value: string | number }) {
  const str = String(value);
  const match = str.match(/^-?\d+/);
  const leading = match ? parseInt(match[0], 10) : NaN;
  const animated = useCountUp(Number.isFinite(leading) ? leading : 0);
  if (!match) return <>{value}</>;
  return (
    <>
      {animated}
      {str.slice(match[0].length)}
    </>
  );
}

export default function StatCard({ label, value, caption, tone = "default" }: Props) {
  return (
    <div className="bg-card border border-border rounded-card card-shadow card-hover px-5 py-4 flex-1 min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      <div className={`font-display font-bold text-3xl tabular-nums ${toneClasses[tone]}`}>
        <AnimatedNumber value={value} />
      </div>
      {caption && <div className="text-xs text-muted-foreground mt-1">{caption}</div>}
    </div>
  );
}
