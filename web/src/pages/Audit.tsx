import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { ShieldCheck, ShieldAlert, FlaskConical } from "lucide-react";
import { useStore } from "@/lib/store";
import { fmtTime, fmtDate } from "@/lib/model";
import { Button, Card, Pill, Hash, Actor, cx } from "@/components/ui";
import type { AuditEntry, VerifyResult } from "@/lib/api";

const EVENT: Record<AuditEntry["event"], { label: string; actor: "attacker" | "model" | "judge"; tone: "attack" | "brand" | "judge" }> = {
  attack_submitted: { label: "Attack fired", actor: "attacker", tone: "attack" },
  llm_response_received: { label: "Model replied", actor: "model", tone: "brand" },
  llm_error: { label: "Model error", actor: "model", tone: "attack" },
  blue_team_verdict: { label: "Blind verdict", actor: "judge", tone: "judge" },
};

export function Audit() {
  const s = useStore();
  const { hash } = useLocation();
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState<"verify" | "tamper" | null>(null);
  const [tamperSeq, setTamperSeq] = useState<number | "">("");
  const [filter, setFilter] = useState<"all" | AuditEntry["event"]>("all");
  const entries = useMemo(() => [...s.entries].reverse().filter((e) => filter === "all" || e.event === filter), [s.entries, filter]);
  const brokenAt = verify && !verify.ok ? verify.brokenAtSeq : null;

  useEffect(() => {
    if (!hash) return;
    const el = document.querySelector(hash);
    el?.scrollIntoView({ block: "center" });
    el?.classList.add("ring-2", "ring-brand/50");
    const id = setTimeout(() => el?.classList.remove("ring-2", "ring-brand/50"), 2000);
    return () => clearTimeout(id);
  }, [hash, s.entries.length]);

  async function run(kind: "verify" | "tamper") {
    setBusy(kind);
    try { setVerify(await s.verify(kind === "tamper" ? Number(tamperSeq || s.entries[1]?.seq || 1) : undefined)); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight">Audit chain</h1>
        <p className="mt-1 text-[13.5px] text-muted">The full record, newest first. Each entry carries a keyed hash of itself plus the previous entry, so editing one breaks every entry after it.</p>
      </div>

      {/* Verify panel */}
      <Card className="p-5" glow={brokenAt != null ? "attack" : "sealed"}>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="flex items-start gap-4">
            <div className={cx("flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px]", brokenAt != null ? "bg-attack-soft text-attack" : "bg-sealed-soft text-sealed")}>
              {brokenAt != null ? <ShieldAlert size={22} /> : <ShieldCheck size={22} />}
            </div>
            <div>
              <div className="text-[15px] font-semibold">
                {verify == null ? "Verify the whole chain" : verify.ok ? `Intact · ${verify.count} entries` : `Broken at entry ${verify.brokenAtSeq}`}
              </div>
              <div className="mt-0.5 text-[13px] text-muted">
                {verify == null && "Recomputes every HMAC from the first entry with the broker's key."}
                {verify?.ok && <>Final hash <Hash value={verify.finalHash} /></>}
                {verify && !verify.ok && <>{verify.reason}. Entries after it are shown as inherited breaks.</>}
              </div>
              <div className="mt-3 flex gap-2">
                <Button onClick={() => run("verify")} disabled={busy != null}>{busy === "verify" ? "Verifying…" : "Verify chain"}</Button>
                {verify && <Button variant="ghost" onClick={() => setVerify(null)}>Clear</Button>}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-4 rounded-[12px] border border-dashed border-line-strong p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-pending-soft text-pending"><FlaskConical size={18} /></div>
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold">Try to tamper</div>
              <div className="mt-0.5 text-[12.5px] text-muted">Pick an entry number and pretend it was edited. The broker shows where verification would fail. The real record is untouched.</div>
              <div className="mt-3 flex items-center gap-2">
                <input type="number" min={1} max={s.entries.length} value={tamperSeq} onChange={(e) => setTamperSeq(e.target.value === "" ? "" : Number(e.target.value))} placeholder={`seq (1–${s.entries.length})`} className="mono h-9 w-36 rounded-[10px] border border-line bg-white px-3 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
                <Button variant="secondary" onClick={() => run("tamper")} disabled={busy != null}>{busy === "tamper" ? "Checking…" : "Tamper → verify"}</Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Filter */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-[10px] bg-[#eceef2] p-1 text-[12.5px]">
          {([["all", "All"], ["attack_submitted", "Attacks"], ["llm_response_received", "Replies"], ["blue_team_verdict", "Verdicts"], ["llm_error", "Errors"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={cx("rounded-[8px] px-2.5 py-1 font-medium", filter === k ? "bg-white shadow-sm" : "text-muted hover:text-ink")}>{l}</button>
          ))}
        </div>
        <div className="text-[12.5px] text-muted">{entries.length} of {s.entries.length} entries · newest first</div>
      </div>

      {/* Chain */}
      <div className="relative">
        <div className="absolute left-[27px] top-4 bottom-4 w-px bg-line" aria-hidden />
        <div className="space-y-2">
          {entries.map((e) => {
            const meta = EVENT[e.event];
            const broken = brokenAt != null && e.seq >= brokenAt;
            const isBreak = brokenAt === e.seq;
            return (
              <div id={`seq-${e.seq}`} key={e.seq} className={cx("card relative ml-0 flex items-start gap-4 p-4 transition-shadow", broken && "ring-1 ring-attack/40", isBreak && "bg-attack-soft/40")}>
                <div className="relative z-10 flex w-[22px] shrink-0 justify-center pt-1">
                  <span className={cx("h-3 w-3 rounded-full ring-4", broken ? "bg-attack ring-attack/20" : "bg-sealed ring-sealed/20")} />
                </div>
                <Actor kind={meta.actor} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="mono text-[12px] text-muted">#{e.seq}</span>
                    <span className="text-[14px] font-semibold">{meta.label}</span>
                    {e.event === "attack_submitted" && <span className="mono text-[12.5px] text-attack">{e.data.technique}</span>}
                    {e.event === "blue_team_verdict" && <span className={cx("text-[13px] font-medium", e.data.verdict === "blocked" ? "text-sealed" : e.data.verdict === "passed_through" ? "text-attack" : "text-pending")}>{e.data.verdict === "passed_through" ? "got through" : e.data.verdict} · {Math.round((e.data.confidence ?? 0) * 100)}% sure</span>}
                    {isBreak && <Pill tone="attack" dot>altered here</Pill>}
                    {broken && !isBreak && <Pill tone="attack">broken by #{brokenAt}</Pill>}
                    <span className="ml-auto text-[12px] text-muted">{fmtDate(e.ts)} {fmtTime(e.ts)}</span>
                  </div>
                  {e.event === "llm_response_received" && <div className="mono mt-1 truncate text-[12.5px] text-ink-2">"{e.data.responsePreview}"</div>}
                  {e.event === "blue_team_verdict" && e.data.notes && <div className="mt-1 text-[12.5px] text-ink-2">{e.data.notes}</div>}
                  {e.event === "llm_error" && <div className="mono mt-1 text-[12.5px] text-attack">{e.data.error}</div>}
                  <div className="mt-1.5 text-[12px] text-muted">
                    hash <Hash value={e.hash} n={8} />{e.seq > 1 && <> · linked to #{e.seq - 1}</>}
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
