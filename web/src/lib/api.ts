// Talks to the real broker (services/broker). This dashboard holds only the
// AUDIT_TOKEN — the same trust level as the broker's /audit endpoint itself.
// It never has RED_TEAM_TOKEN or BLUE_TEAM_TOKEN, by design.

const BROKER_URL = import.meta.env.VITE_BROKER_URL || "http://localhost:4000";

function getAuditToken(): string {
  let token: string = sessionStorage.getItem("bayora_audit_token") || "";
  if (!token) {
    // Local dev convenience only — if VITE_AUDIT_TOKEN isn't set (it's
    // gitignored and never committed), fall back to prompting in-browser.
    token = import.meta.env.VITE_AUDIT_TOKEN || window.prompt("Enter AUDIT_TOKEN (from your .env file):") || "";
    if (token) sessionStorage.setItem("bayora_audit_token", token);
  }
  return token;
}

function authHeaders(): HeadersInit {
  return { authorization: `Bearer ${getAuditToken()}` };
}

export type AuditEntry = {
  seq: number;
  ts: string;
  event: "attack_submitted" | "llm_response_received" | "blue_team_verdict" | "llm_error";
  data: Record<string, unknown>;
  prevHash: string;
  hash: string;
};

export async function getHealth(): Promise<{ ok: boolean; mockMode: boolean }> {
  const res = await fetch(`${BROKER_URL}/health`);
  if (!res.ok) throw new Error(`health check failed: ${res.status}`);
  return res.json();
}

export async function getAudit(): Promise<{ count: number; entries: AuditEntry[] }> {
  const res = await fetch(`${BROKER_URL}/audit`, { headers: authHeaders() });
  if (res.status === 403) {
    sessionStorage.removeItem("bayora_audit_token");
    throw new Error("forbidden — bad AUDIT_TOKEN");
  }
  if (!res.ok) throw new Error(`audit fetch failed: ${res.status}`);
  return res.json();
}

export type VerifyResult =
  | { ok: true; count: number; finalHash: string }
  | { ok: false; brokenAtSeq: number; reason: string };

export async function verifyChain(simulateTamperSeq?: number): Promise<VerifyResult> {
  const qs = simulateTamperSeq != null ? `?simulateTamperSeq=${simulateTamperSeq}` : "";
  const res = await fetch(`${BROKER_URL}/verify${qs}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`verify failed: ${res.status}`);
  return res.json();
}

export async function triggerRun(): Promise<{ status: string }> {
  const res = await fetch(`${BROKER_URL}/trigger-run`, { method: "POST", headers: authHeaders() });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `trigger-run failed: ${res.status}`);
  return json;
}

export function isForbiddenError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("forbidden");
}
