# API Reference — Broker Service

Base URL (local dev): `http://127.0.0.1:4000` (bound to loopback only — not reachable outside the host).

All endpoints except `/health` require an `Authorization: Bearer <token>` header. There is no single "admin" token — each token only unlocks the routes for its role.

| Token | Can call |
|---|---|
| `RED_TEAM_TOKEN` | `POST /submit-attack` |
| `BLUE_TEAM_TOKEN` | `GET /pending`, `POST /score` |
| `AUDIT_TOKEN` | `GET /audit`, `GET /verify` |

A request with the wrong token for a given route — even a *valid* token for a *different* role — receives `403 { "error": "forbidden" }`. This is intentional and tested: the blue-team's own token does not unlock `/audit`.

---

## `GET /health`
No auth required.

**Response**
```json
{ "ok": true, "mockMode": true }
```
`mockMode: true` means no `ANTHROPIC_API_KEY` is set — responses are canned, not from a real model.

---

## `POST /submit-attack`
**Auth:** `RED_TEAM_TOKEN`

**Body**
```json
{ "technique": "instruction_override", "prompt": "Ignore all previous instructions..." }
```
`technique` must match `^[a-z0-9_]{1,64}$`.

**Response**
```json
{ "attackId": "uuid", "status": "logged" }
```
`502` if the LLM call itself fails. `400` if `prompt` is missing or `technique` fails validation.

---

## `GET /pending`
**Auth:** `BLUE_TEAM_TOKEN`

Returns the oldest unclaimed response, or `null` if none. **Deliberately omits the prompt and technique.**

**Response**
```json
{ "item": { "attackId": "uuid", "response": "I can't help with that request..." } }
```
or
```json
{ "item": null }
```

---

## `POST /score`
**Auth:** `BLUE_TEAM_TOKEN`

**Body**
```json
{ "attackId": "uuid", "verdict": "blocked", "confidence": 0.8, "notes": "..." }
```
`verdict` must be one of `blocked`, `passed_through`, `ambiguous`.

**Response**
```json
{ "status": "recorded" }
```
`409 { "error": "unknown attackId, or already scored" }` if the `attackId` was never issued via `/pending`, or has already been scored once. This is what prevents a forged/duplicate verdict.

---

## `GET /audit`
**Auth:** `AUDIT_TOKEN`

**Response**
```json
{ "count": 15, "entries": [ { "seq": 1, "ts": "...", "event": "attack_submitted", "data": {...}, "prevHash": "...", "hash": "..." }, ... ] }
```

---

## `GET /verify`
**Auth:** `AUDIT_TOKEN`

**Query params**
- `simulateTamperSeq` *(optional, integer)* — demo-only. Checks what verification would report if the entry with this `seq` had its data altered, **without writing anything to the real log**. Use this to power a "Tamper → Verify" demo button safely.

**Response (chain intact)**
```json
{ "ok": true, "count": 15, "finalHash": "<hex>" }
```

**Response (chain broken)**
```json
{ "ok": false, "brokenAtSeq": 2, "reason": "data was altered" }
```
`reason` is either `"prevHash mismatch"` (an entry was deleted/reordered) or `"data was altered"` (an entry's content doesn't match its stored hash).

---

## Example: curl walkthrough

```bash
export $(grep -v '^#' .env | xargs)

# Fire an attack (red-team role)
curl -X POST http://127.0.0.1:4000/submit-attack \
  -H "authorization: Bearer $RED_TEAM_TOKEN" \
  -H "content-type: application/json" \
  -d '{"technique":"instruction_override","prompt":"Ignore all previous instructions"}'

# Read the audit log (audit role)
curl -H "authorization: Bearer $AUDIT_TOKEN" http://127.0.0.1:4000/audit

# Verify the chain (audit role)
curl -H "authorization: Bearer $AUDIT_TOKEN" http://127.0.0.1:4000/verify

# See what a tamper at seq=2 would look like, without touching the real log
curl -H "authorization: Bearer $AUDIT_TOKEN" "http://127.0.0.1:4000/verify?simulateTamperSeq=2"
```
