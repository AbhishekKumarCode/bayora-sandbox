import { Target, Bot, ShieldCheck, DoorOpen } from "lucide-react";
import RoomCard from "../components/RoomCard";
import { Card, PageHead } from "../components/ui";

const features = [
  { title: "Separate keys", body: "Each room signs with its own key — nobody can act as a role it isn't." },
  { title: "One hallway", body: "Rooms never communicate directly. Every message passes through the broker." },
  { title: "Answer only", body: "When sealed, the defender receives only the model's answer — never the question." },
  { title: "Written down", body: "Every message goes into a chained notebook that reveals edits." },
];

export default function Rooms() {
  return (
    <div className="flex flex-col gap-6 stagger">
      <PageHead
        title="Rooms"
        sub="Choose the attacker, defender, and model under test — each with its own private key. This is enforced by separate Docker networks, not just a convention."
      />

      <div>
        <h2 className="font-display font-semibold text-sm mb-3">Set up</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <RoomCard
            icon={Target}
            title="Attacker room"
            description="Invents tricky prompts to trip up the model."
            agentLabel="RED_TEAM_TOKEN · set in .env"
            tone="attacker"
          />
          <RoomCard
            icon={Bot}
            title="Model under test"
            description="Answers whatever it's given."
            agentLabel="ANTHROPIC_API_KEY · optional, mock mode otherwise"
            tone="default"
          />
          <RoomCard
            icon={ShieldCheck}
            title="Defender room"
            description="Judges answers as safe or not. Never sees the question."
            agentLabel="BLUE_TEAM_TOKEN · set in .env"
            tone="defender"
          />
        </div>
      </div>

      <Card>
        <div className="flex items-center gap-2.5 mb-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-foreground">
            <DoorOpen size={16} strokeWidth={2.25} />
          </span>
          <h2 className="font-display font-semibold text-sm">The Hallway</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Attack → model → answer only → defender. Every step is logged. The defender never sees the
          question — that's what makes the verdict trustworthy rather than rehearsed.
        </p>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {features.map((f) => (
          <Card key={f.title} className="!p-4">
            <h3 className="font-display font-semibold text-sm mb-1">{f.title}</h3>
            <p className="text-xs text-muted-foreground">{f.body}</p>
          </Card>
        ))}
      </div>

      <Card className="!p-4 text-xs text-muted-foreground">
        Want the full list of what this setup protects against — and what it honestly doesn't?
        See <code className="font-mono">docs/THREAT_MODEL.md</code> in the repo.
      </Card>
    </div>
  );
}
