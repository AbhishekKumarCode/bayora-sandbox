# Bayora Sandbox

A minimal, working proof of the core idea: a red team and a blue team evaluate
an LLM through a mediating broker, on **separate Docker networks with no
shared path between them**, with every event recorded in a **tamper-evident,
HMAC-chained audit log** — and each container only authenticated for the one
role it's allowed to play.

This is the Phase 0 build — the minimal pipe that has to work before anything
else (full live dashboard polish, stronger container hardening, real
AdvBench/JailbreakBench sourcing) gets added.

**Docs:** [Product Requirements](docs/PRD.md) · [Architecture](docs/ARCHITECTURE.md) · [API Reference](docs/API.md) · [Threat Model](docs/THREAT_MODEL.md) · [Design System](docs/DESIGN_SYSTEM.md)

## What's actually isolated here

- `red-team` is only on `red-net`. `blue-team` is only on `blue-net`. They
  share no Docker network — there is no path for one container to reach the
  other directly. Only `broker` sits on both networks and mediates everything.
- The blue team never receives the attack prompt or technique label — only
  the model's response text (`GET /pending`). That's what "blind evaluation"
  means here, enforced in code, not just promised.
- **Each container is authenticated for exactly one role.** `red-team` holds
  only `RED_TEAM_TOKEN`, `blue-team` holds only `BLUE_TEAM_TOKEN`. This
  matters because red and blue *are* both on a Docker network with the
  broker (that's unavoidable — the broker has to be reachable by both) — so
  without role-based auth, blue-team could simply call `GET /audit` itself
  and read the attack prompts straight out of the log, silently defeating
  the blind-evaluation guarantee. The `AUDIT_TOKEN` that protects `/audit`
  and `/verify` is given only to the broker/host — never to either team
  container — which is what actually stops that.
- `/score` only accepts a verdict for an `attackId` that was genuinely
  handed out via `/pending`, and only once — a forged or duplicate verdict
  for an unknown ID is rejected with 409.
- The audit log is HMAC-SHA256 chained (keyed with `AUDIT_HMAC_KEY`, which
  only the broker and the host-side verify script ever see) rather than a
  plain hash — a plain hash chain can be recomputed and re-forged by anyone
  who can read the log; an HMAC chain can't be, without the key.
- Every container runs with `cap_drop: ALL`, `no-new-privileges`, and a
  read-only root filesystem (except the broker's `/logs` mount). The host
  port is bound to `127.0.0.1` only.

## Running it

```bash
cp .env.example .env
# generate your own secrets:
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
# paste 4 different values in for AUDIT_HMAC_KEY, RED_TEAM_TOKEN, BLUE_TEAM_TOKEN, AUDIT_TOKEN
# optionally add a real ANTHROPIC_API_KEY — without one, the broker runs in
# MOCK MODE with canned responses so the pipeline still works end-to-end

docker compose up --build
```

Watch the logs: `red-team` fires 5 real prompt-injection-style attacks at the
broker, the broker calls the LLM (real or mock) and logs the exchange,
`blue-team` polls for responses and scores them blind using a simple
keyword-based classifier, and every step gets appended to `logs/audit.log`.

## Live dashboard

The real dashboard lives in `web/` — a React + Vite + Tailwind app (see
`docs/DESIGN_SYSTEM.md` for the visual language) with four pages: Overview,
Rooms, Notebook, and History. Every number on every page is computed live
from the broker's real `/audit` data — nothing is hardcoded.

```bash
cd web
npm install
cp .env.example .env
# edit .env: set VITE_AUDIT_TOKEN to the same value as AUDIT_TOKEN in the
# root .env (optional — if left blank, the app just prompts for it once)
npm run dev
```

Open `http://localhost:5173`. Highlights:
- **Overview** — the Trust Switch (sealed/leaky comparison), live stats, and
  the activity feed
- **Notebook** — a "Tamper → Verify" pair: Tamper arms a one-off, in-memory
  simulation (via the broker's `?simulateTamperSeq=`, which never touches
  the real log — verified: the log's hash is identical before and after),
  Verify recomputes the HMAC chain server-side and reports exactly where it
  breaks, if it does

An older, dependency-free static version still exists at `dashboard/index.html`
(plain HTML/JS, no build step) if you want something simpler to serve:

```bash
npx serve dashboard
# or: python3 -m http.server --directory dashboard 8080
```

## Verifying the audit log from the command line

```bash
export $(grep -v '^#' .env | xargs) && node scripts/verify-log.js
```

Independently recomputes the entire HMAC chain from the raw log file. If
anyone edits a line in `logs/audit.log` by hand, this catches it and reports
exactly where the chain breaks.

## What this does NOT claim to do yet

This is the Phase 0 pipe only. Not yet built: the Trust-Switch on/off toggle
(isolation enabled vs. disabled, to show the score gap live), custom seccomp
profiles, and real attack-payload sourcing from AdvBench/JailbreakBench. See
the project brief and pitch deck in the parent `/hackinhills` folder for the
full roadmap and the explicit threat model (what this protects against and
what it doesn't — including the things role-based auth doesn't fix, like a
fully compromised broker container).

## Project structure

```
docker-compose.yml       # defines the 2 isolated networks + 3 services + per-role secrets
services/
  broker/                 # mediates red<->LLM<->blue, owns the audit log, enforces per-role auth
  red-team/                # fires hardcoded attack payloads (RED_TEAM_TOKEN only)
  blue-team/               # blind heuristic classifier (BLUE_TEAM_TOKEN only)
dashboard/
  index.html                # live static dashboard, polls the broker (AUDIT_TOKEN)
scripts/
  verify-log.js              # independent, HMAC-keyed audit-log integrity checker
logs/
  audit.log                   # created at runtime, HMAC-chained JSON lines
```
