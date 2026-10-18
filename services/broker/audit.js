import { createHash } from "node:crypto";
import { appendFile, readFile, access } from "node:fs/promises";

const LOG_PATH = process.env.AUDIT_LOG_PATH || "/logs/audit.log";
const GENESIS_HASH = "0".repeat(64);

// Single in-process write queue so concurrent appends never race on prevHash.
let writeQueue = Promise.resolve();

function hashEntry(prevHash, seq, ts, event, data) {
  const payload = `${prevHash}|${seq}|${ts}|${event}|${JSON.stringify(data)}`;
  return createHash("sha256").update(payload).digest("hex");
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
