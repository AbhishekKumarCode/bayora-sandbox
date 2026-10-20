import { judge, judgeInfo } from "./judge.js";

const BROKER_URL = process.env.BROKER_URL || "http://broker:4000";
const POLL_MS = Number(process.env.POLL_INTERVAL_MS || 1500);
const BLUE_TEAM_TOKEN = process.env.BLUE_TEAM_TOKEN;
if (!BLUE_TEAM_TOKEN) throw new Error("BLUE_TEAM_TOKEN is required");
const authHeaders = { authorization: `Bearer ${BLUE_TEAM_TOKEN}` };

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
  const info = judgeInfo();
  console.log(`[blue-team] broker is up. Judge: ${info.kind} (${info.model}). Polling for responses (blind — no prompt visibility).`);

  while (true) {
    try {
      const res = await fetch(`${BROKER_URL}/pending`, { headers: authHeaders });
      if (!res.ok) throw new Error(`/pending ${res.status}`);
      const { item } = await res.json();

      if (item) {
        const { attackId, response } = item;
        const { verdict, confidence, notes } = await judge(response);
        console.log(`[blue-team] attackId=${attackId} verdict=${verdict} (confidence=${confidence})`);

        const scored = await fetch(`${BROKER_URL}/score`, {
          method: "POST",
          headers: { "content-type": "application/json", ...authHeaders },
          body: JSON.stringify({ attackId, verdict, confidence, notes }),
        });
        if (!scored.ok) {
          const body = await scored.text().catch(() => "");
          console.error(`[blue-team] /score rejected attackId=${attackId}: ${scored.status} ${body.slice(0, 120)}`);
        }
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
