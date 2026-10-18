import { readFile } from "node:fs/promises";

const BROKER_URL = process.env.BROKER_URL || "http://broker:4000";
const DELAY_MS = Number(process.env.ATTACK_DELAY_MS || 2000);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForBroker() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${BROKER_URL}/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await sleep(1000);
  }
  throw new Error("broker never became healthy");
}

async function run() {
  console.log("[red-team] waiting for broker...");
  await waitForBroker();
  console.log("[red-team] broker is up. Loading attack payloads.");

  const raw = await readFile(new URL("./attacks.json", import.meta.url), "utf-8");
  const attacks = JSON.parse(raw);

  for (const attack of attacks) {
    console.log(`[red-team] firing technique="${attack.technique}"`);
    try {
      const res = await fetch(`${BROKER_URL}/submit-attack`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(attack),
      });
      const json = await res.json();
      if (!res.ok) {
        console.error(`[red-team] broker rejected attack:`, json);
      } else {
        console.log(`[red-team] logged as attackId=${json.attackId}`);
      }
    } catch (err) {
      console.error(`[red-team] failed to reach broker:`, err.message);
    }
    await sleep(DELAY_MS);
  }

  console.log("[red-team] all attacks fired. Idling.");
  // An unresolved Promise alone doesn't keep Node's event loop alive once all
  // I/O/timers drain — it just exits "successfully". Loop on a real timer instead.
  while (true) {
    await sleep(60_000);
  }
}

run().catch((err) => {
  console.error("[red-team] fatal:", err);
  process.exit(1);
});
