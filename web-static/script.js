"use strict";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

// --- Real broker connection ---------------------------------------------
// No build step here (see README.txt), so this can't be injected from an
// env var the way the React app does it — update this when the tunnel URL
// changes. CORS is wide open on the broker (Access-Control-Allow-Origin: *)
// so this works from any origin, including a static file:// page.
const BROKER_URL = "https://meal-argued-successful-gentle.trycloudflare.com";

// Seed the token from a one-off ?token= link for local testing convenience
// only (never share a URL with a token in it — browser history/logs keep
// it). Strip it from the address bar immediately after reading it once.
(function seedTokenFromUrl() {
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get("token");
  if (fromUrl) {
    sessionStorage.setItem("bayora_audit_token", fromUrl);
    url.searchParams.delete("token");
    window.history.replaceState({}, "", url.toString());
  }
})();

function hasAuditToken() {
  return !!sessionStorage.getItem("bayora_audit_token");
}
function getAuditToken() {
  // Only ever prompts in response to an explicit user action (the Connect
  // button, or Verify/trigger-run) — never on page load. window.prompt()
  // blocks all JS until answered, so calling it automatically on load would
  // hang any non-interactive context (headless testing, embedded iframes).
  let token = sessionStorage.getItem("bayora_audit_token") || "";
  if (!token) {
    token = window.prompt("Enter AUDIT_TOKEN (from the broker's .env file):") || "";
    if (token) sessionStorage.setItem("bayora_audit_token", token);
  }
  return token;
}
function authHeaders() {
  return { authorization: `Bearer ${getAuditToken()}` };
}
async function fetchHealth() {
  const res = await fetch(`${BROKER_URL}/health`);
  if (!res.ok) throw new Error(`health check failed: ${res.status}`);
  return res.json();
}
async function fetchAudit() {
  const res = await fetch(`${BROKER_URL}/audit`, { headers: authHeaders() });
  if (res.status === 403) { sessionStorage.removeItem("bayora_audit_token"); throw new Error("forbidden — bad AUDIT_TOKEN"); }
  if (!res.ok) throw new Error(`audit fetch failed: ${res.status}`);
  return res.json();
}
async function verifyChainReal(simulateTamperSeq) {
  const qs = simulateTamperSeq != null ? `?simulateTamperSeq=${simulateTamperSeq}` : "";
  const res = await fetch(`${BROKER_URL}/verify${qs}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`verify failed: ${res.status}`);
  return res.json();
}
async function triggerRunReal() {
  const res = await fetch(`${BROKER_URL}/trigger-run`, { method: "POST", headers: authHeaders() });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `trigger-run failed: ${res.status}`);
  return json;
}

const KNOWN_VERDICTS = new Set(["blocked", "passed_through", "ambiguous"]);
function roomOf(event) {
  if (event === "attack_submitted") return "attacker";
  if (event === "llm_response_received" || event === "llm_error") return "model";
  if (event === "blue_team_verdict") return "defender";
  return "hallway";
}
function computeStats(entries) {
  const attacksTested = entries.filter((e) => e.event === "attack_submitted").length;
  const verdicts = entries.filter((e) => e.event === "blue_team_verdict");
  const caught = verdicts.filter((e) => e.data.verdict === "blocked").length;
  const gotThrough = verdicts.filter((e) => e.data.verdict === "passed_through").length;
  const unsure = verdicts.filter((e) => e.data.verdict === "ambiguous").length;
  const catchRate = verdicts.length ? Math.round((caught / verdicts.length) * 100) : 0;
  // Illustrative only — see docs/PRD.md Open Questions #1 in the main repo.
  const illustrativeLeakyRate = Math.min(95, catchRate + 35);
  return { attacksTested, caught, gotThrough, unsure, verdictsSoFar: verdicts.length, catchRate, illustrativeLeakyRate };
}
function entryToEventRow(e) {
  if (e.event === "attack_submitted") return { time: fmtTime(e.ts), type: "ATTACK", detail: `technique: ${e.data.technique}`, tone: "red" };
  if (e.event === "llm_response_received") return { time: fmtTime(e.ts), type: "RESPONSE", detail: `${e.data.mock ? "[mock] " : ""}${e.data.responsePreview ?? ""}`, tone: "blue" };
  if (e.event === "llm_error") return { time: fmtTime(e.ts), type: "ERROR", detail: String(e.data.error ?? ""), tone: "red" };
  if (e.event === "blue_team_verdict") {
    const v = KNOWN_VERDICTS.has(e.data.verdict) ? e.data.verdict : "ambiguous";
    const type = v === "blocked" ? "CAUGHT" : v === "passed_through" ? "GOT THROUGH" : "UNSURE";
    const tone = v === "blocked" ? "green" : v === "passed_through" ? "orange" : "gray";
    return { time: fmtTime(e.ts), type, detail: `confidence: ${e.data.confidence}`, tone };
  }
  return { time: fmtTime(e.ts), type: "SYSTEM", detail: e.event, tone: "gray" };
}
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour12: false });
}

const state = {
  page: "overview",
  running: true,
  eventFilter: "All events",
  attackFilter: "All",
  roomTab: "Architecture",
  enabledControls: [true, true, true, false, true, false],
  settings: { workspace: "Bayora Sandbox", retention: "30 days", strictIsolation: true, resourceAlerts: true, notifications: true },
  search: "",
  entries: [],
  connected: null,
  mockMode: null,
  verifyResult: null,
  tamperArmed: false
};

function updateOnlinePill() {
  const dot = $("#onlineDot"), label = $("#onlineLabel"), clock = $("#onlineClock");
  if (!dot) return;
  dot.className = `dot ${state.connected ? "green" : ""}`;
  label.textContent = state.connected === null ? "Connecting…" : state.connected ? (hasAuditToken() ? (state.mockMode ? "Mock mode" : "Live") : "Connected (read-only)") : "Broker unreachable";
  clock.textContent = new Date().toLocaleTimeString([], { hour12: false });
  const connectBtn = $("#connectBroker");
  if (connectBtn) connectBtn.textContent = hasAuditToken() ? "Reconnect" : "Connect broker";
}
setInterval(() => { const c = $("#onlineClock"); if (c) c.textContent = new Date().toLocaleTimeString([], { hour12: false }); }, 1000);

async function pollBroker() {
  try {
    const health = await fetchHealth();
    state.connected = true;
    state.mockMode = health.mockMode;
    if (hasAuditToken()) {
      const audit = await fetchAudit();
      state.entries = audit.entries;
    }
  } catch {
    state.connected = false;
  }
  updateOnlinePill();
  if (["overview", "live-testing", "audit-logs"].includes(state.page)) render();
}
async function connectBroker() {
  getAuditToken(); // prompts if needed — this is a real user click, so that's fine
  await pollBroker();
}
pollBroker();
setInterval(pollBroker, 2000);

const titles = {
  overview: ["Overview", "A clear view of your AI safety posture."],
  "live-testing": ["Live Testing", "Monitor evaluation runs and inspect outcomes as they happen."],
  "attack-library": ["Attack Library", "Organize adversarial techniques and reusable test cases."],
  "defense-lab": ["Defense Lab", "Review defensive policies and the coverage they provide."],
  "audit-logs": ["Audit Logs", "Trace every event through a tamper-evident evidence trail."],
  analytics: ["Analytics", "Understand safety performance across evaluation runs."],
  reports: ["Reports", "Review and export evaluation findings."],
  settings: ["Settings", "Configure your workspace and sandbox preferences."],
  "testing-rooms": ["Testing Rooms", "Manage isolated environments for each participant."]
};

const attacks = [
  {name:"Prompt leak attempt",category:"Prompt injection",severity:"High",status:"Blocked",id:"ATK-1042",date:"Today, 12:14:32"},
  {name:"Hypothetical framing",category:"Jailbreak",severity:"Medium",status:"Caught",id:"ATK-1041",date:"Today, 12:14:27"},
  {name:"Roleplay boundary test",category:"Roleplay",severity:"Medium",status:"Passed",id:"ATK-1040",date:"Today, 12:13:58"},
  {name:"Sensitive data extraction",category:"Data exfiltration",severity:"Critical",status:"Blocked",id:"ATK-1039",date:"Today, 12:12:14"},
  {name:"Instruction override",category:"Jailbreak",severity:"High",status:"Caught",id:"ATK-1038",date:"Today, 12:10:06"},
  {name:"System prompt probing",category:"Prompt injection",severity:"High",status:"Blocked",id:"ATK-1037",date:"Today, 12:08:41"}
];

const defenses = [
  ["Prompt filtering","Detect and reject unsafe instruction patterns.","80%","Strong coverage"],
  ["Policy enforcement","Apply task and policy constraints before inference.","70%","Good coverage"],
  ["Output monitoring","Inspect generated responses for policy violations.","65%","Moderate coverage"],
  ["Behavioral classifier","Score model behavior against expected boundaries.","60%","Moderate coverage"],
  ["Rate limiting","Restrict repeated high-risk request sequences.","55%","Partial coverage"],
  ["Anomaly detection","Identify unusual traffic and cross-boundary behavior.","50%","Partial coverage"]
];

function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function toast(message) {
  $("#toastMessage").textContent = message;
  $("#toast").classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.add("hidden"), 2800);
}
function badge(text, tone="gray") {
  return `<span class="status-badge ${tone}"><span>●</span>${esc(text)}</span>`;
}
function card(title, subtitle, body, action="") {
  return `<section class="card"><div class="card-header"><div><h3>${title}</h3>${subtitle ? `<p>${subtitle}</p>` : ""}</div>${action}</div>${body}</section>`;
}
function metric(icon,label,value,note,color="blue",trend="") {
  return `<div class="metric-card metric-${color}"><div class="metric-top"><span class="metric-icon">${icon}</span>${trend ? `<span class="metric-trend">${trend}</span>` : ""}</div><div class="metric-label">${label}</div><div class="metric-value">${value}</div><div class="metric-note">${note}</div></div>`;
}
function progressList(items, percentage=false) {
  return `<div class="progress-list">${items.map(([label,value,width,color]) => `<div class="progress-row"><span class="progress-label">${esc(label)}</span><div class="progress-track"><span class="progress-fill fill-${color}" style="width:${Number(width)}%"></span></div><span class="progress-value">${esc(value)}</span></div>`).join("")}</div>`;
}
function liveEventRows() {
  return [...state.entries].reverse().map(entryToEventRow);
}
function events(filter="All events", compact=false) {
  const all = liveEventRows();
  const rows = filter === "All events" ? all : all.filter(e => e.type === filter);
  return `<div class="event-list ${compact ? "compact" : ""}">${rows.slice(0,compact ? 6 : 8).map(e => `<div class="event-row"><span class="event-time">${e.time}</span><span class="event-tag ${e.tone}">${e.type}</span><span class="event-detail">${esc(e.detail)}</span></div>`).join("") || `<div class="empty-state">${all.length ? "No events match this filter." : "No events yet — start a run."}</div>`}</div>`;
}
function resource(label,value,detail,color,icon) {
  return `<div class="resource-card"><div class="resource-top"><span>${label}</span><span>${icon}</span></div><div class="resource-middle"><div class="donut donut-${color}" style="--value:${value*3.6}deg"><span>${value}%</span></div><div class="resource-detail"><strong>${value}%</strong><span>${detail}</span></div></div></div>`;
}
function miniArchitecture() {
  return `<div class="architecture-mini"><div class="arch-grid"></div><div class="arch-connection red-line"></div><div class="arch-connection blue-line"></div>
    <div class="arch-node arch-attacker"><div class="node-cube red-cube">◎</div><strong>Attacker Room</strong><span>Adversarial agent</span><em>ISOLATED</em></div>
    <div class="arch-node arch-model"><div class="node-cube purple-cube">⬡</div><strong>Model under test</strong><span>Client LLM</span><em>ISOLATED</em></div>
    <div class="arch-node arch-defender"><div class="node-cube blue-cube">⬢</div><strong>Defender Room</strong><span>Safety agent</span><em>ISOLATED</em></div>
    <div class="arch-lock lock-one">♙</div><div class="arch-lock lock-two">♙</div><div class="arch-caption"><span class="dot green"></span> Separate execution boundaries · No cross-tenant access</div></div>`;
}
function recentFromEntries() {
  const attacks = state.entries.filter((e) => e.event === "attack_submitted").slice(-5).reverse();
  return attacks.map((a) => {
    const verdict = state.entries.find((e) => e.event === "blue_team_verdict" && e.seq > a.seq);
    const v = verdict ? (KNOWN_VERDICTS.has(verdict.data.verdict) ? verdict.data.verdict : "ambiguous") : null;
    const label = v === "blocked" ? "Blocked" : v === "passed_through" ? "Got through" : v === "ambiguous" ? "Unsure" : "Pending";
    const tone = v === "blocked" ? "green" : v === "passed_through" ? "orange" : "gray";
    return [`#${a.seq}`, a.data.technique, label, tone, fmtTime(a.ts)];
  });
}
function techniqueDistribution() {
  const counts = {};
  for (const e of state.entries) if (e.event === "attack_submitted") counts[e.data.technique] = (counts[e.data.technique] ?? 0) + 1;
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, n]) => n));
  const colors = ["red", "orange", "amber", "gray", "gray", "gray"];
  return entries.slice(0, 6).map(([name, n], i) => [name, n, Math.round((n / max) * 100), colors[i] ?? "gray"]);
}
function overview() {
  const stats = computeStats(state.entries);
  const recent = recentFromEntries();
  const dist = techniqueDistribution();
  return `<section class="hero-panel"><div class="hero-copy"><div class="hero-kicker">✧ TRUST, MADE VERIFIABLE</div><h2>Test the limits.<br><span>Make AI safer.</span></h2><p>Run adversarial evaluations in a controlled environment. Understand what failed, what held, and why.</p><div class="hero-actions"><button class="btn btn-dark" data-action="open-run">▶ Start new run　→</button><button class="btn btn-secondary" data-page="testing-rooms">View testing rooms　→</button></div><div class="hero-footnote">⬡ Isolated by design <span></span> Tamper-evident by default</div></div>${miniArchitecture()}</section>
  <div class="metric-grid">${metric("◎","Attacks tested",stats.attacksTested,`Across ${dist.length} techniques`,"red")}${metric("⬡","Attacks caught",stats.caught,`${stats.catchRate}% catch rate`,"blue")}${metric("⛨","Gap if unsealed",`${stats.illustrativeLeakyRate - stats.catchRate} pts`,"Illustrative — see Settings","purple")}${metric("▣","Verdicts scored",`${stats.verdictsSoFar}/${stats.attacksTested}`,stats.attacksTested ? `${Math.round((stats.verdictsSoFar/stats.attacksTested)*100)}% evaluated` : "0% evaluated","green")}</div>
  <div class="overview-grid">
    <section class="card health-card"><div class="card-header"><div><h3>Broker connection</h3><p>Live status of the real backend this dashboard talks to.</p></div><span class="inline-good"><span class="dot ${state.connected ? "green" : ""}"></span>${state.connected === null ? "Connecting…" : state.connected ? "Broker reachable" : "Broker unreachable"}</span></div><div class="resource-grid">${resource("Mode",state.mockMode ? 0 : 100,state.mockMode ? "Mock LLM responses" : "Live LLM API","orange","◉")}${resource("Attacks run",Math.min(100,stats.attacksTested*5),`${stats.attacksTested} total`,"blue","▣")}${resource("Catch rate",stats.catchRate,"blind evaluation","green","⌁")}${resource("Scored",stats.attacksTested ? Math.round((stats.verdictsSoFar/stats.attacksTested)*100) : 0,`${stats.verdictsSoFar} / ${stats.attacksTested}`,"purple","▤")}</div></section>
    ${card("Recent attacks","Real attacks from this session, newest first.",recent.length ? `<div class="run-list">${recent.map(r=>`<div class="run-row"><span class="run-id">${r[0]}</span><span class="run-name">${r[1]}</span>${badge(r[2],r[3])}<span class="run-time">${r[4]}</span></div>`).join("")}</div>` : `<div class="empty-state">No attacks run yet this session.</div>`,`<button class="text-action" data-page="live-testing">View all →</button>`)}
    ${card("Attack techniques used","Real technique counts from this session.",dist.length ? progressList(dist.map(([n,count,w,c])=>[n,String(count),w,c])) : `<div class="empty-state">No attacks run yet.</div>`,`<button class="text-action" data-page="attack-library">View library →</button>`)}
    ${card("Defense coverage","Sample data — no defense-control backend exists yet.",progressList([["Prompt filtering","80%",80,"blue"],["Policy enforcement","70%",70,"blue"],["Output monitoring","65%",65,"purple"],["Behavioral classifier","60%",60,"purple"],["Rate limiting","55%",55,"lavender"],["Anomaly detection","50%",50,"lavender"]],true),`<button class="text-action" data-page="defense-lab">View controls →</button>`)}
    ${card("Latest audit events","Real events from the broker's audit log.",events("All events",true),`<button class="text-action" data-page="audit-logs">Audit trail →</button>`)}
  </div><div class="prototype-note">⚠ <span><b>What's real here:</b> attack/caught/verdict counts, recent attacks, technique distribution, and the audit event feed are live from the broker. <b>What's still sample:</b> the Defense coverage panel — there's no defense-control backend yet.</span></div>`;
}
function liveTesting() {
  const stats = computeStats(state.entries);
  const verdictLabel = stats.verdictsSoFar === 0 ? "No data yet" : stats.catchRate >= 80 ? "Looking solid" : stats.catchRate >= 50 ? "Needs attention" : "High risk";
  const verdictTone = stats.verdictsSoFar === 0 ? "gray" : stats.catchRate >= 80 ? "green" : stats.catchRate >= 50 ? "orange" : "red";
  return `<div class="toolbar-row"><div class="segmented"><button class="selected">Current session</button><button data-action="history">Run history</button></div><div class="toolbar-actions"><span class="live-label"><span class="dot ${state.connected?"green":""}"></span>${state.connected?"Live stream active":"Broker unreachable"}</span><button class="btn btn-secondary" data-action="open-run">▶ Start new run</button></div></div>
  <div class="live-layout"><div class="live-main">
    ${card("Evaluation session",`Session #HILL-001${state.mockMode ? " · mock LLM" : " · live LLM"}`,`<div class="run-summary-grid"><div><span>Attack cases</span><strong>${stats.attacksTested}</strong></div><div><span>Evaluated</span><strong>${stats.verdictsSoFar}<small>/${stats.attacksTested}</small></strong></div><div><span>Catch rate</span><strong>${stats.catchRate}%</strong></div><div><span>Status</span><strong>${state.connected ? "Live" : "Offline"}</strong></div></div><div class="run-progress-head"><span>Evaluation progress</span><b>${stats.attacksTested ? Math.round((stats.verdictsSoFar/stats.attacksTested)*100) : 0}%</b></div><div class="wide-progress"><span style="width:${stats.attacksTested ? Math.round((stats.verdictsSoFar/stats.attacksTested)*100) : 0}%"></span></div><div class="pipeline"><div class="pipeline-step red-step"><span>◎</span><b>Attacker</b><small>Adversarial prompts</small>${badge("Isolated","red")}</div><div class="pipeline-arrow">→<small>Answer only</small></div><div class="pipeline-step purple-step"><span>⬡</span><b>Model under test</b><small>Client LLM</small>${badge("Isolated","purple")}</div><div class="pipeline-arrow">→<small>Blind verdict</small></div><div class="pipeline-step blue-step"><span>⬢</span><b>Defender</b><small>Safety evaluation</small>${badge("Isolated","blue")}</div></div>`)}
    ${card("Live event stream","Real events from the broker's audit log, polled every 2s.",`<div class="table-toolbar"><div class="filter-pills">${["All events","ATTACK","RESPONSE","CAUGHT","GOT THROUGH","UNSURE"].map(f=>`<button class="${state.eventFilter===f?"chosen":""}" data-event-filter="${f}">${f}</button>`).join("")}</div></div>${events(state.eventFilter)}`)}
  </div><div class="live-side">
    ${card("Run verdict","Blind evaluation summary — real, computed from scored verdicts.",`<div class="verdict-score"><div class="score-ring" style="background:conic-gradient(#21bd83 0 ${stats.catchRate}%,#e9eef6 ${stats.catchRate}%)"><span>${stats.catchRate}%</span></div><div><strong>${verdictLabel}</strong><p>${stats.gotThrough} test case${stats.gotThrough===1?"":"s"} got through in this session.</p>${badge(`${stats.gotThrough} escaped`,verdictTone)}</div></div><div class="mini-stat-list"><div><span>Blocked by defense</span><b>${stats.caught}</b></div><div><span>Reached model</span><b>${stats.gotThrough}</b></div><div><span>Verdicts recorded</span><b>${stats.verdictsSoFar} / ${stats.attacksTested}</b></div></div>`)}
    ${card("Session metadata","",`<div class="meta-row"><span>Session ID</span><b>#HILL-001</b></div><div class="meta-row"><span>Broker</span><b>${state.connected ? "Connected" : "Unreachable"}</b></div><div class="meta-row"><span>Model</span><b>${state.mockMode ? "Mock LLM" : "Live LLM API"}</b></div><div class="meta-row"><span>Isolation</span><b>Separate Docker networks</b></div><div class="meta-row"><span>Audit integrity</span><b>HMAC chained</b></div>`)}
    ${card("Quick actions","",`<button class="action-row" data-action="export">⇩ Export audit log (CSV) <span class="right">→</span></button><button class="action-row" data-action="verify">◎ Verify audit trail <span class="right">→</span></button><button class="action-row" data-action="copy-run">▢ Copy session ID <span class="right">→</span></button>`)}
  </div></div><div class="prototype-note">⚠ Pipeline stage labels and layout are illustrative; the numbers above (attack cases, catch rate, verdict counts) are live from the real broker.</div>`;
}
function attackLibrary() {
  const filtered = attacks.filter(a => {
    const q=state.search.toLowerCase();
    return `${a.name} ${a.category} ${a.id} ${a.status}`.toLowerCase().includes(q) && (state.attackFilter==="All" || a.category===state.attackFilter || a.status===state.attackFilter);
  });
  return `<div class="summary-strip"><div><span>Saved techniques</span><strong>48</strong></div><div><span>Critical severity</span><strong>06</strong></div><div><span>Used this week</span><strong>124</strong></div><div><span>Last library sync</span><strong>Today, 11:58</strong></div></div>
  <section class="card"><div class="card-header"><div><h3>Attack techniques</h3><p>Search, filter and inspect reusable adversarial test cases.</p></div><button class="btn btn-primary" data-action="add-technique">＋ Add technique</button></div>
  <div class="table-toolbar"><div class="table-search">⌕ <input id="attackSearch" type="search" placeholder="Search attacks…" value="${esc(state.search)}"></div><div class="filter-pills">${["All","Jailbreak","Prompt injection","Roleplay","Blocked","Caught"].map(f=>`<button class="${state.attackFilter===f?"chosen":""}" data-attack-filter="${f}">${f}</button>`).join("")}</div></div>
  <div class="data-table-wrap"><table class="data-table"><thead><tr><th>Technique</th><th>Category</th><th>Severity</th><th>Last outcome</th><th>Last tested</th><th></th></tr></thead><tbody>${filtered.map(a=>`<tr><td><div class="table-primary">${a.name}</div><div class="table-secondary">${a.id}</div></td><td>${a.category}</td><td>${badge(a.severity,a.severity==="Critical"||a.severity==="High"?"red":"gray")}</td><td>${badge(a.status,a.status==="Passed"?"gray":"green")}</td><td>${a.date}</td><td><button class="icon-button small" data-action="attack-details" data-name="${esc(a.name)}">···</button></td></tr>`).join("")}</tbody></table>${filtered.length? "":`<div class="empty-state">No matching techniques. Try another keyword or filter.</div>`}</div><div class="table-footer"><span>Showing ${filtered.length} of 48 techniques · sample data</span><span>‹　<b>1</b>　2　›</span></div></section>`;
}
function defenseLab() {
  return `<div class="metric-grid three-metrics">${metric("⬡","Active controls",`${state.enabledControls.filter(Boolean).length}/6`,"Enabled in this workspace","blue")}${metric("◎","Coverage score","68%","Weighted sample estimate","purple")}${metric("⚠","Open gaps","4","Controls need review","orange")}</div><div class="content-grid-two">
  ${card("Defense controls","Toggle controls in this local UI prototype.",`<div class="defense-list">${defenses.map((d,i)=>`<div class="defense-item"><span class="defense-symbol">⬡</span><div class="defense-copy"><b>${d[0]}</b><p>${d[1]}</p><span>${d[3]} · ${d[2]}</span></div><button class="toggle ${state.enabledControls[i]?"on":""}" data-toggle-defense="${i}" aria-label="Toggle ${d[0]}"><span></span></button></div>`).join("")}</div>`,`<button class="btn btn-secondary" data-action="enable-all">Enable all</button>`)}
  <div class="stacked-cards">${card("Coverage by control","",progressList(defenses.map((d,i)=>[d[0],d[2],parseInt(d[2]),i<2?"blue":"purple"]),true))}${card("Policy integrity","",`<div class="integrity-card"><div class="integrity-icon">◎</div><div><b>Policy snapshot verified</b><p>Latest checksum matches the saved configuration.</p><span class="table-secondary">sha256: 9d2a…7f01</span></div></div><button class="btn btn-secondary btn-full" data-action="verify-policy">Verify policy snapshot →</button>`)}</div></div><div class="prototype-note">⚠ Control toggles are local UI state only; they do not change actual model defenses.</div>`;
}
function auditLogs() {
  const all = liveEventRows();
  const rows = state.eventFilter==="All events" ? all : all.filter(e=>e.type===state.eventFilter);
  const r = state.verifyResult;
  const bannerBadge = r === null ? badge("Not yet verified","gray") : r.ok ? badge(`Chain verified · ${r.count} entries`,"green") : badge(`Broken at seq=${r.brokenAtSeq}`,"red");
  const bannerDesc = r === null ? "Events are HMAC-chained so tampering with a past entry is detectable — click Verify to check it right now." : r.ok ? `Recomputed server-side: all ${r.count} entries intact.` : `Recomputed server-side: ${r.reason} at seq=${r.brokenAtSeq}.`;
  return `<div class="audit-integrity-banner"><div class="integrity-icon">◎</div><div><strong>Tamper-evident audit trail</strong><p>${bannerDesc}</p></div>${bannerBadge}<button class="btn btn-secondary" data-action="${state.tamperArmed ? "verify-tamper" : "verify"}">${state.tamperArmed ? "Verify (tamper armed)" : "Verify chain"} ✓</button><button class="btn btn-secondary" data-action="toggle-tamper">${state.tamperArmed ? "Disarm tamper" : "Arm tamper simulation"}</button></div><section class="card"><div class="card-header"><div><h3>Audit events</h3><p>Real event records from the broker's audit log, polled every 2s.</p></div><button class="btn btn-secondary" data-action="export">⇩ Export CSV</button></div><div class="table-toolbar"><div class="filter-pills">${["All events","ATTACK","RESPONSE","CAUGHT","GOT THROUGH","UNSURE"].map(f=>`<button class="${state.eventFilter===f?"chosen":""}" data-event-filter="${f}">${f}</button>`).join("")}</div><span class="eyebrow">SESSION #HILL-001</span></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Timestamp</th><th>Event</th><th>Details</th><th>Integrity</th><th>Session</th></tr></thead><tbody>${rows.length ? rows.map(e=>`<tr><td class="mono">${e.time}</td><td><span class="event-tag ${e.tone}">${e.type}</span></td><td>${esc(e.detail)}</td><td class="hash-ok">✓ Chained</td><td class="mono">HILL-001</td></tr>`).join("") : `<tr><td colspan="5" class="mono">No events yet — start a run.</td></tr>`}</tbody></table></div></section><div class="prototype-note">⚠ Verify recomputes the full HMAC chain server-side. "Arm tamper simulation" makes the next Verify report a break at a real entry, as a safe in-memory demo — it never touches the real log file.</div>`;
}
function analytics() {
  const data=[["Mon",42,12],["Tue",51,10],["Wed",47,16],["Thu",65,9],["Fri",59,13],["Sat",74,7],["Sun",68,8]];
  return `<div class="metric-grid">${metric("◎","Total test cases","428","Across sample runs","blue","↗ 18%")}${metric("⬡","Catch rate","86.4%","Weighted sample result","green")}${metric("⚠","Escaped prompts","58","Requires investigation","red")}${metric("◷","Avg. run time","2m 41s","Across 24 runs","purple")}</div><div class="analytics-grid">${card("Safety outcomes","Caught vs. escaped test cases over the last seven days.",`<div class="chart-legend"><span><i class="blue"></i>Caught</span><span><i class="red"></i>Escaped</span></div><div class="chart-area"><div class="css-chart">${data.map(d=>`<div class="chart-column"><div class="bars"><span class="bar-caught" style="height:${d[1]*2}px"></span><span class="bar-escaped" style="height:${d[2]*2}px"></span></div><span>${d[0]}</span></div>`).join("")}</div></div>`)}${card("Technique frequency","Observed attack types in sample runs.",`<div class="bar-chart">${[["Jailbreak",42],["Injection",31],["Roleplay",24],["Exfiltration",17],["Leakage",12]].map(d=>`<div class="bar-row"><span>${d[0]}</span><div class="progress-track"><span class="progress-fill fill-blue" style="width:${d[1]*2}%"></span></div><b>${d[1]}</b></div>`).join("")}</div>`)}</div><div class="content-grid-two">${card("Risk by category","Prioritize categories with lower detection rates.",progressList([["Prompt injection","High",82,"red"],["System prompt leakage","High",76,"red"],["Data exfiltration","Elevated",62,"orange"],["Jailbreak prompts","Moderate",45,"amber"],["Roleplay framing","Lower",28,"green"]],true))}${card("Evaluation notes","",`<div class="insight-list"><div><span class="insight-icon">⚠</span><div><b>Prompt injection is the leading gap</b><p>Review instruction hierarchy and untrusted input handling.</p></div></div><div><span class="insight-icon">⬡</span><div><b>Output checks remain important</b><p>Defense-in-depth helps reduce single-control failures.</p></div></div><div><span class="insight-icon">◉</span><div><b>Re-test after policy changes</b><p>Use a repeatable suite to compare outcomes.</p></div></div></div>`)}</div><div class="prototype-note">⚠ All charts use illustrative sample data.</div>`;
}
function reports() {
  const data=[["RPT-2026-014","Adversarial safety evaluation","Oct 20, 2026","20 test cases","Ready"],["RPT-2026-013","Prompt injection assessment","Oct 18, 2026","48 test cases","Ready"],["RPT-2026-012","Model baseline review","Oct 16, 2026","32 test cases","Ready"],["RPT-2026-011","Defense policy regression","Oct 14, 2026","26 test cases","Draft"]];
  return `<div class="report-hero"><div class="report-hero-icon">▣</div><div><div class="eyebrow">EVIDENCE-LED EVALUATION</div><h2>Turn test runs into decisions.</h2><p>Review safety outcomes, document residual risk, and share repeatable evidence with your team.</p></div><button class="btn btn-primary" data-action="create-report">＋ Create report</button></div><div class="summary-strip"><div><span>Total reports</span><strong>14</strong></div><div><span>Ready to export</span><strong>11</strong></div><div><span>Drafts</span><strong>3</strong></div><div><span>Last generated</span><strong>Today, 12:10</strong></div></div><section class="card"><div class="card-header"><div><h3>Evaluation reports</h3><p>Sample reports generated from evaluation runs.</p></div><button class="btn btn-secondary" data-action="export">⇩ Export archive</button></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Report</th><th>Created</th><th>Scope</th><th>Status</th><th>Actions</th></tr></thead><tbody>${data.map(r=>`<tr><td><div class="table-primary">${r[1]}</div><div class="table-secondary">${r[0]}</div></td><td>${r[2]}</td><td>${r[3]}</td><td>${badge(r[4],r[4]==="Ready"?"green":"orange")}</td><td><button class="icon-button small" data-action="report-preview" data-name="${r[1]}">↗</button> <button class="icon-button small" data-action="export">⇩</button></td></tr>`).join("")}</tbody></table></div></section>`;
}
function settingsPage() {
  return `<div class="settings-layout"><div class="settings-nav"><button class="selected">⚙ General</button><button data-action="settings-security">⬡ Security</button><button data-action="settings-notifications">♧ Notifications</button><button data-action="settings-team">♙ Team & access</button></div><div class="settings-content">${card("Workspace","Basic details for this Bayora workspace.",`<label class="form-label">Workspace name<input class="form-input" id="workspaceName" value="${esc(state.settings.workspace)}"></label><label class="form-label">Audit log retention<select class="form-input" id="retention"><option ${state.settings.retention==="7 days"?"selected":""}>7 days</option><option ${state.settings.retention==="30 days"?"selected":""}>30 days</option><option ${state.settings.retention==="90 days"?"selected":""}>90 days</option><option ${state.settings.retention==="180 days"?"selected":""}>180 days</option></select></label>`)}${card("Security preferences","Prototype toggles only; enforcement requires backend integration.",[["strictIsolation","Strict isolation profile","Use dedicated boundaries between red team, model, and defender."],["resourceAlerts","Resource usage alerts","Surface warnings when sandbox resource limits are approached."],["notifications","Activity notifications","Show updates for completed runs and audit events."]].map(([id,title,desc])=>`<div class="preference-row"><div><b>${title}</b><p>${desc}</p></div><button class="toggle ${state.settings[id]?"on":""}" data-setting-toggle="${id}"><span></span></button></div>`).join(""))}<div class="settings-save"><span>Changes are stored in this browser session only.</span><button class="btn btn-primary" data-action="save-settings">Save changes</button></div></div></div>`;
}
function testingRooms() {
  const rooms=[{id:"attacker",name:"Attacker Room",role:"Red-team agent",desc:"Executes adversarial prompts against the model under test.",color:"red",icon:"◎",network:"Outbound to broker only",resources:"1 CPU · 1 GB RAM"},{id:"model",name:"Model Under Test",role:"Client LLM",desc:"Runs the target model with clean, isolated inference context.",color:"purple",icon:"⬡",network:"Broker-mediated inference",resources:"2 CPU · 4 GB RAM"},{id:"defender",name:"Defender Room",role:"Blue-team agent",desc:"Evaluates model responses without access to attacker prompt storage.",color:"blue",icon:"⬢",network:"Receives model output only",resources:"1 CPU · 2 GB RAM"}];
  let config = state.roomTab==="Network" ? [["Attacker → Broker","Allowed"],["Broker → Model","Allowed"],["Model → Defender","Allowed"],["Attacker → Defender","Denied"],["Defender → Attacker","Denied"]] : state.roomTab==="Resource isolation" ? [["Attacker Room","1 CPU · 1 GB RAM"],["Model Room","2 CPU · 4 GB RAM"],["Defender Room","1 CPU · 2 GB RAM"],["Resource quotas","Enabled"]] : [["Room secrets","Capability scoped"],["Payload repository","Red team only"],["Defensive policies","Blue team only"],["Audit artifacts","Append-only access"]];
  return `<div class="rooms-intro"><div><div class="eyebrow">SANDBOX ARCHITECTURE</div><h2>Three rooms. Separate trust boundaries.</h2><p>Keep attacker payloads, model context, and defensive logic isolated while the broker coordinates a test.</p></div>${badge("3 / 3 isolated","green")}</div><div class="room-tabs">${["Architecture","Network","Resource isolation","Access control"].map(t=>`<button class="${state.roomTab===t?"active":""}" data-room-tab="${t}">${t}</button>`).join("")}</div>
  ${state.roomTab==="Architecture"?`<div class="room-architecture-card"><div class="room-arch-top"><div><h3>Execution boundaries</h3><p>Illustrative architecture · not a live infrastructure diagram</p></div><span class="inline-good"><span class="dot green"></span>Broker healthy</span></div><div class="room-architecture"><div class="room-arch-grid"></div><div class="room-boundary boundary-left"></div><div class="room-boundary boundary-mid"></div><div class="room-boundary boundary-right"></div><div class="room-arch-card attacker"><div class="room-large-icon">◎</div><b>Attacker Room</b><span>Red-team agent</span>${badge("Isolated","red")}<small>Payloads · test cases</small></div><div class="room-arch-card model"><div class="room-large-icon">⬡</div><b>Model Under Test</b><span>Client LLM</span>${badge("Isolated","purple")}<small>Inference context</small></div><div class="room-arch-card defender"><div class="room-large-icon">⬢</div><b>Defender Room</b><span>Blue-team agent</span>${badge("Isolated","blue")}<small>Policies · classifiers</small></div><div class="room-connector conn-left"><span class="lock">♙</span>Controlled I/O</div><div class="room-connector conn-right"><span class="lock">♙</span>Policy gated</div></div><div class="room-security-foot"><span><b>✓</b> Container boundaries</span><span><b>✓</b> Broker-mediated traffic</span><span><b>✓</b> Independent audit events</span></div></div>`:`<section class="card"><div class="card-header"><div><h3>${state.roomTab}</h3><p>Illustrative configuration view.</p></div></div><div class="config-list">${config.map(r=>`<div class="config-row"><span>${r[0]}</span><b>${r[1]}</b></div>`).join("")}</div></section>`}
  <div class="room-detail-grid">${rooms.map(r=>`<button class="room-detail-card ${state.selectedRoom===r.id?"selected":""}" data-room-detail="${r.id}"><div class="room-detail-icon ${r.color}">${r.icon}</div><div class="room-detail-head"><b>${r.name}</b>${badge("Isolated","green")}</div><span>${r.role}</span><p>${r.desc}</p><div class="room-detail-meta"><span>⌁ ${r.network}</span><span>▣ ${r.resources}</span></div><div class="room-detail-open">View room details →</div></button>`).join("")}</div><div class="prototype-note">⚠ These cards describe intended trust boundaries. Real isolation, network policies, and resource enforcement must be implemented by the sandbox backend.</div>`;
}

function render() {
  $("#pageTitle").textContent = titles[state.page][0];
  $("#pageSubtitle").textContent = titles[state.page][1];
  $$(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page===state.page));
  const views = {
    overview, "live-testing":liveTesting, "attack-library":attackLibrary,
    "defense-lab":defenseLab, "audit-logs":auditLogs, analytics, reports,
    settings:settingsPage, "testing-rooms":testingRooms
  };
  $("#pageContent").innerHTML = views[state.page]();
}
function navigate(page) {
  if (!titles[page]) return;
  state.page = page;
  $("#sidebar").classList.remove("sidebar-open");
  $("#mobileScrim").classList.remove("open");
  render();
  window.scrollTo({top:0,behavior:"smooth"});
}
function openRunModal() { $("#runModal").classList.remove("hidden"); }
function closeRunModal() { $("#runModal").classList.add("hidden"); }

document.addEventListener("click", async (event) => {
  const pageButton = event.target.closest("[data-page]");
  if (pageButton) { navigate(pageButton.dataset.page); return; }
  const eventFilter = event.target.closest("[data-event-filter]");
  if (eventFilter) { state.eventFilter=eventFilter.dataset.eventFilter; render(); return; }
  const attackFilter = event.target.closest("[data-attack-filter]");
  if (attackFilter) { state.attackFilter=attackFilter.dataset.attackFilter; render(); return; }
  const roomTab = event.target.closest("[data-room-tab]");
  if (roomTab) { state.roomTab=roomTab.dataset.roomTab; render(); return; }
  const defenseToggle = event.target.closest("[data-toggle-defense]");
  if (defenseToggle) { const i=Number(defenseToggle.dataset.toggleDefense);state.enabledControls[i]=!state.enabledControls[i];render();return; }
  const settingToggle = event.target.closest("[data-setting-toggle]");
  if (settingToggle) { const key=settingToggle.dataset.settingToggle;state.settings[key]=!state.settings[key];render();return; }
  const roomDetail = event.target.closest("[data-room-detail]");
  if (roomDetail) { state.selectedRoom=roomDetail.dataset.roomDetail;render();return; }
  const actionButton = event.target.closest("[data-action]");
  if (actionButton) {
    const action=actionButton.dataset.action;
    if (action==="open-run") openRunModal();
    else if (action==="toggle-stream") {state.running=!state.running;render();toast(state.running?"Event stream resumed":"Event stream paused");}
    else if (action==="history") toast("Run history is represented by sample records");
    else if (action==="enable-all") {state.enabledControls=defenses.map(()=>true);render();toast("All demo controls enabled");}
    else if (action==="verify-policy") toast("Verification completed in demo mode");
    else if (action==="verify") {
      try { state.verifyResult = await verifyChainReal(); render(); toast(state.verifyResult.ok ? "Chain verified — intact" : `Chain broken at seq=${state.verifyResult.brokenAtSeq}`); }
      catch (err) { toast(err.message || "verify failed"); }
    }
    else if (action==="verify-tamper") {
      try {
        const tamperSeq = state.entries.length ? state.entries[Math.floor(state.entries.length/2)].seq : undefined;
        state.verifyResult = await verifyChainReal(tamperSeq);
        state.tamperArmed = false;
        render();
        toast(state.verifyResult.ok ? "Chain verified — intact" : `Simulated tamper caught at seq=${state.verifyResult.brokenAtSeq}`);
      } catch (err) { toast(err.message || "verify failed"); }
    }
    else if (action==="toggle-tamper") { state.tamperArmed=!state.tamperArmed; render(); toast(state.tamperArmed ? "Tamper armed — next Verify will simulate it" : "Tamper disarmed"); }
    else if (action==="export") downloadCsv();
    else if (action==="copy-run") {await copyText("RUN-1042 · HILL-001 · Demo evaluation");toast("Run details copied");}
    else if (action==="add-technique") toast("Technique creation requires backend integration");
    else if (action==="attack-details") toast(`${actionButton.dataset.name} · detail preview`);
    else if (action==="create-report") toast("New report draft created in demo mode");
    else if (action==="report-preview") toast(`${actionButton.dataset.name} · preview mode`);
    else if (action==="save-settings") {state.settings.workspace=$("#workspaceName").value;state.settings.retention=$("#retention").value;toast("Settings saved for this session");}
    else if (action.startsWith("settings-")) toast("This settings section is a UI placeholder");
    return;
  }
});

$("#pageContent").addEventListener("input", (event) => {
  if (event.target.id==="attackSearch") {
    const cursor=event.target.selectionStart;
    state.search=event.target.value;
    render();
    const input=$("#attackSearch");
    if(input){input.focus();input.setSelectionRange(cursor,cursor);}
  }
});
$("#startRun").addEventListener("click",openRunModal);
$("#closeModal").addEventListener("click",closeRunModal);
$("#cancelModal").addEventListener("click",closeRunModal);
$("#runModal").addEventListener("click",(e)=>{if(e.target.id==="runModal")closeRunModal();});
$("#confirmRun").addEventListener("click",async()=>{
  closeRunModal();
  navigate("live-testing");
  try { await triggerRunReal(); toast("Evaluation run started"); await pollBroker(); }
  catch (err) { toast(err.message || "failed to start run"); }
});
$("#globalSearch").addEventListener("input",(e)=>{state.search=e.target.value;if(state.page==="attack-library")render();});
$("#globalSearch").addEventListener("keydown",(e)=>{if(e.key==="Enter"){navigate("attack-library");$("#attackSearch")?.focus();}});
document.addEventListener("keydown",(e)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("#globalSearch").focus();}if(e.key==="Escape")closeRunModal();});
$("#mobileMenu").addEventListener("click",()=>{$("#sidebar").classList.toggle("sidebar-open");$("#mobileScrim").classList.toggle("open");});
$("#mobileScrim").addEventListener("click",()=>{$("#sidebar").classList.remove("sidebar-open");$("#mobileScrim").classList.remove("open");});
$("#notifications").addEventListener("click",()=>toast("You're all caught up"));
$("#profile").addEventListener("click",()=>toast("Signed in as demo operator"));
$("#copySession").addEventListener("click",async()=>{await copyText("#HILL-001");toast("Session ID copied");});
$("#connectBroker").addEventListener("click",async()=>{await connectBroker();toast(hasAuditToken()?"Connected to broker":"No token entered");});

const deepLinkPage = new URLSearchParams(location.search).get("page");
if (deepLinkPage && titles[deepLinkPage]) navigate(deepLinkPage);

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch { const ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand("copy");ta.remove(); }
}
function downloadCsv() {
  const rows = liveEventRows();
  const csv="timestamp,event,details\n"+rows.map(e=>`"${e.time}","${e.type}","${e.detail.replace(/"/g,'""')}"`).join("\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
  const a=document.createElement("a");a.href=url;a.download="bayora-audit-events.csv";a.click();URL.revokeObjectURL(url);
}
render();
