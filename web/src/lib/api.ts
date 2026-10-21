// Talks to the real broker (services/broker). This app only ever holds the
// AUDIT_TOKEN, and only after the user explicitly connects. It never holds
// RED_TEAM_TOKEN or BLUE_TEAM_TOKEN, by design.

export const DEFAULT_BROKER_URL: string =
  import.meta.env.VITE_BROKER_URL || "https://white-ought-rows-less.trycloudflare.com";

// Read-only viewer token baked into the build so visitors see live data
// without any login. It can read the chain, verify it and see config; it
// cannot start runs or change the model (the broker enforces that).
export const VIEWER_TOKEN: string = import.meta.env.VITE_VIEWER_TOKEN || "";

const URL_KEY = "bayora_broker_url";
export function getBrokerUrl(): string {
  try { return (localStorage.getItem(URL_KEY) || DEFAULT_BROKER_URL).replace(/\/+$/, ""); } catch { return DEFAULT_BROKER_URL; }
}
export function hasCustomBrokerUrl(): boolean {
  try { return Boolean(localStorage.getItem(URL_KEY)); } catch { return false; }
}
export function setBrokerUrl(url: string) {
  try { if (!url || url === DEFAULT_BROKER_URL) localStorage.removeItem(URL_KEY); else localStorage.setItem(URL_KEY, url.trim().replace(/\/+$/, "")); } catch { /* ignore */ }
}
/** If a remembered custom URL is dead but the build default answers, drop the stale one. */
export async function healStaleBrokerUrl(): Promise<boolean> {
  if (!hasCustomBrokerUrl()) return false;
  const ping = async (u: string) => { try { const r = await fetch(`${u}/health`, { signal: AbortSignal.timeout(6000) }); return r.ok; } catch { return false; } };
  if (await ping(getBrokerUrl())) return false;
  if (await ping(DEFAULT_BROKER_URL)) { setBrokerUrl(""); return true; }
  return false;
}

const TOKEN_KEY = "bayora_audit_token";

export function getStoredToken(): string {
  try { return sessionStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}
export function storeToken(token: string) {
  try { sessionStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
}
export function clearToken() {
  try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

function authHeaders(): HeadersInit {
  // operator token if the user unlocked, else the public viewer token
  return { authorization: `Bearer ${getStoredToken() || VIEWER_TOKEN}` };
}

export type AuditEvent = "attack_submitted" | "llm_response_received" | "blue_team_verdict" | "llm_error";
export type Verdict = "blocked" | "passed_through" | "ambiguous";

export type AuditEntry = {
  seq: number;
  ts: string;
  event: AuditEvent;
  data: {
    attackId?: string;
    technique?: string;
    prompt?: string;
    promptRedacted?: boolean;
    source?: "red-team" | "broker";
    responsePreview?: string;
    response?: string;
    model?: string;
    secretsMasked?: boolean;
    mock?: boolean;
    verdict?: Verdict;
    confidence?: number;
    notes?: string;
    error?: string;
  };
  prevHash: string;
  hash: string;
};

export class ForbiddenError extends Error {}

async function safeFetch(input: string, init?: RequestInit): Promise<Response> {
  try { return await fetch(input, init); }
  catch { throw new Error(`Could not reach ${getBrokerUrl()}. Is the broker running and the tunnel up? A browser ad-blocker can also block trycloudflare.com.`); }
}

export async function getHealth(): Promise<{ ok: boolean; mockMode: boolean; provider?: string; viewer?: boolean }> {
  const res = await safeFetch(`${getBrokerUrl()}/health`);
  if (!res.ok) throw new Error(`health ${res.status}`);
  return res.json();
}

export async function getAudit(): Promise<{ count: number; entries: AuditEntry[] }> {
  const res = await safeFetch(`${getBrokerUrl()}/audit`, { headers: authHeaders() });
  if (res.status === 401 || res.status === 403) throw new ForbiddenError("bad AUDIT_TOKEN");
  if (!res.ok) throw new Error(`audit ${res.status}`);
  return res.json();
}

export type VerifyResult =
  | { ok: true; count: number; finalHash: string }
  | { ok: false; brokenAtSeq: number; reason: string };

export async function verifyChain(simulateTamperSeq?: number): Promise<VerifyResult> {
  const qs = simulateTamperSeq != null ? `?simulateTamperSeq=${simulateTamperSeq}` : "";
  const res = await safeFetch(`${getBrokerUrl()}/verify${qs}`, { headers: authHeaders() });
  if (res.status === 401 || res.status === 403) throw new ForbiddenError("bad AUDIT_TOKEN");
  if (!res.ok) throw new Error(`verify ${res.status}`);
  return res.json();
}

export async function triggerRun(model?: string): Promise<{ status: string }> {
  const res = await safeFetch(`${getBrokerUrl()}/trigger-run`, { method: "POST", headers: { ...authHeaders(), "content-type": "application/json" }, body: JSON.stringify(model ? { model } : {}) });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) throw new ForbiddenError("bad AUDIT_TOKEN");
  if (!res.ok) throw new Error(json.error || `trigger-run ${res.status}`);
  return json;
}

export type BrokerConfig = { provider: string; model: string; baseUrl: string | null; mockMode: boolean; systemPrompt: string | null; secretMarkers?: string[]; runInProgress: boolean; compare?: { models: string[]; index: number; startedAt: number } | null; role?: "operator" | "viewer" };
export type CatalogAttack = { technique: string; prompt: string };

async function auditGet<T>(path: string): Promise<T> {
  const res = await safeFetch(`${getBrokerUrl()}${path}`, { headers: authHeaders() });
  if (res.status === 401 || res.status === 403) throw new ForbiddenError("bad AUDIT_TOKEN");
  if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `${path} ${res.status}`); }
  return res.json();
}

export const getConfig = () => auditGet<BrokerConfig>("/config");
export const getModels = () => auditGet<{ models: string[]; current: string }>("/models");
export const getAttackCatalog = () => auditGet<{ attacks: CatalogAttack[] }>("/attacks");

export async function setModel(model: string): Promise<BrokerConfig> {
  const res = await safeFetch(`${getBrokerUrl()}/config`, { method: "POST", headers: { ...authHeaders(), "content-type": "application/json" }, body: JSON.stringify({ model }) });
  const j = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) throw new ForbiddenError("bad AUDIT_TOKEN");
  if (!res.ok) throw new Error(j.error || `config ${res.status}`);
  return j;
}

export async function triggerCompare(models: string[]): Promise<{ status: string; models: string[] }> {
  const res = await safeFetch(`${getBrokerUrl()}/trigger-compare`, { method: "POST", headers: { ...authHeaders(), "content-type": "application/json" }, body: JSON.stringify({ models }) });
  const j = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) throw new ForbiddenError("bad AUDIT_TOKEN");
  if (!res.ok) throw new Error(j.error || `trigger-compare ${res.status}`);
  return j;
}
