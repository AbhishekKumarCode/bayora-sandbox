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

type Props = {
  emoji: string;
  title: string;
  description: string;
  agentLabel: string;
  tone: Tone;
};

export default function RoomCard({ emoji, title, description, agentLabel, tone }: Props) {
  return (
    <Card className={`card-hover !p-4 ${toneBorder[tone]}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg leading-none">{emoji}</span>
        <h3 className={`font-display font-semibold text-sm ${toneText[tone]}`}>{title}</h3>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="mt-3 text-[11px] font-mono text-muted-foreground">{agentLabel}</div>
    </Card>
  );
}
