import { readFile } from "node:fs/promises";

const BROKER_URL = process.env.BROKER_URL || "http://broker:4000";
const DELAY_MS = Number(process.env.ATTACK_DELAY_MS || 2000);
const RED_TEAM_TOKEN = process.env.RED_TEAM_TOKEN;
if (!RED_TEAM_TOKEN) throw new Error("RED_TEAM_TOKEN is required");

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

async function fireAll(attacks) {
  for (const attack of attacks) {
    console.log(`[red-team] firing technique="${attack.technique}"`);
    try {
      const res = await fetch(`${BROKER_URL}/submit-attack`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${RED_TEAM_TOKEN}`,
        },
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
}

async function run() {
  console.log("[red-team] waiting for broker...");
  await waitForBroker();
  console.log("[red-team] broker is up. Loading attack payloads.");

  const raw = await readFile(new URL("./attacks.json", import.meta.url), "utf-8");
  const attacks = JSON.parse(raw);

  await fireAll(attacks);
  console.log("[red-team] boot run done. Waiting for runs requested from the dashboard.");

  // The dashboard's "Start a run" sets a flag on the broker; we claim it here
  // so every run, not just the boot one, crosses the real red-net boundary.
  while (true) {
    try {
      const res = await fetch(`${BROKER_URL}/run-requested`, { headers: { authorization: `Bearer ${RED_TEAM_TOKEN}` } });
      if (res.ok) {
        const { requested } = await res.json();
        if (requested) {
          console.log("[red-team] run requested by the dashboard. Firing.");
          await fireAll(attacks);
          await fetch(`${BROKER_URL}/run-done`, { method: "POST", headers: { authorization: `Bearer ${RED_TEAM_TOKEN}` } }).catch(() => {});
          console.log("[red-team] run done.");
        }
      }
    } catch (err) {
      console.error("[red-team] poll error:", err.message);
    }
    await sleep(2000);
  }
}

run().catch((err) => {
  console.error("[red-team] fatal:", err);
  process.exit(1);
});
