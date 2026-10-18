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

export default function StatCard({ label, value, caption, tone = "default" }: Props) {
  return (
    <div className="bg-card border border-border rounded-card card-shadow px-5 py-4 flex-1 min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      <div className={`font-display font-bold text-3xl ${toneClasses[tone]}`}>{value}</div>
      {caption && <div className="text-xs text-muted-foreground mt-1">{caption}</div>}
    </div>
  );
}
