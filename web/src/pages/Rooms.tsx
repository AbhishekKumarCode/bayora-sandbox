import RoomCard from "../components/RoomCard";

const features = [
  { title: "Separate keys", body: "Each room signs with its own key — nobody can act as a role it isn't." },
  { title: "One hallway", body: "Rooms never communicate directly. Every message passes through the broker." },
  { title: "Answer only", body: "When sealed, the defender receives only the model's answer — never the question." },
  { title: "Written down", body: "Every message goes into a chained notebook that reveals edits." },
];

export default function Rooms() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display font-bold text-2xl tracking-tight">Rooms</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-xl">
          Choose the attacker, defender, and model under test — each with its own private key. This
          is enforced by separate Docker networks, not just a convention.
        </p>
      </div>

      <div>
        <h2 className="font-display font-semibold text-sm mb-3">Set up</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <RoomCard
            emoji="🎯"
            title="Attacker room"
            description="Invents tricky prompts to trip up the model."
            agentLabel="RED_TEAM_TOKEN · set in .env"
            tone="attacker"
          />
          <RoomCard
            emoji="🤖"
            title="Model under test"
            description="Answers whatever it's given."
            agentLabel="ANTHROPIC_API_KEY · optional, mock mode otherwise"
            tone="default"
          />
          <RoomCard
            emoji="🛡️"
            title="Defender room"
            description="Judges answers as safe or not. Never sees the question."
            agentLabel="BLUE_TEAM_TOKEN · set in .env"
            tone="defender"
          />
        </div>
      </div>

      <div className="bg-card border border-border rounded-card card-shadow p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">🚪</span>
          <h2 className="font-display font-semibold text-sm">The Hallway</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Attack → model → answer only → defender. Every step is logged. The defender never sees the
          question — that's what makes the verdict trustworthy rather than rehearsed.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {features.map((f) => (
          <div key={f.title} className="bg-card border border-border rounded-card p-4">
            <h3 className="font-display font-semibold text-sm mb-1">{f.title}</h3>
            <p className="text-xs text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-card p-4 text-xs text-muted-foreground">
        Want the full list of what this setup protects against — and what it honestly doesn't?
        See <code className="font-mono">docs/THREAT_MODEL.md</code> in the repo.
      </div>
    </div>
  );
}
