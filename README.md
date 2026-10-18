# Bayora Sandbox

A minimal, working proof of the core idea: a red team and a blue team evaluate
an LLM through a mediating broker, on **separate Docker networks with no
shared path between them**, with every event recorded in a **tamper-evident,
hash-chained audit log**.

This is the Phase 0 build — the minimal pipe that has to work before anything
else (dashboard, trust-switch toggle, stronger hardening) gets added.

## What's actually isolated here

- `red-team` is only on `red-net`. `blue-team` is only on `blue-net`. They
  share no Docker network — there is no path for one container to reach the
  other directly. Only `broker` sits on both networks and mediates everything.
- The blue team never receives the attack prompt or technique label — only
  the model's response text (`GET /pending` on the broker). That's what
  "blind evaluation" means here, enforced in code, not just promised.
- Every container runs with `cap_drop: ALL`, `no-new-privileges`, and a
  read-only root filesystem (except the broker's `/logs` mount).

## Running it

```bash
cp .env.example .env
# optionally add a real ANTHROPIC_API_KEY to .env — without one, the broker
# runs in MOCK MODE with canned responses so the pipeline still works end-to-end

docker compose up --build
```

Watch the logs: `red-team` fires 5 real prompt-injection-style attacks at the
broker, the broker calls the LLM (real or mock) and logs the exchange,
`blue-team` polls for responses and scores them blind using a simple
keyword-based classifier, and every step gets appended to
`logs/audit.log`.

## Verifying the audit log

```bash
node scripts/verify-log.js
```

This independently recomputes the entire hash chain from the raw log file —
it does not trust the broker's own claims. If anyone edits a line in
`logs/audit.log` by hand, this will catch it and report exactly where the
chain breaks.

## Inspecting what happened

```bash
curl http://localhost:4000/audit | jq
```

(Only exposed to the host for this demo — not reachable from the red-team or
blue-team containers.)

## What this does NOT claim to do yet

This is the Phase 0 pipe only. Not yet built: the live dashboard, the
Trust-Switch on/off toggle (isolation enabled vs. disabled, to show the score
gap live), custom seccomp profiles, and the real attack-payload sourcing from
AdvBench/JailbreakBench. See the project brief and pitch deck in the parent
`/hackinhills` folder for the full roadmap and the explicit threat model
(what this protects against and what it doesn't).

## Project structure

```
docker-compose.yml       # defines the 2 isolated networks + 3 services
services/
  broker/                 # mediates red<->LLM<->blue, owns the audit log
  red-team/                # fires hardcoded attack payloads
  blue-team/               # blind heuristic classifier
scripts/
  verify-log.js            # independent audit-log integrity checker
logs/
  audit.log                 # created at runtime, hash-chained JSON lines
```
