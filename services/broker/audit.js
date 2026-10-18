import { createHmac } from "node:crypto";
import { appendFile, readFile, access } from "node:fs/promises";

const LOG_PATH = process.env.AUDIT_LOG_PATH || "/logs/audit.log";
const HMAC_KEY = process.env.AUDIT_HMAC_KEY;
const GENESIS_HASH = "0".repeat(64);

if (!HMAC_KEY) {
  throw new Error("AUDIT_HMAC_KEY is required — refusing to run an unkeyed (forgeable) audit log");
}

// Single in-process write queue so concurrent appends never race on prevHash.
let writeQueue = Promise.resolve();

function hashEntry(prevHash, seq, ts, event, data) {
  const payload = `${prevHash}|${seq}|${ts}|${event}|${JSON.stringify(data)}`;
  return createHmac("sha256", HMAC_KEY).update(payload).digest("hex");
}

async function getLastEntry() {
  try {
    await access(LOG_PATH);
  } catch {
    return { seq: 0, hash: GENESIS_HASH };
  }
  const content = await readFile(LOG_PATH, "utf-8");
  const lines = content.split("\n").filter(Boolean);
  if (lines.length === 0) return { seq: 0, hash: GENESIS_HASH };
  const last = JSON.parse(lines[lines.length - 1]);
  return { seq: last.seq, hash: last.hash };
}

export function appendEntry(event, data) {
  writeQueue = writeQueue.then(async () => {
    const { seq: lastSeq, hash: prevHash } = await getLastEntry();
    const seq = lastSeq + 1;
    const ts = new Date().toISOString();
    const hash = hashEntry(prevHash, seq, ts, event, data);
    const entry = { seq, ts, event, data, prevHash, hash };
    await appendFile(LOG_PATH, JSON.stringify(entry) + "\n", "utf-8");
    return entry;
  });
  return writeQueue;
}

export async function readAllEntries() {
  try {
    await access(LOG_PATH);
  } catch {
    return [];
  }
  const content = await readFile(LOG_PATH, "utf-8");
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

// Server-side chain verification — the HMAC key never leaves the broker/host,
// so this (or verify-log.js on the host) is the only place that can actually
// recompute and confirm the chain. A browser-side check would have to be
// given the key, which would defeat the point of keying it at all.
//
// `simulateTamperSeq` is a demo-only affordance: it mutates the in-memory
// copy of one entry's data before checking, so the dashboard can show what
// detection looks like without ever writing a real tamper to disk. The real
// log file is never touched by this.
export async function verifyChain(simulateTamperSeq) {
  const entries = await readAllEntries();

  if (simulateTamperSeq != null) {
    const target = entries.find((e) => e.seq === simulateTamperSeq);
    if (target) {
      target.data = { ...target.data, _simulatedTamper: true };
    }
  }

  let expectedPrev = GENESIS_HASH;
  for (const entry of entries) {
    if (entry.prevHash !== expectedPrev) {
      return { ok: false, brokenAtSeq: entry.seq, reason: "prevHash mismatch" };
    }
    const recomputed = hashEntry(entry.prevHash, entry.seq, entry.ts, entry.event, entry.data);
    if (recomputed !== entry.hash) {
      return { ok: false, brokenAtSeq: entry.seq, reason: "data was altered" };
    }
    expectedPrev = entry.hash;
  }
  return { ok: true, count: entries.length, finalHash: expectedPrev };
}
