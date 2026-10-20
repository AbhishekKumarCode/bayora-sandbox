import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ForbiddenError, clearToken, getAudit, getHealth, getStoredToken, storeToken, triggerRun as apiTriggerRun, verifyChain as apiVerify, type AuditEntry, type VerifyResult } from "./api";
import { demoEntries } from "./demo";

export type Source = "demo" | "broker";

type Store = {
  source: Source;
  connected: boolean;          // broker + token working
  brokerOnline: boolean | null; // health probe
  mockMode: boolean;
  entries: AuditEntry[];
  loading: boolean;
  error: string | null;
  lastPollAt: number;
  connect: (token: string) => Promise<string | null>; // null = ok, else error message
  recheckHealth: () => Promise<void>;
  disconnect: () => void;
  useDemo: () => void;
  verify: (simulateTamperSeq?: number) => Promise<VerifyResult>;
  triggerRun: () => Promise<string>;
};

const Ctx = createContext<Store | null>(null);

const POLL_MS = 2000;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [source, setSource] = useState<Source>(() => (getStoredToken() ? "broker" : "demo"));
  const [entries, setEntries] = useState<AuditEntry[]>(() => demoEntries());
  const [brokerOnline, setBrokerOnline] = useState<boolean | null>(null);
  const [mockMode, setMockMode] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPollAt, setLastPollAt] = useState(0);
  const lastCount = useRef(-1);

  useEffect(() => {
    let alive = true;
    getHealth().then((h) => { if (alive) { setBrokerOnline(h.ok); setMockMode(h.mockMode); } }).catch(() => alive && setBrokerOnline(false));
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
        clearToken();
        setConnected(false);
        setSource("demo");
        setEntries(demoEntries());
        setError("The audit token was rejected. Switched back to demo data.");
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

  const disconnect = useCallback(() => {
    clearToken();
    setConnected(false);
    setSource("demo");
    setEntries(demoEntries());
    setError(null);
  }, []);

  const useDemo = useCallback(() => {
    setSource("demo");
    setConnected(false);
    setEntries(demoEntries());
  }, []);

  const verify = useCallback(async (simulateTamperSeq?: number): Promise<VerifyResult> => {
    if (source === "broker") return apiVerify(simulateTamperSeq);
    // demo: pretend
    await new Promise((r) => setTimeout(r, 500));
    if (simulateTamperSeq != null) return { ok: false, brokenAtSeq: simulateTamperSeq, reason: "data was altered" };
    return { ok: true, count: entries.length, finalHash: entries[entries.length - 1]?.hash ?? "" };
  }, [source, entries]);

  const triggerRun = useCallback(async () => {
    if (source !== "broker") throw new Error("Connect to a broker to start a real run. Demo data is read-only.");
    const r = await apiTriggerRun();
    return r.status;
  }, [source]);

  const value = useMemo<Store>(() => ({
    source, connected, brokerOnline, mockMode, entries, loading, error, lastPollAt,
    connect, disconnect, useDemo, verify, triggerRun, recheckHealth,
  }), [source, connected, brokerOnline, mockMode, entries, loading, error, lastPollAt, connect, disconnect, useDemo, verify, triggerRun, recheckHealth]);

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
