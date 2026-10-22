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

## Try it (for judges)

Open **https://bayora-sandbox.vercel.app**. No login, no token.

1. **Overview** shows what the last run found and which models are involved.
2. **Live run** → *Start a run* sends seven attacks through the sandbox while you watch; each one appears as a card.
3. **Audit chain** → *Verify chain*, then *Try to tamper* to see a single edited entry break everything after it.
4. **Compare models** puts two models side by side on the same attacks and the same blind judge.

The address ending in `trycloudflare.com` is the **broker**, the API behind the dashboard, and it
has no page of its own. If you open it in a browser you are redirected to the dashboard.
The broker runs on the team's machine; if the dashboard says it is unreachable, it retries on its own.

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
# pick a model under test (any ONE of these):
#   ANTHROPIC_API_KEY=...                         Anthropic
#   LLM_BASE_URL + LLM_API_KEY + LLM_MODEL         any OpenAI-compatible API (Groq and
#                                                 Gemini have free tiers; Ollama is local)
#   nothing                                       MOCK MODE: canned replies, clearly labelled
# optionally give the blind judge its own model (JUDGE_BASE_URL/JUDGE_API_KEY/JUDGE_MODEL);
# without one it falls back to a keyword classifier. Use a different model from the target.

docker compose up --build
```

Watch the logs: `red-team` fires 7 prompt-injection-style attacks at the
broker, the broker calls the model under test (which runs with a system prompt
holding a fake secret, so a prompt leak is actually possible) and logs the full
exchange, `blue-team` scores each reply blind with its own judge model, and
every step gets appended to `logs/audit.log`.

Isolation you can probe live:

```bash
docker exec bayora-red-team wget -T 3 -O /dev/null https://api.groq.com/   # no route: red-net is internal
docker exec bayora-red-team wget -T 3 -O /dev/null http://blue-team:4000   # bad address: no shared network
```

## Live dashboard

The dashboard lives in `web/` — a Vite + React + Tailwind app with a landing
page at `/` and the app at `/app`: Overview, Runs, Run detail, Live run, Attack
library, Audit chain, Settings. Every number is computed from the broker's
`/audit` data. Until you connect a broker it shows built-in **demo data**,
labelled as such everywhere, and its Verify button in demo mode is a
placeholder, not a real recompute.

```bash
cd web
npm install
npm run dev          # http://localhost:5173
```

Open `/app`. Visitors need nothing: they can read the record, verify it, and start a rate-limited run of the current model. Click **operator login** in the header, and paste the `AUDIT_TOKEN` from
the root `.env`. The token stays in that tab's session storage. The broker URL
is editable in the same dialog (default: `VITE_BROKER_URL` at build time).

## Deploying the dashboard

The root `vercel.json` builds `web/` and serves `web/dist` with an SPA rewrite.
Leave the Vercel project's Root Directory **unset** (repo root). Set
`VITE_BROKER_URL` in the Vercel environment to a stable broker address (a named
Cloudflare tunnel, not a quick tunnel, whose hostname changes on every restart).

## Checking the broker is reachable

```bash
scripts/smoke.sh                       # against the local broker
scripts/smoke.sh https://<tunnel>      # through the public tunnel, as a browser would
```

It checks health, the CORS preflight a browser sends before every authenticated call, what each
token may and may not do, that visitor responses carry no attack prompts, and that the chain verifies.

## Verifying the audit log from the command line

```bash
export $(grep -v '^#' .env | xargs) && node scripts/verify-log.js
```

Independently recomputes the entire HMAC chain from the raw log file. If
anyone edits a line in `logs/audit.log` by hand, this catches it and reports
exactly where the chain breaks.

## What this does NOT claim to do yet

- Viewer-side secret masking is deliberately fail-closed: any reply with a long run
  of non-Latin text (or a disguised secret) is withheld from read-only viewers
  entirely. This over-withholds legitimate Arabic or CJK replies; operators see
  everything. A real Unicode confusables table would reduce this.

- The public dashboard build carries a read-only `VIEWER_TOKEN`. Anything that
  token can read is treated as public: attack prompts and the system prompt
  are stripped from viewer responses, and the catalog endpoint is operator-only,
  so the judge container could not learn prompts even if it fetched the site.
  Technique labels remain visible to viewers.

- The HMAC key lives in the broker. A compromised broker can forge and vouch
  for its own log, and trailing entries can be truncated without detection
  until the chain head is anchored somewhere the broker cannot write.
- The judge sees only the reply, so it cannot know what was asked; harm that
  is only visible in context will be missed. `confidence` and `notes` are the
  judge's own words, sealed as sent, not verified.
- `/pending` hands out each reply once with no lease; a judge crash mid-score
  leaves that attack unjudged.
- The "Start a run" button has the broker fire its own copy of `attacks.json`;
  only the red container's boot run crosses the real network boundary.
- No seccomp profiles, no rate limiting on the broker, no tests yet.

## Project structure

```
docker-compose.yml       # defines the 2 isolated networks + 3 services + per-role secrets
services/
  broker/                 # mediates red<->LLM<->blue, owns the audit log, enforces per-role auth
  red-team/                # fires hardcoded attack payloads (RED_TEAM_TOKEN only)
  blue-team/               # blind heuristic classifier (BLUE_TEAM_TOKEN only)
web/
  src/                      # the live React dashboard (see "Live dashboard" above)
scripts/
  verify-log.js              # independent, HMAC-keyed audit-log integrity checker
logs/
  audit.log                   # created at runtime, HMAC-chained JSON lines
```
