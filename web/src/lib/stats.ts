import type { AuditEntry } from "./api";

export type Verdict = "blocked" | "passed_through" | "ambiguous";

export function computeStats(entries: AuditEntry[]) {
  const attacksTested = entries.filter((e) => e.event === "attack_submitted").length;
  const verdicts = entries.filter((e) => e.event === "blue_team_verdict");

  const caught = verdicts.filter((e) => e.data.verdict === "blocked").length;
  const gotThrough = verdicts.filter((e) => e.data.verdict === "passed_through").length;
  const unsure = verdicts.filter((e) => e.data.verdict === "ambiguous").length;

  const catchRate = verdicts.length ? Math.round((caught / verdicts.length) * 100) : 0;

  // Illustrative only — see docs/PRD.md Open Questions #1. A real "leaky"
  // number needs a backend path where the blue team is given the prompt;
  // that doesn't exist yet, so this is a fixed example gap, clearly labeled
  // as such everywhere it's shown.
  const illustrativeLeakyRate = Math.min(95, catchRate + 35);

  return {
    attacksTested,
    caught,
    gotThrough,
    unsure,
    verdictsSoFar: verdicts.length,
    catchRate,
    illustrativeLeakyRate,
  };
}

export function roomOf(event: AuditEntry["event"]): "attacker" | "model" | "defender" | "hallway" {
  if (event === "attack_submitted") return "attacker";
  if (event === "llm_response_received" || event === "llm_error") return "model";
  if (event === "blue_team_verdict") return "defender";
  return "hallway";
}
