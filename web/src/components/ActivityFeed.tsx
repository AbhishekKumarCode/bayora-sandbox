import type { AuditEntry } from "../lib/api";

const KNOWN_VERDICTS = new Set(["blocked", "passed_through", "ambiguous"]);

const badgeClasses: Record<string, string> = {
  attack_submitted: "bg-attacker-soft text-attacker border-attacker/30",
  llm_response_received: "bg-secondary text-foreground border-border",
  llm_error: "bg-destructive/10 text-destructive border-destructive/30",
  blocked: "bg-caught-soft text-caught border-caught/30",
  passed_through: "bg-leak-soft text-leak border-leak/30",
  ambiguous: "bg-secondary text-muted-foreground border-border",
};

function badgeFor(entry: AuditEntry) {
  if (entry.event === "blue_team_verdict") {
    const verdict = String(entry.data.verdict);
    const safe = KNOWN_VERDICTS.has(verdict) ? verdict : "ambiguous";
    const label = safe === "blocked" ? "Caught" : safe === "passed_through" ? "Got through" : "Unsure";
    return { className: badgeClasses[safe], label };
  }
  if (entry.event === "attack_submitted") return { className: badgeClasses.attack_submitted, label: "Attack" };
  if (entry.event === "llm_response_received") return { className: badgeClasses.llm_response_received, label: "Response" };
  if (entry.event === "llm_error") return { className: badgeClasses.llm_error, label: "Error" };
  return { className: badgeClasses.ambiguous, label: entry.event };
}

function detailFor(entry: AuditEntry) {
  if (entry.event === "attack_submitted") {
    return <span>technique: <span className="font-mono text-xs">{String(entry.data.technique)}</span></span>;
  }
  if (entry.event === "llm_response_received") {
    const preview = String(entry.data.responsePreview ?? "");
    const mock = entry.data.mock ? "[mock] " : "";
    return <span className="text-muted-foreground italic">{mock}{preview}</span>;
  }
  if (entry.event === "blue_team_verdict") {
    return <span className="font-mono text-xs">confidence: {String(entry.data.confidence)}</span>;
  }
  if (entry.event === "llm_error") {
    return <span className="text-destructive text-xs">{String(entry.data.error)}</span>;
  }
  return null;
}

export default function ActivityFeed({ entries, limit }: { entries: AuditEntry[]; limit?: number }) {
  const shown = [...entries].reverse().slice(0, limit ?? entries.length);

  return (
    <div className="bg-card border border-border rounded-card card-shadow p-5">
      <h2 className="font-display font-semibold text-sm mb-3">What just happened</h2>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">Every event will be written here, chained to the one before.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {shown.map((entry, i) => {
            const badge = badgeFor(entry);
            return (
              <li
                key={entry.seq}
                className={`flex items-center gap-3 py-2 text-sm ${
                  i === 0 ? "bg-accent/40 -mx-2 px-2 rounded" : ""
                }`}
                style={i === 0 ? { animation: "fade-up 0.3s cubic-bezier(0.2, 0.7, 0.2, 1) both" } : undefined}
              >
                <span className="font-mono text-xs text-muted-foreground w-[70px] shrink-0">
                  {new Date(entry.ts).toLocaleTimeString([], { hour12: false })}
                </span>
                <span className={`text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0 ${badge.className}`}>
                  {badge.label}
                </span>
                <span className="truncate">{detailFor(entry)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
