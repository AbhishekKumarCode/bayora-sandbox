#!/usr/bin/env node
// Standalone verifier: recomputes the hash chain in logs/audit.log from
// scratch and reports whether it's intact. This is the "Verify Integrity"
// check — it does not trust the broker, it recomputes everything itself.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_PATH = process.argv[2] || path.join(__dirname, "..", "logs", "audit.log");
const GENESIS_HASH = "0".repeat(64);

function hashEntry(prevHash, seq, ts, event, data) {
  const payload = `${prevHash}|${seq}|${ts}|${event}|${JSON.stringify(data)}`;
  return createHash("sha256").update(payload).digest("hex");
}

async function main() {
  const content = await readFile(LOG_PATH, "utf-8");
  const lines = content.split("\n").filter(Boolean);

  if (lines.length === 0) {
    console.log("Audit log is empty — nothing to verify.");
    return;
  }

  let expectedPrevHash = GENESIS_HASH;
  let brokenAt = null;

  for (const [i, line] of lines.entries()) {
    const entry = JSON.parse(line);
    if (entry.prevHash !== expectedPrevHash) {
      brokenAt = { index: i, reason: "prevHash does not match previous entry's hash", entry };
      break;
    }
    const recomputed = hashEntry(entry.prevHash, entry.seq, entry.ts, entry.event, entry.data);
    if (recomputed !== entry.hash) {
      brokenAt = { index: i, reason: "stored hash does not match recomputed hash (data was altered)", entry };
      break;
    }
    expectedPrevHash = entry.hash;
  }

  console.log(`Checked ${lines.length} entries from ${LOG_PATH}`);
  if (brokenAt) {
    console.log(`CHAIN BROKEN at entry #${brokenAt.index} (seq=${brokenAt.entry.seq}): ${brokenAt.reason}`);
    process.exitCode = 1;
  } else {
    console.log(`CHAIN VERIFIED — all ${lines.length} entries are intact and in order.`);
    console.log(`Final hash: ${expectedPrevHash}`);
  }
}

main().catch((err) => {
  console.error("verify-log failed:", err.message);
  process.exitCode = 1;
});
