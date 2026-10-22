import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { ShieldCheck, ShieldAlert, FlaskConical, Link2, Search, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { fmtTime, fmtDate, fmtAgo } from "@/lib/model";
import { Button, Card, Pill, Hash, Actor, Heading, Stamp, cx } from "@/components/ui";
import { Legend } from "@/components/charts";
import type { AuditEntry, VerifyResult } from "@/lib/api";

const EVENT: Record<AuditEntry["event"], { label: string; actor: "attacker" | "model" | "judge"; color: string }> = {
  attack_submitted: { label: "Attack fired", actor: "attacker", color: "var(--color-red)" },
  llm_response_received: { label: "Model replied", actor: "model", color: "var(--color-violet)" },
  llm_error: { label: "Model error", actor: "model", color: "var(--color-red)" },
  blue_team_verdict: { label: "Blind verdict", actor: "judge", color: "var(--color-blue)" },
};
const PAGE = 40;

function matches(e: AuditEntry, q: string) {
  const n = q.trim().toLowerCase().replace(/^#/, "");
  if (!n) return true;
  if (/^\d+$/.test(n) && String(e.seq) === n) return true;
  const hay = [e.hash, e.prevHash, e.data.attackId, e.data.technique, e.data.verdict, e.data.notes, e.data.responsePreview, e.event].filter(Boolean).join(" ").toLowerCase();
  return n.length >= 3 && hay.includes(n);
}

export function Audit() {
  const s = useStore();
  const { hash } = useLocation();
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [verifiedAt, setVerifiedAt] = useState<Date | null>(null);
  const [busy, setBusy] = useState<"verify" | "tamper" | null>(null);
  const [tamperSeq, setTamperSeq] = useState<number | "">("");
  const [filter, setFilter] = useState<"all" | AuditEntry["event"]>("all");
  const [query, setQuery] = useState("");
  const [attackFilter, setAttackFilter] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE);
  const all = s.entries;
  const latest = all[all.length - 1];
  const entries = useMemo(
    () => [...all].reverse().filter((e) => (filter === "all" || e.event === filter) && (!attackFilter || e.data.attackId === attackFilter) && matches(e, query)),
    [all, filter, attackFilter, query],
  );
  const brokenAt = verify && !verify.ok ? verify.brokenAtSeq : null;
  const { links, anchor } = s.integrity;

  useEffect(() => {
    if (!hash) return;
    setVisible(Infinity);
    const id0 = setTimeout(() => {
      const el = document.querySelector(hash);
      el?.scrollIntoView({ block: "center" });
      el?.classList.add("bg-white/80");
      setTimeout(() => el?.classList.remove("bg-white/80"), 2000);
    }, 60);
    return () => clearTimeout(id0);
  }, [hash, all.length]);

  async function run(kind: "verify" | "tamper") {
    setBusy(kind);
    try { setVerify(await s.verify(kind === "tamper" ? Number(tamperSeq || all[1]?.seq || 1) : undefined)); if (kind === "verify") setVerifiedAt(new Date()); }
    finally { setBusy(null); }
  }
  function jump(seq: number) {
    setFilter("all"); setQuery(""); setAttackFilter(null); setVisible(Infinity);
    setTimeout(() => {
      const el = document.getElementById(`seq-${seq}`);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.classList.add("bg-white/80");
      setTimeout(() => el?.classList.remove("bg-white/80"), 1600);
    }, 60);
  }
  const statusOf = (seq: number) => (!verify ? "not verified yet" : verify.ok ? "verified" : seq < verify.brokenAtSeq ? "verified (before the break)" : seq === verify.brokenAtSeq ? "altered" : "invalid (after the break)");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display text-[36px] sm:text-[44px]">Audit chain</h1>
        <p className="mt-2 text-[14.5px] font-semibold text-ink-2">The full record. Each entry carries a keyed hash of itself plus the previous entry, so editing one breaks every entry after it.</p>
      </div>

      {/* Summary: what is true about the record right now */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="b-card p-4"><div className="label">Entries</div><div className="display mt-1 text-[28px]">{all.length}</div><div className="mt-1 text-[12.5px] text-muted">{latest ? `latest ${fmtDate(latest.ts)} ${fmtTime(latest.ts)} · ${fmtAgo(latest.ts)}` : "empty"}</div></div>
        <div className="b-card p-4"><div className="label">Latest hash</div><div className="mt-2 break-all">{latest ? <Hash value={latest.hash} n={10} copy /> : "–"}</div><div className="mt-1 text-[12.5px] text-muted">Copy it to compare against a later visit.</div></div>
        <div className="b-card p-4">
          <div className="label">Chain structure · checked in your browser</div>
          <div className={cx("display mt-1 flex items-center gap-2 text-[18px]", links.ok ? "text-green-2" : "text-red-2")}>{links.ok ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}{links.ok ? "Consistent" : "Inconsistent"}</div>
          <div className="mt-1 text-[12.5px] text-muted">{links.ok ? `All ${links.checked} entries are numbered in order and each links to the one before it. No key needed.` : `${links.problems[0].reason} (entry ${links.problems[0].seq}).`}</div>
        </div>
        <div className="b-card p-4">
          <div className="label">Last seen by this browser</div>
          <div className={cx("display mt-1 text-[18px]", anchor.state === "changed" ? "text-red-2" : "")}>{anchor.state === "none" ? "First visit" : anchor.state === "ok" ? `Entry #${anchor.anchor.seq}, unchanged` : "Record changed"}</div>
          <div className="mt-1 text-[12.5px] text-muted">{anchor.state === "none" ? "This browser will remember the latest entry and warn you if it is later removed or rewritten." : anchor.state === "ok" ? `Remembered ${fmtAgo(new Date(anchor.anchor.at).toISOString())}; it is still in the record with the same hash.` : anchor.reason}</div>
        </div>
      </div>

      {/* Chain visual + verify */}
      <Card className="overflow-hidden p-0">
        <div className="border-b border-line p-5">
          <Heading title="The chain, end to end" desc={`${all.length} entries. Each block is one event; the link is its hash of the one before. Click a block to jump to it.`} right={<Legend items={[{ color: "var(--color-red)", label: "Attack" }, { color: "var(--color-violet)", label: "Reply" }, { color: "var(--color-blue)", label: "Verdict" }]} />} />
          <ChainVisual entries={all} brokenAt={brokenAt} onJump={jump} />
        </div>
        <div className="grid gap-5 p-5 lg:grid-cols-2">
          <div className="flex items-start gap-4">
            <div className={cx("flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px]", brokenAt != null ? "bg-red text-white" : "bg-green")}>
              {brokenAt != null ? <ShieldAlert size={22} /> : <ShieldCheck size={22} />}
            </div>
            <div>
              <div className="display text-[18px]">{verify == null ? "Verify the whole chain" : verify.ok ? `Intact · ${verify.count} entries` : `Broken at entry ${verify.brokenAtSeq}`}</div>
              <div className="mt-1 text-[13px] font-semibold text-ink-2">
                {verify == null && "The broker recomputes every keyed hash from the first entry. Not verified yet this session."}
                {verify?.ok && <>Final hash <Hash value={verify.finalHash} copy />{verifiedAt && <> · verified {verifiedAt.toLocaleTimeString()}</>}</>}
                {verify && !verify.ok && <>{verify.reason}.</>}
              </div>
              {verify && !verify.ok && <p className="mt-2 max-w-[520px] rounded-[10px] bg-red/20 p-3 text-[12.5px] font-semibold text-red-2">What this means: entry {verify.brokenAtSeq} was edited, deleted or reordered after it was sealed, so every entry from there on cannot be trusted. Compare with a copy of the log you saved earlier. This was a simulation only if you used "Try to tamper"; the real record is untouched.</p>}
              <div className="mt-3 flex gap-2">
                <Button variant="primary" onClick={() => run("verify")} disabled={busy != null}>{busy === "verify" ? "Verifying…" : "Verify chain"}</Button>
                {verify && <Button variant="ghost" onClick={() => setVerify(null)}>Clear</Button>}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-4 rounded-[14px] border border-dashed border-line-strong p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-amber"><FlaskConical size={18} strokeWidth={2.5} /></div>
            <div className="min-w-0">
              <div className="display text-[16px]">Try to tamper</div>
              <div className="mt-1 text-[12.5px] font-semibold text-ink-2">Pick an entry and pretend it was edited. The broker shows where verification would fail. The real record is untouched.</div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input id="tamper-seq" aria-label="Entry number to tamper with" type="number" inputMode="numeric" min={1} max={all.length} value={tamperSeq} onChange={(e) => setTamperSeq(e.target.value === "" ? "" : Number(e.target.value))} placeholder={`entry 1–${all.length}`} className="b-input h-11 w-40" />
                <Button onClick={() => run("tamper")} disabled={busy != null}>{busy === "tamper" ? "Checking…" : "Tamper → verify"}</Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1 sm:max-w-[420px]">
            <Search size={15} className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted" />
            <input id="audit-search" aria-label="Search the record by entry number, hash, attack id, technique or text" value={query} onChange={(e) => { setQuery(e.target.value); setVisible(PAGE); }} placeholder="Search: entry #, hash, technique, text" className="b-input h-11" style={{ paddingLeft: 36 }} />
          </div>
          <div className="flex flex-wrap rounded-[12px] border border-line bg-white/60" role="group" aria-label="Filter by event type">
            {([["all", "All"], ["attack_submitted", "Attacks"], ["llm_response_received", "Replies"], ["blue_team_verdict", "Verdicts"], ["llm_error", "Errors"]] as const).map(([k, l], i) => (
              <button key={k} onClick={() => { setFilter(k); setVisible(PAGE); }} aria-pressed={filter === k} className={cx("label px-3 py-2.5", i > 0 && "border-l border-line", filter === k && "bg-white text-ink")}>{l}</button>
            ))}
          </div>
          <div className="label ml-auto text-muted">{entries.length} of {all.length} entries · newest first</div>
        </div>
        {attackFilter && <div className="flex items-center gap-2 text-[13px]"><Pill tone="blue">one attack</Pill><span className="text-ink-2">Showing the entries of attack <span className="mono font-semibold">{attackFilter.slice(0, 8)}…</span>: the attack, the model's reply and the blind verdict.</span><button onClick={() => setAttackFilter(null)} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent underline decoration-2 underline-offset-4"><X size={12} /> show all</button></div>}
      </div>

      {/* Entries */}
      <div className="relative">
        <div className="absolute left-[27px] top-4 bottom-4 w-[2px] rounded-full bg-line-strong" aria-hidden />
        <div className="space-y-4">
          {entries.slice(0, visible).map((e) => {
            const meta = EVENT[e.event];
            const broken = brokenAt != null && e.seq >= brokenAt;
            const isBreak = brokenAt === e.seq;
            const status = statusOf(e.seq);
            return (
              <div id={`seq-${e.seq}`} key={e.seq} className={cx("b-card relative flex items-start gap-4 p-4", isBreak && "bg-red text-white")} style={broken ? { boxShadow: "0 0 0 1.5px var(--color-red-2)" } : undefined}>
                <div className="relative z-10 flex w-[22px] shrink-0 justify-center pt-1">
                  <span className={cx("h-3.5 w-3.5 rounded-full ring-4 ring-white", broken ? "bg-red-2" : "bg-green-2")} />
                </div>
                <Actor kind={meta.actor} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="mono text-[12px] font-bold opacity-70">#{e.seq}</span>
                    <span className="display text-[16px]">{meta.label}</span>
                    {e.event === "attack_submitted" && <span className="b-pill red">{e.data.technique}</span>}
                    {e.event === "blue_team_verdict" && <Stamp tone={e.data.verdict === "blocked" ? "green" : e.data.verdict === "passed_through" ? "red" : "amber"} className="!text-[10px]">{e.data.verdict === "passed_through" ? "got through" : e.data.verdict} · {Math.round((e.data.confidence ?? 0) * 100)}%</Stamp>}
                    {isBreak && <Pill tone="ink" dot>altered here</Pill>}
                    {broken && !isBreak && <Pill tone="red">broken by #{brokenAt}</Pill>}
                    <span className="label ml-auto opacity-70">{fmtDate(e.ts)} {fmtTime(e.ts)}</span>
                  </div>
                  {e.event === "llm_response_received" && <div className="mono mt-1.5 truncate text-[12.5px]">"{e.data.responsePreview}"</div>}
                  {e.event === "blue_team_verdict" && e.data.notes && <div className="mt-1.5 text-[12.5px] font-semibold">{e.data.notes}</div>}
                  {e.event === "llm_error" && <div className="mono mt-1.5 text-[12.5px] text-red-2">{e.data.error}</div>}
                  <div className="label mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 opacity-90">
                    <span className="flex items-center gap-1"><Link2 size={11} /> hash <Hash value={e.hash} n={8} copy /></span>
                    {e.seq > 1 && <span>links to #{e.seq - 1} <Hash value={e.prevHash} n={6} copy /></span>}
                    {e.data.attackId && <button onClick={() => { setAttackFilter(e.data.attackId!); setVisible(PAGE); }} className="font-semibold text-accent underline decoration-2 underline-offset-4" title="Show only this attack's entries">attack {e.data.attackId.slice(0, 6)}…</button>}
                    <span className={cx("font-semibold", status.startsWith("verified") ? "text-green-2" : status === "not verified yet" ? "text-muted" : "")}>{status.startsWith("verified") ? "✓ " : status === "not verified yet" ? "" : "✗ "}{status}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {entries.length === 0 && <div className="py-10 text-center text-[13px] text-muted">{all.length === 0 ? "The record is empty." : "No entries match."}</div>}
          {entries.length > visible && <div className="flex justify-center pt-2"><Button onClick={() => setVisible((v) => v + PAGE)}>Show {Math.min(PAGE, entries.length - visible)} more ({entries.length - visible} left)</Button></div>}
        </div>
      </div>
    </div>
  );
}

/** Horizontal block chain. Every entry is a block; links go red after a break. */
function ChainVisual({ entries, brokenAt, onJump }: { entries: AuditEntry[]; brokenAt: number | null; onJump: (seq: number) => void }) {
  const shown = entries.slice(-60);
  const hidden = entries.length - shown.length;
  return (
    <div className="pb-1 pt-3 sm:overflow-x-auto">
      <div className="flex flex-wrap items-center gap-1.5 sm:min-w-max sm:flex-nowrap sm:gap-0">
        {hidden > 0 && <span className="label mr-2 text-muted">+{hidden} earlier</span>}
        {shown.map((e, i) => {
          const broken = brokenAt != null && e.seq >= brokenAt;
          const isBreak = brokenAt === e.seq;
          const color = broken ? "var(--color-red)" : EVENT[e.event].color;
          const through = e.event === "blue_team_verdict" && e.data.verdict === "passed_through";
          return (
            <div key={e.seq} className="flex items-center">
              {i > 0 && <span className="hidden h-[2px] w-3 sm:block" style={{ background: broken ? "var(--color-red-2)" : "var(--color-line-strong)" }} />}
              <button onClick={() => onJump(e.seq)} aria-label={`Entry ${e.seq}: ${EVENT[e.event].label}${through ? ", got through" : ""}${broken ? ", broken" : ""}`} title={`#${e.seq} ${EVENT[e.event].label}`} className={cx("relative h-10 w-8 rounded-[6px] transition-transform hover:-translate-y-1 sm:h-8 sm:w-5 sm:rounded-[4px]", isBreak && "outline outline-2 outline-red-2")} style={{ background: color, opacity: broken && !isBreak ? 0.6 : 1 }}>
                {through && !broken && <span className="absolute -top-2 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-red-2" title="got through" />}
              </button>
            </div>
          );
        })}
      </div>
      <div className="label mt-2 flex justify-between text-muted">
        <span>#{shown[0]?.seq ?? 0} oldest</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-red-2" /> above a verdict = got through</span>
        <span>#{shown[shown.length - 1]?.seq ?? 0} newest</span>
      </div>
    </div>
  );
}
