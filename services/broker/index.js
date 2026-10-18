import express from "express";
import { randomUUID } from "node:crypto";
import { appendEntry, readAllEntries } from "./audit.js";
import { complete, isMockMode } from "./llm.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;

// In-memory queue of responses waiting for blue-team evaluation.
// Blue team only ever sees { attackId, response } — never the prompt or technique label.
const pendingForBlueTeam = [];
const attacksById = new Map();

app.get("/health", (req, res) => {
  res.json({ ok: true, mockMode: isMockMode() });
});

// Called only by the red-team container (red-net).
app.post("/submit-attack", async (req, res) => {
  const { technique, prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "prompt is required" });

  const attackId = randomUUID();
  await appendEntry("attack_submitted", { attackId, technique });

  let result;
  try {
    result = await complete(prompt);
  } catch (err) {
    await appendEntry("llm_error", { attackId, error: String(err) });
    return res.status(502).json({ error: "LLM call failed", detail: String(err) });
  }

  await appendEntry("llm_response_received", {
    attackId,
    technique,
    responsePreview: result.text.slice(0, 120),
    mock: result.mock,
  });

  attacksById.set(attackId, { technique, prompt, response: result.text });
  pendingForBlueTeam.push({ attackId, response: result.text });

  res.json({ attackId, status: "logged" });
});

// Called only by the blue-team container (blue-net).
// Deliberately returns the response text only — never the prompt or technique.
app.get("/pending", (req, res) => {
  if (pendingForBlueTeam.length === 0) {
    return res.json({ item: null });
  }
  const item = pendingForBlueTeam.shift();
  res.json({ item });
});

// Called only by the blue-team container (blue-net).
app.post("/score", async (req, res) => {
  const { attackId, verdict, confidence, notes } = req.body || {};
  if (!attackId || !verdict) {
    return res.status(400).json({ error: "attackId and verdict are required" });
  }
  await appendEntry("blue_team_verdict", { attackId, verdict, confidence, notes });
  res.json({ status: "recorded" });
});

// Observability endpoint — reads the audit trail (not reachable by red/blue containers,
// only exposed to the host for the demo dashboard / verify script).
app.get("/audit", async (req, res) => {
  const entries = await readAllEntries();
  res.json({ count: entries.length, entries });
});

app.listen(PORT, () => {
  console.log(`[broker] listening on :${PORT} (mockMode=${isMockMode()})`);
});
