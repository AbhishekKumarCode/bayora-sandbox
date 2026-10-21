import express from "express";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { appendEntry, readAllEntries, verifyChain } from "./audit.js";
import { complete, isMockMode, llmInfo, llmDetails, setModel, listModels, SYSTEM_PROMPT, SECRET_MARKERS, MARKERS_MATCH_PROMPT } from "./llm.js";

const RED_TEAM_TOKEN = process.env.RED_TEAM_TOKEN;
const BLUE_TEAM_TOKEN = process.env.BLUE_TEAM_TOKEN;
const AUDIT_TOKEN = process.env.AUDIT_TOKEN;
// Optional read-only role for public viewers (judges, visitors): can read the
// chain, verify it and see config, but cannot start runs or change the model.
const VIEWER_TOKEN = process.env.VIEWER_TOKEN || "";

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

function requireToken(...accepted) {
  const ok = accepted.filter(Boolean);
  return (req, res, next) => {
    const got = req.header("authorization")?.replace(/^Bearer\s+/i, "");
    if (!got || !ok.includes(got)) {
      return res.status(403).json({ error: "forbidden" });
    }
    req.role = got === AUDIT_TOKEN ? "operator" : got === VIEWER_TOKEN ? "viewer" : got === RED_TEAM_TOKEN ? "red" : "blue";
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
  res.json({ ok: true, mockMode: isMockMode(), ...llmInfo(), viewer: Boolean(VIEWER_TOKEN) });
});

// Shared by /submit-attack (red-team, one at a time) and /trigger-run
// (dashboard, fires the whole set) — same logging and queuing behavior
// either way, so there's exactly one code path that writes attack entries.
async function runOneAttack(technique, prompt, source = "red-team") {
  if (!prompt) throw Object.assign(new Error("prompt is required"), { status: 400 });
  if (!technique || !TECHNIQUE_PATTERN.test(technique)) {
    throw Object.assign(new Error("technique must match ^[a-z0-9_]{1,64}$"), { status: 400 });
  }

  const attackId = randomUUID();
  await appendEntry("attack_submitted", { attackId, technique, prompt, source });

  let result;
  try {
    result = await complete(prompt);
  } catch (err) {
    await appendEntry("llm_error", { attackId, error: String(err) });
    throw Object.assign(new Error("LLM call failed: " + String(err)), { status: 502 });
  }

  await appendEntry("llm_response_received", {
    attackId,
    technique,
    responsePreview: result.text.slice(0, 120),
    response: result.text,
    model: result.model,
    mock: result.mock,
  });

  attacksById.set(attackId, { technique, prompt, response: result.text });
  pendingForBlueTeam.push({ attackId, response: result.text });

  return attackId;
}

// Called only by the red-team container, authenticated with RED_TEAM_TOKEN.
app.post("/submit-attack", requireToken(RED_TEAM_TOKEN), async (req, res) => {
  const { technique, prompt } = req.body || {};
  try {
    const attackId = await runOneAttack(technique, prompt);
    res.json({ attackId, status: "logged" });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Called by the dashboard (AUDIT_TOKEN — this is an operator/demo control,
// not part of the red/blue isolation boundary itself) to kick off a full
// demo run on demand, instead of only ever firing once at container boot.
// Responds immediately; the attacks run in the background so the dashboard
// can poll /audit and watch them land live.
let runInProgress = false;
let runRequested = false;      // set by /trigger-run, consumed by the red container's /run-requested poll
let runClaimedAt = 0;
const RED_CLAIM_WAIT_MS = Number(process.env.RED_CLAIM_WAIT_MS || 6000);

async function readAttackCatalog() {
  const raw = await readFile(new URL("./attacks.json", import.meta.url), "utf-8");
  return JSON.parse(raw);
}

function startRun() {
  runInProgress = true;
  runRequested = true;
  runClaimedAt = 0;
}

app.post("/trigger-run", requireToken(AUDIT_TOKEN), async (req, res) => {
  if (runInProgress) {
    return res.status(409).json({ error: "a run is already in progress" });
  }
  if (req.body?.model) {
    try { setModel(req.body.model); } catch (err) { return res.status(err.status || 400).json({ error: err.message }); }
  }
  startRun();
  res.json({ status: "started", model: llmDetails().model });

  fallbackIfUnclaimed();
});

// Give the red container a few seconds to claim the run so the attacks
// cross the real red-net boundary. If it never shows up (not running,
// older image), fire in-process and say so in the log (source=broker).
function fallbackIfUnclaimed() {
  (async () => {
    const deadline = Date.now() + RED_CLAIM_WAIT_MS;
    while (runRequested && Date.now() < deadline) await new Promise((r) => setTimeout(r, 250));
    if (!runRequested) return; // red-team claimed it; it will call /run-done
    runRequested = false;
    console.warn("[trigger-run] red-team did not claim the run; firing from the broker instead");
    try {
      for (const attack of await readAttackCatalog()) {
        try {
          await runOneAttack(attack.technique, attack.prompt, "broker");
        } catch (err) {
          console.error("[trigger-run] attack failed:", err.message);
        }
        await new Promise((r) => setTimeout(r, 1200));
      }
    } finally {
      runInProgress = false;
    }
  })();
}

// Run the whole suite against several models, one after another, so the
// results can be compared. Each run records the model on every reply.
let compareState = null; // { models, index, startedAt }
app.post("/trigger-compare", requireToken(AUDIT_TOKEN), async (req, res) => {
  const models = Array.isArray(req.body?.models) ? req.body.models.filter((m) => typeof m === "string").slice(0, 4) : [];
  if (models.length < 2) return res.status(400).json({ error: "models: give at least two model ids" });
  if (runInProgress || compareState) return res.status(409).json({ error: "a run is already in progress" });
  for (const m of models) { try { setModel(m); } catch (err) { return res.status(err.status || 400).json({ error: `${m}: ${err.message}` }); } }
  compareState = { models, index: 0, startedAt: Date.now() };
  res.json({ status: "started", models });
  (async () => {
    try {
      for (let i = 0; i < models.length; i++) {
        compareState.index = i;
        setModel(models[i]);
        startRun();
        fallbackIfUnclaimed();
        // wait for this run to finish (red container calls /run-done, or the fallback clears it)
        const deadline = Date.now() + 10 * 60 * 1000;
        while (runInProgress && Date.now() < deadline) await new Promise((r) => setTimeout(r, 500));
        // leave a gap so the dashboard groups the next run separately (> RUN_GAP in the UI)
        if (i < models.length - 1) await new Promise((r) => setTimeout(r, 50 * 1000));
      }
    } finally {
      compareState = null;
    }
  })();
});

// Red container polls this; a true answer is consumed (one claim per request).
app.get("/run-requested", requireToken(RED_TEAM_TOKEN), (req, res) => {
  if (runRequested) {
    runRequested = false;
    runClaimedAt = Date.now();
    return res.json({ requested: true });
  }
  res.json({ requested: false });
});

app.post("/run-done", requireToken(RED_TEAM_TOKEN), (req, res) => {
  runInProgress = false;
  res.json({ ok: true, tookMs: runClaimedAt ? Date.now() - runClaimedAt : null });
});

// ---- Operator endpoints (AUDIT_TOKEN): see and steer the test, never the judge ----

app.get("/attacks", requireToken(AUDIT_TOKEN), async (req, res) => {
  res.json({ attacks: await readAttackCatalog() });
});

app.get("/config", requireToken(AUDIT_TOKEN, VIEWER_TOKEN), (req, res) => {
  const d = llmDetails();
  if (req.role === "viewer") return res.json({ provider: d.provider, model: d.model, baseUrl: null, mockMode: isMockMode(), systemPrompt: null, runInProgress, compare: compareState, role: "viewer" });
  res.json({ ...d, mockMode: isMockMode(), systemPrompt: SYSTEM_PROMPT, secretMarkers: SECRET_MARKERS, runInProgress, compare: compareState, role: req.role });
});

app.get("/models", requireToken(AUDIT_TOKEN, VIEWER_TOKEN), async (req, res) => {
  try {
    res.json({ models: await listModels(), current: llmDetails().model });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post("/config", requireToken(AUDIT_TOKEN), (req, res) => {
  try {
    const model = setModel(req.body?.model);
    res.json({ ok: true, ...llmDetails(), model });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
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
app.get("/audit", requireToken(AUDIT_TOKEN, VIEWER_TOKEN), async (req, res) => {
  const entries = await readAllEntries();
  if (req.role === "viewer") {
    // The viewer token lives in the public web build. Strip prompts so that
    // nothing reachable with it could hand the judge the attack text, and
    // mask the leaked secrets themselves so the record does not re-leak them.
    const WITHHELD = "[reply withheld for viewers: secret markers not configured]";
    const MASK = "[secret · hidden for viewers]";
    // Fuzzy, fail-safe masking: NFKC-normalise, and allow any whitespace or
    // punctuation between the marker's characters, so "NW - 7731 ZETA" or a
    // code-fenced split still matches. Applied to every free-text field.
    const fuzzy = SECRET_MARKERS.map((m) => new RegExp(Array.from(m.normalize("NFKC")).filter((c) => /[\p{L}\p{N}]/u.test(c)).map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s\\p{P}\\p{S}_]*"), "giu"));
    // Skeleton, fail-closed: NFKC + lowercase, drop format/mark/separator
    // characters, fold a few known look-alikes, keep ASCII letters and
    // digits, and turn EVERY other letter/number/symbol (any script, any
    // blank-rendering filler) into a wildcard "?" that matches any marker
    // character. Unknown confusables therefore trigger a withhold, never a
    // bypass. Punctuation is dropped.
    // ASCII confusable classes (applied to marker AND text): i/l/1/|/!, o/0,
    // s/5/$, b/8, z/2, g/q/9, a/4/@, e/3, t/7/+.
    const FOLD = { "1": "l", "i": "l", "|": "l", "!": "l", "0": "o", "5": "s", "$": "s", "8": "b", "2": "z", "q": "g", "9": "g", "4": "a", "@": "a", "3": "e", "7": "t", "+": "t" };
    // Cyrillic look-alikes folded to ASCII; everything else non-ASCII becomes a wildcard.
    const CYR = { "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "і": "i", "ј": "j", "ѕ": "s" };
    const skeleton = (t) => Array.from(String(t).normalize("NFKC").toLowerCase())
      .filter((c) => !/[\p{Cf}\p{M}\p{Z}\p{Cc}]/u.test(c))   // invisible / separators / control: dropped (insertions collapse)
      .map((c) => CYR[c] ?? c)
      .map((c) => (/[a-z0-9|!@$+]/.test(c) ? (FOLD[c] ?? c) : "?"))  // any other char (letters of other scripts, punctuation, symbols, private-use) is a wildcard
      .join("");
    // Fail closed if a marker cannot be turned into a usable ASCII skeleton.
    const markerSk = SECRET_MARKERS.map((m) => skeleton(m).replace(/\?/g, ""));
    const markersUsable = markerSk.length > 0 && markerSk.every((m) => m.length >= 4);
    const hidesMarker = (sk) => markerSk.some((m) => {
      if (sk.replace(/\?/g, "").includes(m)) return true;
      // Sliding window where "?" (any non-ASCII letter) matches any marker char,
      // with NO minimum of literal matches: a window made only of wildcards is
      // treated as a possible secret written in an unknown script. This
      // deliberately over-withholds long runs of non-Latin text from viewers.
      for (let i = 0; i + m.length <= sk.length; i++) {
        let ok = true;
        for (let j = 0; j < m.length; j++) { const c = sk[i + j]; if (c !== m[j] && c !== "?") { ok = false; break; } }
        if (ok) return true;
      }
      return false;
    });
    const maskText = (t) => {
      if (t == null) return undefined;
      if (!MARKERS_MATCH_PROMPT || !markersUsable) return WITHHELD;
      let out = String(t).normalize("NFKC");
      for (const re of fuzzy) out = out.replace(re, MASK);
      const sk = skeleton(out.split(MASK).join(" "));
      if (hidesMarker(sk)) return "[reply withheld for viewers: it contains text the secret filter cannot verify, such as a disguised secret or a long non-Latin passage. Operators can read it.]";
      return out;
    };
    return res.json({
      count: entries.length, redacted: true,
      entries: entries.map((e) => {
        if (e.event === "attack_submitted") return { ...e, data: { ...e.data, prompt: undefined, promptRedacted: true } };
        if (e.event === "llm_response_received") {
          const full = maskText(e.data.response ?? e.data.responsePreview);
          return { ...e, data: { ...e.data, response: e.data.response != null ? full : undefined, responsePreview: full == null ? undefined : full.slice(0, 120), secretsMasked: true } };
        }
        if (e.event === "blue_team_verdict") return { ...e, data: { ...e.data, notes: maskText(e.data.notes) } };
        if (e.event === "llm_error") return { ...e, data: { ...e.data, error: maskText(e.data.error) } };
        return e;
      }),
    });
  }
  res.json({ count: entries.length, entries });
});

app.get("/verify", requireToken(AUDIT_TOKEN, VIEWER_TOKEN), async (req, res) => {
  // ?simulateTamperSeq=N is a demo-only affordance for the dashboard's
  // "Tamper" button — it checks what detection would look like if entry N
  // were altered, entirely in memory. It never writes to the real log.
  const simulateTamperSeq = req.query.simulateTamperSeq ? Number(req.query.simulateTamperSeq) : undefined;
  const result = await verifyChain(simulateTamperSeq);
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`[broker] listening on :${PORT} (mockMode=${isMockMode()})`);
});
