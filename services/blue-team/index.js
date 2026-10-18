import { classify } from "./classifier.js";

const BROKER_URL = process.env.BROKER_URL || "http://broker:4000";
const POLL_MS = Number(process.env.POLL_INTERVAL_MS || 1500);

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

async function pollLoop() {
  console.log("[blue-team] waiting for broker...");
  await waitForBroker();
  console.log("[blue-team] broker is up. Polling for responses to evaluate (blind — no prompt visibility).");

  while (true) {
    try {
      const res = await fetch(`${BROKER_URL}/pending`);
      const { item } = await res.json();

      if (item) {
        const { attackId, response } = item;
        const { verdict, confidence, notes } = classify(response);
        console.log(`[blue-team] attackId=${attackId} verdict=${verdict} (confidence=${confidence})`);

        await fetch(`${BROKER_URL}/score`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ attackId, verdict, confidence, notes }),
        });
      }
    } catch (err) {
      console.error("[blue-team] poll error:", err.message);
    }
    await sleep(POLL_MS);
  }
}

pollLoop().catch((err) => {
  console.error("[blue-team] fatal:", err);
  process.exit(1);
});
