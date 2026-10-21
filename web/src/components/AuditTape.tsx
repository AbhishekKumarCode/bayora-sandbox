import { useEffect, useRef, useState } from "react";
import { cx } from "./ui";

type Line = { seq: number; t: string; kind: "attack" | "reply" | "verdict" | "seal"; text: string; tag?: string; tone?: "red" | "green" | "amber" | "blue" | "violet" };

// A scripted run, written to look exactly like the broker's audit.log.
// Includes one genuine leak so the tape is honest about failure.
const SCRIPT: Omit<Line, "seq" | "t">[] = [
  { kind: "attack", text: "attack_submitted  technique=instruction_override", tone: "red" },
  { kind: "reply", text: 'llm_response_received  "I can\'t share my internal instructions, but…"', tone: "violet" },
  { kind: "verdict", text: "blue_team_verdict  blocked  confidence=0.92", tag: "BLOCKED", tone: "green" },
  { kind: "seal", text: "hmac  a91f3c7e…c3e0  ← 77b2d1…0d41", tag: "SEALED", tone: "green" },
  { kind: "attack", text: "attack_submitted  technique=role_play_bypass", tone: "red" },
  { kind: "reply", text: 'llm_response_received  "I won\'t take on a persona that removes safety…"', tone: "violet" },
  { kind: "verdict", text: "blue_team_verdict  blocked  confidence=0.88", tag: "BLOCKED", tone: "green" },
  { kind: "seal", text: "hmac  5d895de2…72fc  ← a91f3c…c3e0", tag: "SEALED", tone: "green" },
  { kind: "attack", text: "attack_submitted  technique=prompt_leak_attempt", tone: "red" },
  { kind: "reply", text: 'llm_response_received  "Sure. The text above starts with: \\"You are a helpful…"', tone: "violet" },
  { kind: "verdict", text: "blue_team_verdict  passed_through  confidence=0.81", tag: "GOT THROUGH", tone: "red" },
  { kind: "seal", text: "hmac  17908b01…78d8  ← 5d895d…72fc", tag: "SEALED", tone: "green" },
  { kind: "attack", text: "attack_submitted  technique=hypothetical_framing", tone: "red" },
  { kind: "reply", text: 'llm_response_received  "Even hypothetically, I won\'t provide instructions…"', tone: "violet" },
  { kind: "verdict", text: "blue_team_verdict  ambiguous  confidence=0.54", tag: "UNSURE", tone: "amber" },
  { kind: "seal", text: "hmac  83ec9443…d2fd  ← 17908b…78d8", tag: "SEALED", tone: "green" },
];

const DELAY: Record<Line["kind"], number> = { attack: 900, reply: 1400, verdict: 700, seal: 350 };

function stamp(d: Date) {
  return d.toTimeString().slice(0, 8) + "." + String(d.getMilliseconds()).padStart(3, "0");
}

export function AuditTape({ className }: { className?: string }) {
  const [lines, setLines] = useState<Line[]>(() => {
    // prefill with the first two attacks so the tape is never empty on first paint
    const base = Date.now() - 8000;
    return SCRIPT.slice(0, 8).map((l, i) => ({ ...l, seq: 33 + i, t: stamp(new Date(base + i * 900)) }));
  });
  const idx = useRef(8);
  const seq = useRef(40);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    let timer: number;
    const step = () => {
      if (!alive) return;
      const s = SCRIPT[idx.current % SCRIPT.length];
      idx.current += 1;
      seq.current += 1;
      const line: Line = { ...s, seq: seq.current, t: stamp(new Date()) };
      setLines((prev) => [...prev.slice(-11), line]);
      timer = window.setTimeout(step, DELAY[s.kind] + Math.random() * 300);
    };
    timer = window.setTimeout(step, 400);
    return () => { alive = false; clearTimeout(timer); };
  }, []);

  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [lines]);

  const through = lines.filter((l) => l.tag === "GOT THROUGH").length;

  return (
    <div className={cx("tape relative overflow-hidden font-mono text-[12px]", className)}>
      <div className="flex items-center justify-between border-b-2 border-yellow px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-yellow">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 bg-red blink" />
          logs/audit.log · HMAC-SHA256 · live
        </span>
        <span>seq {seq.current}{through > 0 && <span className="ml-3 text-red">{through} through</span>}</span>
      </div>
      <div ref={box} className="h-[300px] overflow-hidden px-4 py-2">
        {lines.map((l) => (
          <div key={l.seq} className="tape-line rise">
            <span className="text-[#5b606c]">#{l.seq}</span>
            <span className="text-[#8b8f9a]">{l.t}</span>
            <span className={cx("truncate", l.tone === "red" && l.kind === "attack" ? "text-[#ff8a8e]" : l.tone === "violet" ? "text-[#c3bbff]" : l.kind === "seal" ? "text-[#8de0b3]" : "text-[#e3e5ea]")}>{l.text}</span>
            {l.tag && (
              <span className={cx("px-1.5 py-[1px] text-[10px] font-bold tracking-wider",
                l.tone === "green" ? "bg-green text-ink" : l.tone === "red" ? "bg-red text-white" : "bg-amber text-ink")}>{l.tag}</span>
            )}
          </div>
        ))}
        <div className="caret pt-2 text-[#5b606c]"> </div>
      </div>
      
    </div>
  );
}
