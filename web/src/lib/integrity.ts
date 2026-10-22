import type { AuditEntry } from "./api";

/**
 * Checks the browser can do WITHOUT the broker's key. They do not replace the
 * broker's HMAC verification (which proves entries were not forged); they
 * catch structural tampering that someone looking at the data can see:
 * missing, reordered or mislinked entries, and, using what this browser
 * remembers, entries removed or rewritten since the last visit.
 */
const GENESIS = "0".repeat(64);

export type LinkCheck = { ok: boolean; checked: number; problems: Array<{ seq: number; reason: string }> };

export function checkLinks(entries: AuditEntry[]): LinkCheck {
  const problems: LinkCheck["problems"] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.seq !== i + 1) problems.push({ seq: e.seq, reason: `expected entry ${i + 1} here but found ${e.seq}: an entry is missing or reordered` });
    const expectedPrev = i === 0 ? GENESIS : entries[i - 1].hash;
    if (e.prevHash !== expectedPrev) problems.push({ seq: e.seq, reason: "its previous-hash does not match the entry before it" });
    if (!/^[0-9a-f]{64}$/.test(e.hash)) problems.push({ seq: e.seq, reason: "its hash is not a valid 64-character value" });
    if (problems.length >= 20) break;
  }
  return { ok: problems.length === 0, checked: entries.length, problems };
}

export type Anchor = { seq: number; hash: string; at: number };
const key = (url: string) => `bayora_anchor:${url}`;

export function loadAnchor(url: string): Anchor | null {
  try { const raw = localStorage.getItem(key(url)); return raw ? (JSON.parse(raw) as Anchor) : null; } catch { return null; }
}
export function saveAnchor(url: string, a: Anchor) {
  try { localStorage.setItem(key(url), JSON.stringify(a)); } catch { /* ignore */ }
}

export type AnchorStatus =
  | { state: "none"; anchor: null }
  | { state: "ok"; anchor: Anchor }
  | { state: "changed"; anchor: Anchor; reason: string };

/** Does the record still contain, at the same position, the latest entry this browser saw last time? */
export function checkAnchor(entries: AuditEntry[], anchor: Anchor | null): AnchorStatus {
  if (!anchor) return { state: "none", anchor: null };
  const at = entries[anchor.seq - 1];
  if (!at) return { state: "changed", anchor, reason: `Last time, this browser saw the record reach entry #${anchor.seq}. It now ends at #${entries.length}, so entries were removed.` };
  if (at.hash !== anchor.hash) return { state: "changed", anchor, reason: `Entry #${anchor.seq} has a different hash from the one this browser saw last time, so the record was rewritten.` };
  return { state: "ok", anchor };
}
