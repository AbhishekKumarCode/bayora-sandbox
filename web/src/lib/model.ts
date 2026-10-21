import type { AuditEntry, Verdict } from "./api";

export type Attack = {
  attackId: string;
  technique: string;
  prompt?: string;
  promptRedacted?: boolean;
  source?: "red-team" | "broker";
  seq: number;
  ts: string;
  response?: AuditEntry;
  verdict?: AuditEntry;
  error?: AuditEntry;
  seal?: AuditEntry; // the last entry in this attack's trio (what "sealed" it)
};

export type Run = {
  id: string;
  index: number;
  startedAt: string;
  endedAt: string;
  attacks: Attack[];
  blocked: number;
  passed: number;
  ambiguous: number;
  pending: number;
  catchRate: number; // 0-100
  seqFrom: number;
  seqTo: number;
  live: boolean;
};

const RUN_GAP_MS = 45_000;
const LIVE_WINDOW_MS = 12_000;

export function groupAttacks(entries: AuditEntry[]): Attack[] {
  const byId = new Map<string, Attack>();
  const order: Attack[] = [];
  for (const e of entries) {
    const id = e.data.attackId;
    if (!id) continue;
    if (e.event === "attack_submitted") {
      const a: Attack = { attackId: id, technique: e.data.technique ?? "unknown", prompt: e.data.prompt, promptRedacted: e.data.promptRedacted, source: e.data.source, seq: e.seq, ts: e.ts, seal: e };
      byId.set(id, a);
      order.push(a);
      continue;
    }
    const a = byId.get(id);
    if (!a) continue;
    if (e.event === "llm_response_received") a.response = e;
    else if (e.event === "blue_team_verdict") a.verdict = e;
    else if (e.event === "llm_error") a.error = e;
    a.seal = e;
  }
  return order;
}

export function deriveRuns(entries: AuditEntry[], now = Date.now()): Run[] {
  const attacks = groupAttacks(entries);
  const runs: Run[] = [];
  let cur: Attack[] = [];
  let lastTs = 0;
  const flush = () => {
    if (!cur.length) return;
    const blocked = cur.filter((a) => a.verdict?.data.verdict === "blocked").length;
    const passed = cur.filter((a) => a.verdict?.data.verdict === "passed_through").length;
    const ambiguous = cur.filter((a) => a.verdict?.data.verdict === "ambiguous").length;
    const pending = cur.filter((a) => !a.verdict && !a.error).length;
    const judged = blocked + passed + ambiguous;
    const lastEntry = cur.map((a) => a.seal!).sort((x, y) => y.seq - x.seq)[0];
    const endedAt = lastEntry.ts;
    runs.push({
      id: `run-${cur[0].seq}`,
      index: runs.length + 1,
      startedAt: cur[0].ts,
      endedAt,
      attacks: cur,
      blocked, passed, ambiguous, pending,
      catchRate: judged ? Math.round((blocked / judged) * 100) : 0,
      seqFrom: cur[0].seq,
      seqTo: lastEntry.seq,
      live: pending > 0 && now - new Date(endedAt).getTime() < LIVE_WINDOW_MS * 5,
    });
    cur = [];
  };
  for (const a of attacks) {
    const t = new Date(a.ts).getTime();
    if (cur.length && t - lastTs > RUN_GAP_MS) flush();
    cur.push(a);
    lastTs = t;
  }
  flush();
  return runs.reverse(); // newest first
}

export function overallStats(entries: AuditEntry[]) {
  const attacks = groupAttacks(entries);
  const judged = attacks.filter((a) => a.verdict);
  const blocked = judged.filter((a) => a.verdict!.data.verdict === "blocked").length;
  const passed = judged.filter((a) => a.verdict!.data.verdict === "passed_through").length;
  const ambiguous = judged.length - blocked - passed;
  const byTechnique = new Map<string, { total: number; blocked: number }>();
  for (const a of attacks) {
    const t = byTechnique.get(a.technique) ?? { total: 0, blocked: 0 };
    t.total += 1;
    if (a.verdict?.data.verdict === "blocked") t.blocked += 1;
    byTechnique.set(a.technique, t);
  }
  return {
    attacks: attacks.length,
    judged: judged.length,
    blocked, passed, ambiguous,
    catchRate: judged.length ? Math.round((blocked / judged.length) * 100) : 0,
    byTechnique: [...byTechnique.entries()].map(([technique, v]) => ({ technique, ...v })).sort((a, b) => b.total - a.total),
  };
}

/** Results grouped by the model that answered, for side-by-side comparison. */
export type ModelStats = {
  model: string;
  attacks: number; judged: number; blocked: number; passed: number; ambiguous: number; catchRate: number;
  lastAt: string;
  byTechnique: Map<string, Attack[]>;
};
export function statsByModel(entries: AuditEntry[]): ModelStats[] {
  const out = new Map<string, ModelStats>();
  for (const a of groupAttacks(entries)) {
    const m = a.response?.data.model ?? (a.response?.data.mock ? "mock" : null);
    if (!m) continue;
    let st = out.get(m);
    if (!st) { st = { model: m, attacks: 0, judged: 0, blocked: 0, passed: 0, ambiguous: 0, catchRate: 0, lastAt: a.ts, byTechnique: new Map() }; out.set(m, st); }
    st.attacks += 1;
    if (a.ts > st.lastAt) st.lastAt = a.ts;
    const v = a.verdict?.data.verdict;
    if (v) { st.judged += 1; if (v === "blocked") st.blocked += 1; else if (v === "passed_through") st.passed += 1; else st.ambiguous += 1; }
    const list = st.byTechnique.get(a.technique) ?? []; list.push(a); st.byTechnique.set(a.technique, list);
  }
  for (const st of out.values()) st.catchRate = st.judged ? Math.round((st.blocked / st.judged) * 100) : 0;
  return [...out.values()].sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
}

export function isLive(entries: AuditEntry[], now = Date.now()) {
  const last = entries[entries.length - 1];
  if (!last) return false;
  return now - new Date(last.ts).getTime() < LIVE_WINDOW_MS;
}

export function verdictLabel(v?: Verdict) {
  if (v === "blocked") return "Blocked";
  if (v === "passed_through") return "Got through";
  if (v === "ambiguous") return "Unsure";
  return "Pending";
}

export function techniqueLabel(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function shortHash(h: string, n = 6) {
  return h.length > n * 2 ? `${h.slice(0, n)}…${h.slice(-4)}` : h;
}

export function fmtTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
export function fmtDate(ts: string) {
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}
export function fmtAgo(ts: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(ts).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
export function fmtDuration(a: string, b: string) {
  const s = Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}
