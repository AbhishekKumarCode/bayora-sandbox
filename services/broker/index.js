import express from "express";
import { randomUUID } from "node:crypto";
import { appendEntry, readAllEntries, verifyChain } from "./audit.js";
import { complete, isMockMode } from "./llm.js";

const RED_TEAM_TOKEN = process.env.RED_TEAM_TOKEN;
const BLUE_TEAM_TOKEN = process.env.BLUE_TEAM_TOKEN;
const AUDIT_TOKEN = process.env.AUDIT_TOKEN;

for (const [name, val] of Object.entries({ RED_TEAM_TOKEN, BLUE_TEAM_TOKEN, AUDIT_TOKEN })) {
  if (!val) throw new Error(`${name} is required — refusing to run with no role authentication`);
}

const app = express();
app.use(express.json());

// Dashboard runs from a plain static file, so the browser sends it as a
// cross-origin request — allow it for the (token-protected) observability
// endpoints only.
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

function requireToken(expected) {
  return (req, res, next) => {
    const got = req.header("authorization")?.replace(/^Bearer\s+/i, "");
    if (got !== expected) {
      return res.status(403).json({ error: "forbidden" });
    }
    next();
  };
}

const PORT = process.env.PORT || 4000;

// In-memory queue of responses waiting for blue-team evaluation.
// Blue team only ever sees { attackId, response } — never the prompt or technique label.
const pendingForBlueTeam = [];
const attacksById = new Map();
const issuedToBlueTeam = new Set(); // attackIds blue-team has actually been handed — /score only accepts these, once each

const KNOWN_VERDICTS = new Set(["blocked", "passed_through", "ambiguous"]);
const TECHNIQUE_PATTERN = /^[a-z0-9_]{1,64}$/; // matches the labels in red-team/attacks.json

app.get("/health", (req, res) => {
  res.json({ ok: true, mockMode: isMockMode() });
});

// Called only by the red-team container, authenticated with RED_TEAM_TOKEN.
app.post("/submit-attack", requireToken(RED_TEAM_TOKEN), async (req, res) => {
  const { technique, prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "prompt is required" });
  if (!technique || !TECHNIQUE_PATTERN.test(technique)) {
    return res.status(400).json({ error: "technique must match ^[a-z0-9_]{1,64}$" });
  }

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

// Called only by the blue-team container, authenticated with BLUE_TEAM_TOKEN.
// Deliberately returns the response text only — never the prompt or technique.
app.get("/pending", requireToken(BLUE_TEAM_TOKEN), (req, res) => {
  if (pendingForBlueTeam.length === 0) {
    return res.json({ item: null });
  }
  const item = pendingForBlueTeam.shift();
  issuedToBlueTeam.add(item.attackId);
  res.json({ item });
});

// Called only by the blue-team container, authenticated with BLUE_TEAM_TOKEN.
// Only accepts a verdict for an attackId that was actually handed out via
// /pending, and only once — prevents a compromised/malicious caller from
// forging or duplicating verdicts for arbitrary attackIds.
app.post("/score", requireToken(BLUE_TEAM_TOKEN), async (req, res) => {
  const { attackId, verdict, confidence, notes } = req.body || {};
  if (!attackId || !verdict) {
    return res.status(400).json({ error: "attackId and verdict are required" });
  }
  if (!KNOWN_VERDICTS.has(verdict)) {
    return res.status(400).json({ error: `verdict must be one of: ${[...KNOWN_VERDICTS].join(", ")}` });
  }
  if (!issuedToBlueTeam.has(attackId)) {
    return res.status(409).json({ error: "unknown attackId, or already scored" });
  }
  issuedToBlueTeam.delete(attackId);
  await appendEntry("blue_team_verdict", { attackId, verdict, confidence, notes });
  res.json({ status: "recorded" });
});

// Observability endpoints — authenticated with AUDIT_TOKEN, which is given
// only to the broker/host, never to the red-team or blue-team containers.
// This is what actually stops blue-team from reading attack prompts out of
// the log even though it's on the same Docker network as the broker.
app.get("/audit", requireToken(AUDIT_TOKEN), async (req, res) => {
  const entries = await readAllEntries();
  res.json({ count: entries.length, entries });
});

app.get("/verify", requireToken(AUDIT_TOKEN), async (req, res) => {
  const result = await verifyChain();
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`[broker] listening on :${PORT} (mockMode=${isMockMode()})`);
});
