import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { ShieldCheck, ShieldAlert, FlaskConical, Link2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { fmtTime, fmtDate } from "@/lib/model";
import { Button, Card, Pill, Hash, Actor, Heading, Stamp, cx } from "@/components/ui";
import { Legend } from "@/components/charts";
import type { AuditEntry, VerifyResult } from "@/lib/api";

const EVENT: Record<AuditEntry["event"], { label: string; actor: "attacker" | "model" | "judge"; color: string }> = {
  attack_submitted: { label: "Attack fired", actor: "attacker", color: "var(--color-red)" },
  llm_response_received: { label: "Model replied", actor: "model", color: "var(--color-violet)" },
  llm_error: { label: "Model error", actor: "model", color: "var(--color-red)" },
  blue_team_verdict: { label: "Blind verdict", actor: "judge", color: "var(--color-blue)" },
};

export function Audit() {
  const s = useStore();
  const { hash } = useLocation();
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [verifiedAt, setVerifiedAt] = useState<Date | null>(null);
  const [busy, setBusy] = useState<"verify" | "tamper" | null>(null);
  const [tamperSeq, setTamperSeq] = useState<number | "">("");
  const [filter, setFilter] = useState<"all" | AuditEntry["event"]>("all");
  const entries = useMemo(() => [...s.entries].reverse().filter((e) => filter === "all" || e.event === filter), [s.entries, filter]);
  const brokenAt = verify && !verify.ok ? verify.brokenAtSeq : null;

  useEffect(() => {
    if (!hash) return;
    const el = document.querySelector(hash);
    el?.scrollIntoView({ block: "center" });
    el?.classList.add("bg-white/80");
    const id = setTimeout(() => el?.classList.remove("bg-white/80"), 2000);
    return () => clearTimeout(id);
  }, [hash, s.entries.length]);

  async function run(kind: "verify" | "tamper") {
    setBusy(kind);
    try { setVerify(await s.verify(kind === "tamper" ? Number(tamperSeq || s.entries[1]?.seq || 1) : undefined)); if (kind === "verify") setVerifiedAt(new Date()); }
    finally { setBusy(null); }
  }
  function jump(seq: number) {
    setFilter("all");
    requestAnimationFrame(() => {
      const el = document.getElementById(`seq-${seq}`);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.classList.add("bg-white/80");
      setTimeout(() => el?.classList.remove("bg-white/80"), 1600);
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display text-[36px] sm:text-[44px]">Audit chain</h1>
        <p className="mt-2 text-[14.5px] font-semibold text-ink-2">The full record. Each entry carries a keyed hash of itself plus the previous entry, so editing one breaks every entry after it.</p>
      </div>

      {/* Chain visual + minimap */}
      <Card className="overflow-hidden p-0">
        <div className="border-b border-line p-5">
          <Heading title="The chain, end to end" desc={`${s.entries.length} entries. Each block is one event; the link is its hash of the one before. Click a block to jump to it.`} right={<Legend items={[{ color: "var(--color-red)", label: "Attack" }, { color: "var(--color-violet)", label: "Reply" }, { color: "var(--color-blue)", label: "Verdict" }]} />} />
          <ChainVisual entries={s.entries} brokenAt={brokenAt} onJump={jump} />
        </div>
        <div className="grid gap-5 p-5 lg:grid-cols-2">
          <div className="flex items-start gap-4">
            <div className={cx("flex h-12 w-12 shrink-0 items-center justify-center border border-line", brokenAt != null ? "bg-red text-white" : "bg-green")}>
              {brokenAt != null ? <ShieldAlert size={22} /> : <ShieldCheck size={22} />}
            </div>
            <div>
              <div className="display text-[18px]">
                {verify == null ? "Verify the whole chain" : verify.ok ? `Intact · ${verify.count} entries` : `Broken at entry ${verify.brokenAtSeq}`}
              </div>
              <div className="mt-1 text-[13px] font-semibold text-ink-2">
                {verify == null && "Recomputes every hash from the first entry with the broker's key. Not verified yet this session."}
                {verify?.ok && <>Final hash <Hash value={verify.finalHash} />{verifiedAt && <> · verified {verifiedAt.toLocaleTimeString()}</>}</>}
                {verify && !verify.ok && <>{verify.reason}. Every block after it turns red above.</>}
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="primary" onClick={() => run("verify")} disabled={busy != null}>{busy === "verify" ? "Verifying…" : "Verify chain"}</Button>
                {verify && <Button variant="ghost" onClick={() => setVerify(null)}>Clear</Button>}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-4 border border-dashed border-line-strong p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-line bg-amber"><FlaskConical size={18} strokeWidth={2.5} /></div>
            <div className="min-w-0">
              <div className="display text-[16px]">Try to tamper</div>
              <div className="mt-1 text-[12.5px] font-semibold text-ink-2">Pick an entry and pretend it was edited. The broker shows where verification would fail. The real record is untouched.</div>
              <div className="mt-3 flex items-center gap-2">
                <input type="number" min={1} max={s.entries.length} value={tamperSeq} onChange={(e) => setTamperSeq(e.target.value === "" ? "" : Number(e.target.value))} placeholder={`entry 1–${s.entries.length}`} className="b-input h-11 w-40" />
                <Button onClick={() => run("tamper")} disabled={busy != null}>{busy === "tamper" ? "Checking…" : "Tamper → verify"}</Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Filter */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap border border-line bg-card">
          {([["all", "All"], ["attack_submitted", "Attacks"], ["llm_response_received", "Replies"], ["blue_team_verdict", "Verdicts"], ["llm_error", "Errors"]] as const).map(([k, l], i) => (
            <button key={k} onClick={() => setFilter(k)} className={cx("label px-3 py-2", i > 0 && "border-l border-line", filter === k && "bg-white/80")}>{l}</button>
          ))}
        </div>
        <div className="label text-muted">{entries.length} of {s.entries.length} entries · newest first</div>
      </div>

      {/* Entries */}
      <div className="relative">
        <div className="absolute left-[27px] top-4 bottom-4 w-[3px] bg-ink" aria-hidden />
        <div className="space-y-4">
          {entries.map((e) => {
            const meta = EVENT[e.event];
            const broken = brokenAt != null && e.seq >= brokenAt;
            const isBreak = brokenAt === e.seq;
            return (
              <div id={`seq-${e.seq}`} key={e.seq} className={cx("b-card relative flex items-start gap-4 p-4", isBreak && "bg-red text-white")} style={broken ? { boxShadow: "0 0 0 1.5px var(--color-red-2)" } : undefined}>
                <div className="relative z-10 flex w-[22px] shrink-0 justify-center pt-1">
                  <span className={cx("h-4 w-4 border border-line", broken ? "bg-red" : "bg-green")} />
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
                  <div className="label mt-2 flex items-center gap-1 opacity-70">
                    <Link2 size={11} /> hash <Hash value={e.hash} n={8} />{e.seq > 1 && <> · linked to #{e.seq - 1}</>}
                  </div>
                </div>
              </div>
            );
          })}
          {entries.length === 0 && <div className="py-10 text-center text-[13px] text-muted">No entries.</div>}
        </div>
      </div>
    </div>
  );
}

/** Horizontal block chain. Every entry is a block; links go red after a break. */
function ChainVisual({ entries, brokenAt, onJump }: { entries: AuditEntry[]; brokenAt: number | null; onJump: (seq: number) => void }) {
  const shown = entries.slice(-60); // keep it legible
  const hidden = entries.length - shown.length;
  return (
    <div className="overflow-x-auto pb-1 pt-3">
      <div className="flex min-w-max items-center gap-0">
        {hidden > 0 && <span className="label mr-2 text-muted">+{hidden} earlier</span>}
        {shown.map((e, i) => {
          const broken = brokenAt != null && e.seq >= brokenAt;
          const isBreak = brokenAt === e.seq;
          const color = broken ? "var(--color-red)" : EVENT[e.event].color;
          return (
            <div key={e.seq} className="flex items-center">
              {i > 0 && <span className="h-[2px] w-3" style={{ background: broken ? "var(--color-red-2)" : "var(--color-line-strong)" }} />}
              <button onClick={() => onJump(e.seq)} title={`#${e.seq} ${EVENT[e.event].label}`} className={cx("relative h-8 w-5 rounded-[4px] transition-transform hover:-translate-y-1", isBreak && "outline outline-2 outline-red-2")} style={{ background: color, opacity: broken && !isBreak ? 0.6 : 1 }}>
                {e.event === "blue_team_verdict" && e.data.verdict === "passed_through" && !broken && <span className="absolute -top-2 left-1/2 h-2 w-2 -translate-x-1/2 border border-ink bg-red" title="got through" />}
              </button>
            </div>
          );
        })}
      </div>
      <div className="label mt-2 flex justify-between text-muted">
        <span>#{shown[0]?.seq ?? 0} oldest</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full border border-ink bg-red" /> above a verdict = got through</span>
        <span>#{shown[shown.length - 1]?.seq ?? 0} newest</span>
      </div>
    </div>
  );
}
