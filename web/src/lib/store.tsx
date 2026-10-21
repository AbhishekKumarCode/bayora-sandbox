import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ForbiddenError, VIEWER_TOKEN, clearToken, getAudit, getConfig, getHealth, getStoredToken, healStaleBrokerUrl, storeToken, triggerRun as apiTriggerRun, triggerCompare as apiTriggerCompare, verifyChain as apiVerify, type AuditEntry, type VerifyResult } from "./api";

export type Source = "demo" | "broker";

export type Role = "operator" | "viewer";
type Store = {
  source: Source;
  role: Role;                  // operator = audit token entered; viewer = baked read-only token
  connected: boolean;          // broker + token working
  brokerOnline: boolean | null; // health probe
  mockMode: boolean;
  modelName: string | null;
  entries: AuditEntry[];
  loading: boolean;
  error: string | null;
  lastPollAt: number;
  connect: (token: string) => Promise<string | null>; // null = ok, else error message
  recheckHealth: () => Promise<void>;
  disconnect: () => void;
  useDemo: () => void;
  verify: (simulateTamperSeq?: number) => Promise<VerifyResult>;
  triggerRun: (model?: string) => Promise<string>;
  triggerCompare: (models: string[]) => Promise<string>;
};

const Ctx = createContext<Store | null>(null);

const POLL_MS = 2000;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [source, setSource] = useState<Source>(() => (getStoredToken() || VIEWER_TOKEN ? "broker" : "demo"));
  const [role, setRole] = useState<Role>(() => (getStoredToken() ? "operator" : "viewer"));
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [brokerOnline, setBrokerOnline] = useState<boolean | null>(null);
  const [mockMode, setMockMode] = useState(false);
  const [modelName, setModelName] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPollAt, setLastPollAt] = useState(0);
  const lastCount = useRef(-1);

  useEffect(() => {
    let alive = true;
    healStaleBrokerUrl().finally(() => {
      getHealth().then((h) => { if (alive) { setBrokerOnline(h.ok); setMockMode(h.mockMode); } }).catch(() => alive && setBrokerOnline(false));
    });
    const id = setInterval(() => {
      getHealth().then((h) => { if (alive) { setBrokerOnline(h.ok); setMockMode(h.mockMode); } }).catch(() => alive && setBrokerOnline(false));
    }, 15000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const poll = useCallback(async () => {
    try {
      const { entries: next } = await getAudit();
      // only replace state when something changed, so React never re-renders for nothing
      if (next.length !== lastCount.current || (next.length && next[next.length - 1].hash !== entries[entries.length - 1]?.hash)) {
        lastCount.current = next.length;
        setEntries(next);
      }
      setConnected(true);
      setError(null);
      setLastPollAt(Date.now());
    } catch (e) {
      if (e instanceof ForbiddenError) {
        if (getStoredToken()) {
          clearToken();
          setRole("viewer");
          setError(VIEWER_TOKEN ? "The operator token was rejected. Back to read-only viewing." : "The audit token was rejected.");
          if (!VIEWER_TOKEN) { setConnected(false); setSource("demo"); setEntries([]); }
        } else {
          setConnected(false);
          setSource("demo");
          setEntries([]);
          setError("The broker rejected the viewer token.");
        }
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setLoading(false);
    }
  }, [entries]);

  useEffect(() => {
    if (source !== "broker") return;
    setLoading(true);
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const recheckHealth = useCallback(async () => {
    try { const h = await getHealth(); setBrokerOnline(h.ok); setMockMode(h.mockMode); }
    catch { setBrokerOnline(false); }
    // model name is operator-only, so it needs the audit token
    if (getStoredToken() || VIEWER_TOKEN) {
      try { const c = await getConfig(); setModelName(c.mockMode ? null : c.model); } catch { /* keep last */ }
    } else {
      setModelName(null);
    }
  }, []);

  const connect = useCallback(async (token: string) => {
    storeToken(token.trim());
    try {
      const { entries: next } = await getAudit();
      lastCount.current = next.length;
      setEntries(next);
      setConnected(true);
      setError(null);
      setSource("broker");
      setRole("operator");
      setLastPollAt(Date.now());
      recheckHealth();
      return null;
    } catch (e) {
      clearToken();
      const msg = e instanceof ForbiddenError
        ? "The broker rejected that token (403). It must be the AUDIT_TOKEN from the broker's .env, not the red or blue token."
        : e instanceof Error ? e.message : String(e);
      setError(msg);
      return msg;
    }
  }, [recheckHealth]);

  // "Disconnect" = drop operator rights. With a viewer token we keep reading live data.
  const disconnect = useCallback(() => {
    clearToken();
    setRole("viewer");
    setError(null);
    if (!VIEWER_TOKEN) { setConnected(false); setSource("demo"); setEntries([]); }
  }, []);

  const useDemo = useCallback(() => {
    setSource("demo");
    setConnected(false);
    setEntries([]);
  }, []);

  const verify = useCallback(async (simulateTamperSeq?: number): Promise<VerifyResult> => {
    if (source === "broker") return apiVerify(simulateTamperSeq);
    throw new Error("Not connected to a broker.");
  }, [source]);

  const guard = useCallback(() => {
    if (source !== "broker") throw new Error("Not connected to a broker.");
    if (role !== "operator") throw new Error("Starting a run needs the operator token. Visitors can watch, verify and read everything.");
  }, [source, role]);
  const triggerRun = useCallback(async (model?: string) => { guard(); const r = await apiTriggerRun(model); return r.status; }, [guard]);
  const triggerCompare = useCallback(async (models: string[]) => { guard(); const r = await apiTriggerCompare(models); return r.status; }, [guard]);

  const value = useMemo<Store>(() => ({
    source, role, connected, brokerOnline, mockMode, modelName, entries, loading, error, lastPollAt,
    connect, disconnect, useDemo, verify, triggerRun, triggerCompare, recheckHealth,
  }), [source, role, connected, brokerOnline, mockMode, modelName, entries, loading, error, lastPollAt, connect, disconnect, useDemo, verify, triggerRun, triggerCompare, recheckHealth]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}

export function useNow(tickMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), tickMs); return () => clearInterval(id); }, [tickMs]);
  return now;
}
