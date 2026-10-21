import { useStore } from "@/lib/store";
import { fmtTime, shortHash } from "@/lib/model";
import { cx } from "./ui";

/** The last entries of the real audit log, in the broker's own format. */
export function AuditTape({ className }: { className?: string }) {
  const s = useStore();
  const lines = s.entries.slice(-12);
  const through = lines.filter((e) => e.event === "blue_team_verdict" && e.data.verdict === "passed_through").length;
  return (
    <div className={cx("tape relative overflow-hidden font-mono text-[12px]", className)}>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 text-[11px] font-semibold text-[#aab3c8]">
        <span className="flex items-center gap-2"><span className={cx("h-2 w-2 rounded-full", s.source === "broker" ? "bg-green" : "bg-faint")} />logs/audit.log · HMAC-SHA256 · {s.source === "broker" ? "live" : "offline"}</span>
        <span>{s.entries.length ? `seq ${s.entries[s.entries.length - 1].seq}` : "empty"}{through > 0 && <span className="ml-3 text-[#f0a8a3]">{through} through</span>}</span>
      </div>
      <div className="min-h-[220px] px-4 py-2">
        {lines.length === 0 && <div className="py-10 text-center text-[12px] text-[#8a93ad]">{s.source === "broker" ? "The record is empty. Start a run." : "Not connected to a broker."}</div>}
        {lines.map((e) => {
          const v = e.data.verdict;
          const tag = e.event === "blue_team_verdict" ? (v === "passed_through" ? "GOT THROUGH" : v === "blocked" ? "BLOCKED" : "UNSURE") : null;
          const text = e.event === "attack_submitted" ? `attack_submitted  technique=${e.data.technique}` : e.event === "llm_response_received" ? `llm_response_received  "${(e.data.responsePreview ?? "").slice(0, 60)}…"` : e.event === "blue_team_verdict" ? `blue_team_verdict  ${v}  confidence=${e.data.confidence ?? ""}` : `llm_error  ${e.data.error ?? ""}`;
          return (
            <div key={e.seq} className="tape-line">
              <span className="text-[#5b6480]">#{e.seq}</span>
              <span className="text-[#8a93ad]">{fmtTime(e.ts)}</span>
              <span className={cx("truncate", e.event === "attack_submitted" ? "text-[#f0a8a3]" : e.event === "llm_response_received" ? "text-[#c3b6f2]" : "text-[#e3e5ea]")}>{text}  <span className="text-[#5b6480]">{shortHash(e.hash, 5)}</span></span>
              {tag && <span className={cx("px-1.5 py-[1px] text-[10px] font-bold tracking-wider", tag === "BLOCKED" ? "bg-green text-ink" : tag === "GOT THROUGH" ? "bg-red-2 text-white" : "bg-amber text-ink")}>{tag}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
