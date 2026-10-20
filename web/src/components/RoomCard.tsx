import type { LucideIcon } from "lucide-react";
import { Card } from "./ui";

type Tone = "attacker" | "defender" | "default";

const toneBorder: Record<Tone, string> = {
  attacker: "border-attacker/30",
  defender: "border-defender/30",
  default: "border-border",
};

const toneText: Record<Tone, string> = {
  attacker: "text-attacker",
  defender: "text-defender",
  default: "text-foreground",
};

const toneBadge: Record<Tone, string> = {
  attacker: "bg-attacker-soft text-attacker",
  defender: "bg-defender-soft text-defender",
  default: "bg-secondary text-foreground",
};

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  agentLabel: string;
  tone: Tone;
};

export default function RoomCard({ icon: Icon, title, description, agentLabel, tone }: Props) {
  return (
    <Card className={`card-hover !p-4 ${toneBorder[tone]}`}>
      <div className="flex items-center gap-2.5 mb-2">
        <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${toneBadge[tone]}`}>
          <Icon size={16} strokeWidth={2.25} />
        </span>
        <h3 className={`font-display font-semibold text-sm ${toneText[tone]}`}>{title}</h3>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="mt-3 text-[11px] font-mono text-muted-foreground">{agentLabel}</div>
    </Card>
  );
}
