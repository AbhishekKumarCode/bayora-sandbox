import { useEffect, useRef, useState } from "react";
import { cx } from "./ui";

/**
 * Isometric model of the sandbox: red room → hallway (broker) → blue room,
 * with a ledger stack. Pure SVG, thin ink outlines, soft faces.
 *
 * Stages animate the actual event:
 *   model  – an attack capsule travels red room → hallway
 *   judge  – a reply capsule travels hallway → blue room
 *   seal   – a verdict page drops from the blue room onto the ledger
 *   idle   – nothing moves; numbered markers explain the path
 */
export type Stage = "idle" | "model" | "judge" | "seal";

const COS = Math.cos(Math.PI / 6), SIN = Math.sin(Math.PI / 6);
const INK = "#2b3140";
const iso = (x: number, y: number, z: number, ox: number, oy: number, s: number) => [ox + (x - y) * COS * s, oy + (x + y) * SIN * s - z * s] as const;
const pts = (list: Array<readonly [number, number]>) => list.map((p) => p.join(",")).join(" ");
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function alongPath(path: Array<readonly [number, number]>, t: number): readonly [number, number] {
  const segs = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1]));
  const total = segs.reduce((a, b) => a + b, 0);
  let d = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) {
      const k = segs[i] === 0 ? 0 : d / segs[i];
      return [path[i][0] + (path[i + 1][0] - path[i][0]) * k, path[i][1] + (path[i + 1][1] - path[i][1]) * k];
    }
    d -= segs[i];
  }
  return path[path.length - 1];
}

function Box({ x, y, z = 0, w, d, h, top, left, right, ox, oy, s, label, sub, hot, stroke = 1.5 }: { x: number; y: number; z?: number; w: number; d: number; h: number; top: string; left: string; right: string; ox: number; oy: number; s: number; label?: string; sub?: string; hot?: boolean; stroke?: number }) {
  const P = (a: number, b: number, c: number) => iso(a, b, c, ox, oy, s);
  const T = [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)];
  const L = [P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)];
  const R = [P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)];
  const c = P(x + w / 2, y + d / 2, z + h);
  const floor = [P(x - 1.2, y - 1.2, 0.05), P(x + w + 1.2, y - 1.2, 0.05), P(x + w + 1.2, y + d + 1.2, 0.05), P(x - 1.2, y + d + 1.2, 0.05)];
  return (
    <g>
      <polygon points={pts(floor)} fill="#5b6cff" style={{ opacity: hot ? 0.16 : 0, transition: "opacity .5s ease" }} />
      <polygon points={pts(L)} fill={left} stroke={INK} strokeWidth={stroke} strokeLinejoin="round" />
      <polygon points={pts(R)} fill={right} stroke={INK} strokeWidth={stroke} strokeLinejoin="round" />
      <polygon points={pts(T)} fill={top} stroke={INK} strokeWidth={stroke} strokeLinejoin="round" />
      {label && <text x={c[0]} y={c[1] + 4} textAnchor="middle" fontFamily="Bricolage Grotesque, sans-serif" fontWeight="700" fontSize={13 * (s / 10)} fill={INK}>{label}</text>}
      {sub && <text x={c[0]} y={c[1] + 4 + 13 * (s / 10)} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize={9 * (s / 10)} fill={INK} opacity=".7">{sub}</text>}
    </g>
  );
}

function Marker({ at, n, active }: { at: readonly [number, number]; n: number; active: boolean }) {
  return (
    <g style={{ transition: "opacity .4s" }} opacity={active ? 1 : 0.55}>
      <circle cx={at[0]} cy={at[1]} r={9} fill={active ? "#5b6cff" : "#fff"} stroke={active ? "#5b6cff" : INK} strokeWidth={1.3} />
      <text x={at[0]} y={at[1] + 3.5} textAnchor="middle" fontFamily="Public Sans, sans-serif" fontWeight="700" fontSize={10} fill={active ? "#fff" : INK}>{n}</text>
    </g>
  );
}

export const STAGE_STEPS: Array<{ key: Stage | "done"; n: number; title: string; desc: string }> = [
  { key: "model", n: 1, title: "Attack sent", desc: "The red room drops a prompt into the hallway. The hallway forwards it to the model." },
  { key: "judge", n: 2, title: "Reply forwarded", desc: "Only the model's reply travels on to the blue room. The prompt stays locked in the hallway." },
  { key: "seal", n: 3, title: "Judged blind", desc: "The blue room scores the reply without seeing the attack and hands back a verdict." },
  { key: "done", n: 4, title: "Sealed", desc: "The verdict is written to the ledger, chained to the entry before it." },
];

export function IsoSandbox({ stage = "idle", through = 0, total = 0, model, className, compact = false, lastVerdict }: { stage?: Stage; through?: number; total?: number; model?: string; className?: string; compact?: boolean; lastVerdict?: "blocked" | "passed_through" | "ambiguous" | null }) {
  const s = compact ? 5.6 : 7.2;
  const minX = (-2 - 24) * COS * s, maxX = (56 + 2) * COS * s;
  const minY = (-2 + -2) * SIN * s - 9 * s, maxY = (56 + 24) * SIN * s + 2.5 * s;
  const pad = 14;
  const W = Math.ceil(maxX - minX + pad * 2), H = Math.ceil(maxY - minY + pad * 2 + 22);
  const ox = pad - minX, oy = pad - minY;
  const P = (a: number, b: number, c: number) => iso(a, b, c, ox, oy, s);

  // paths the capsule travels (world coords → screen)
  const tubeA = [P(14, 8, 7), P(20, 8, 7), P(20, 8, 4)];           // red room → hallway
  const tubeB = [P(34, 8, 4), P(34, 8, 7), P(40, 8, 7)];           // hallway → blue room
  const dropC = [P(46, 8, 9.5), P(46, 14, 9.5), P(6, 22, 1 + Math.min(8, Math.max(3, total)) * 0.9)]; // blue room → ledger
  const seq = Math.max(1, total);

  // ---- animation: progress 0..1 per stage, eased, rAF, transform only ----
  const [t, setT] = useState(0);
  const raf = useRef<number | null>(null);
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    if (stage === "idle") { setT(0); return; }
    if (reduced) { setT(1); return; }
    const dur = stage === "seal" ? 900 : 1100;
    const start = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / dur);
      setT(ease(k));
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [stage, reduced]);

  const capsule = stage === "model" ? alongPath(tubeA, t) : stage === "judge" ? alongPath(tubeB, t) : null;
  const page = stage === "seal" ? alongPath(dropC, t) : null;
  const pageColor = lastVerdict === "passed_through" ? "#f0a8a3" : lastVerdict === "ambiguous" ? "#f0cf93" : "#a9e0c3";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cx("h-auto w-full", className)} role="img" aria-label="Isometric model of the sandbox">
      {/* floor */}
      <polygon points={pts([P(-2, -2, 0), P(56, -2, 0), P(56, 24, 0), P(-2, 24, 0)])} fill="#ffffff" stroke={INK} strokeWidth={1.5} />
      <polygon points={pts([P(-2, 24, 0), P(56, 24, 0), P(56, 24, -2.5), P(-2, 24, -2.5)])} fill="#e6e9f2" stroke={INK} strokeWidth={1.5} />
      <polygon points={pts([P(56, -2, 0), P(56, 24, 0), P(56, 24, -2.5), P(56, -2, -2.5)])} fill="#d3d7e3" stroke={INK} strokeWidth={1.5} />
      {/* network trenches */}
      <polygon points={pts([P(0, 16, 0.2), P(20, 16, 0.2), P(20, 19, 0.2), P(0, 19, 0.2)])} fill="#f0a8a3" stroke={INK} strokeWidth={1.2} />
      <polygon points={pts([P(34, 16, 0.2), P(54, 16, 0.2), P(54, 19, 0.2), P(34, 19, 0.2)])} fill="#b3c6f4" stroke={INK} strokeWidth={1.2} />
      <text x={P(15, 17.5, 0.2)[0]} y={P(15, 17.5, 0.2)[1] + 3} textAnchor="middle" fontFamily="JetBrains Mono" fontSize={8} fontWeight="600" fill={INK}>RED-NET</text>
      <text x={P(48, 17.5, 0.2)[0]} y={P(48, 17.5, 0.2)[1] + 3} textAnchor="middle" fontFamily="JetBrains Mono" fontSize={8} fontWeight="600" fill={INK}>BLUE-NET</text>

      {/* ledger stack (front-left) */}
      {Array.from({ length: Math.min(8, Math.max(3, seq)) }, (_, i) => {
        const red = i < through;
        return <Box key={i} x={3} y={20.5} z={i * 0.9} w={6} d={3} h={0.9} top={red ? "#f0a8a3" : "#a9e0c3"} left={red ? "#cf7f79" : "#79bb98"} right={red ? "#e0948f" : "#8fcdab"} ox={ox} oy={oy} s={s} stroke={1.2} />;
      })}

      {/* rooms (back to front) */}
      <Box x={2} y={2} w={12} d={12} h={9} top="#f0a8a3" left="#cf7f79" right="#e0948f" ox={ox} oy={oy} s={s} label="RED ROOM" sub="attacks" hot={stage === "model"} />
      <Box x={40} y={2} w={12} d={12} h={9} top="#b3c6f4" left="#8aa3dc" right="#9fb5e9" ox={ox} oy={oy} s={s} label="BLUE ROOM" sub="judges blind" hot={stage === "seal"} />

      {/* tubes */}
      <polyline points={pts(tubeA)} fill="none" stroke={INK} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={pts(tubeA)} fill="none" stroke="#fff" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={pts(tubeB)} fill="none" stroke={INK} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={pts(tubeB)} fill="none" stroke="#fff" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {/* hallway / broker */}
      <Box x={20} y={4} w={14} d={8} h={5} top="#d2c8f5" left="#ab9de0" right="#bfb2ea" ox={ox} oy={oy} s={s} label="HALLWAY" sub={model ? model.slice(0, 18) : "broker"} hot={stage === "judge"} />
      {/* padlock on the hallway drawer: the prompt stays here */}
      <g transform={`translate(${P(27, 12, 2.5)[0] - 6} ${P(27, 12, 2.5)[1] - 8})`}>
        <rect x="0" y="6" width="12" height="9" rx="1.5" fill="#e9d99a" stroke={INK} strokeWidth="1.3" />
        <path d="M3 6V4a3 3 0 0 1 6 0v2" fill="none" stroke={INK} strokeWidth="1.3" />
      </g>

      {/* moving capsule */}
      {capsule && (
        <g transform={`translate(${capsule[0]} ${capsule[1]})`}>
          <ellipse cx="0" cy="0" rx="7" ry="4.5" fill={stage === "model" ? "#e38b86" : "#c3b6f2"} stroke={INK} strokeWidth="1.3" />
          <text x="0" y="-9" textAnchor="middle" fontFamily="Public Sans, sans-serif" fontWeight="700" fontSize="9" fill={INK}>{stage === "model" ? "attack" : "reply"}</text>
        </g>
      )}
      {/* dropping verdict page */}
      {page && (
        <g transform={`translate(${page[0]} ${page[1]}) rotate(${(1 - t) * 18})`} opacity={0.5 + t * 0.5}>
          <polygon points="-9,-4 9,-4 9,4 -9,4" fill={pageColor} stroke={INK} strokeWidth="1.2" />
          <text x="0" y="-8" textAnchor="middle" fontFamily="Public Sans, sans-serif" fontWeight="700" fontSize="9" fill={INK}>verdict</text>
        </g>
      )}

      {/* numbered markers */}
      <Marker at={[P(8, 8, 9)[0], P(8, 8, 9)[1] - 26]} n={1} active={stage === "model"} />
      <Marker at={[P(27, 8, 5)[0], P(27, 8, 5)[1] - 24]} n={2} active={stage === "judge"} />
      <Marker at={[P(46, 8, 9)[0], P(46, 8, 9)[1] - 26]} n={3} active={stage === "seal"} />
      <Marker at={[P(6, 22, 1)[0] - 2, P(6, 22, 1)[1] - 8 - Math.min(8, Math.max(3, seq)) * 0.9 * s - 14]} n={4} active={false} />

      <text x={10} y={H - 8} textAnchor="start" fontFamily="JetBrains Mono" fontSize={9} fontWeight="600" fill={INK}>LEDGER · {total ? `${through} OF ${total} THROUGH` : "EMPTY"}</text>
    </svg>
  );
}

/** Caption strip: the four steps, with the active one highlighted and a progress bar for the stage. */
export function StageSteps({ stage, compact = false }: { stage: Stage; compact?: boolean }) {
  const activeIndex = stage === "model" ? 0 : stage === "judge" ? 1 : stage === "seal" ? 2 : -1;
  return (
    <ol className={cx("grid gap-2", compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4")}>
      {STAGE_STEPS.map((st, i) => {
        const active = i === activeIndex;
        const done = activeIndex > i || (stage === "idle" && false);
        return (
          <li key={st.key} className={cx("rounded-[12px] border px-3 py-2.5 transition-colors duration-300", active ? "border-accent bg-white/90" : "border-line bg-white/50")}>
            <div className="flex items-center gap-2">
              <span className={cx("flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold transition-colors", active ? "bg-accent text-white" : done ? "bg-green text-ink" : "bg-white text-ink-2 ring-1 ring-line")}>{st.n}</span>
              <span className={cx("text-[13px] font-semibold", active ? "text-ink" : "text-ink-2")}>{st.title}</span>
            </div>
            {!compact && <p className="mt-1 text-[12px] leading-snug text-muted">{st.desc}</p>}
          </li>
        );
      })}
    </ol>
  );
}
