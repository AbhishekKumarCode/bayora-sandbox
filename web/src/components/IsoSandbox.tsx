import { useEffect, useRef, useState } from "react";
import { cx } from "./ui";

/**
 * Isometric model of the sandbox: red room → hallway (broker) → blue room,
 * with a ledger stack. Soft faces, thin lines.
 *
 * Motion is "bubbly": a bubble is born at the source room, floats along the
 * tube with a gentle bob and squash, trailing smaller bubbles, lands with a
 * spring and pops into the destination. The active room breathes.
 *   model  – attack bubble  red room → hallway
 *   judge  – reply bubble   hallway  → blue room
 *   seal   – verdict bubble blue room → ledger (pops into a page)
 */
export type Stage = "idle" | "model" | "judge" | "seal";

const COS = Math.cos(Math.PI / 6), SIN = Math.sin(Math.PI / 6);
const INK = "#2b3140";
const iso = (x: number, y: number, z: number, ox: number, oy: number, s: number) => [ox + (x - y) * COS * s, oy + (x + y) * SIN * s - z * s] as const;
const pts = (list: Array<readonly [number, number]>) => list.map((p) => p.join(",")).join(" ");
// spring-ish ease: overshoots slightly then settles
const spring = (t: number) => 1 - Math.exp(-6 * t) * Math.cos(7 * t) * (1 - t) - (1 - t) * (1 - Math.exp(-6 * t));
const smooth = (t: number) => t * t * (3 - 2 * t);

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
  const base = P(x + w / 2, y + d / 2, 0);
  const halo = [P(x - 1.5, y - 1.5, 0.05), P(x + w + 1.5, y - 1.5, 0.05), P(x + w + 1.5, y + d + 1.5, 0.05), P(x - 1.5, y + d + 1.5, 0.05)];
  return (
    <g>
      <polygon points={pts(halo)} fill="#4a5be6" style={{ opacity: hot ? 0.14 : 0, transition: "opacity .6s ease" }} />
      <g style={{ transformOrigin: `${base[0]}px ${base[1]}px`, transform: hot ? "scale(1.03)" : "scale(1)", transition: "transform .6s cubic-bezier(.34,1.56,.64,1)" }}>
        <polygon points={pts(L)} fill={left} stroke={INK} strokeWidth={stroke} strokeLinejoin="round" />
        <polygon points={pts(R)} fill={right} stroke={INK} strokeWidth={stroke} strokeLinejoin="round" />
        <polygon points={pts(T)} fill={top} stroke={INK} strokeWidth={stroke} strokeLinejoin="round" />
        {label && <text x={c[0]} y={c[1] + 4} textAnchor="middle" fontFamily="Bricolage Grotesque, sans-serif" fontWeight="700" fontSize={13 * (s / 10)} fill={INK}>{label}</text>}
        {sub && <text x={c[0]} y={c[1] + 4 + 13 * (s / 10)} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize={9 * (s / 10)} fill={INK} opacity=".7">{sub}</text>}
      </g>
    </g>
  );
}

function Marker({ at, n, active }: { at: readonly [number, number]; n: number; active: boolean }) {
  return (
    <g style={{ transition: "opacity .4s, transform .5s cubic-bezier(.34,1.56,.64,1)", transformOrigin: `${at[0]}px ${at[1]}px`, transform: active ? "scale(1.15)" : "scale(1)" }} opacity={active ? 1 : 0.55}>
      <circle cx={at[0]} cy={at[1]} r={9} fill={active ? "#4a5be6" : "#fff"} stroke={active ? "#4a5be6" : INK} strokeWidth={1.3} />
      <text x={at[0]} y={at[1] + 3.5} textAnchor="middle" fontFamily="Public Sans, sans-serif" fontWeight="700" fontSize={10} fill={active ? "#fff" : INK}>{n}</text>
    </g>
  );
}

/** A soft bubble: squashes along its direction of travel, bobs, and has a highlight. */
function Bubble({ at, color, label, t, scale = 1 }: { at: readonly [number, number]; color: string; label?: string; t: number; scale?: number }) {
  const bob = Math.sin(t * Math.PI * 4) * 1.6;
  const sx = 1 + Math.sin(t * Math.PI * 4) * 0.08, sy = 1 - Math.sin(t * Math.PI * 4) * 0.08;
  const born = Math.min(1, t * 6), gone = t > 0.92 ? 1 - (t - 0.92) / 0.08 : 1; // grow in, shrink out
  const k = scale * spring(born) * (0.3 + 0.7 * gone);
  return (
    <g transform={`translate(${at[0]} ${at[1] + bob}) scale(${k * sx} ${k * sy})`}>
      <circle r="8" fill={color} stroke={INK} strokeWidth="1.2" opacity=".95" />
      <ellipse cx="-2.8" cy="-3" rx="2.4" ry="1.5" fill="#fff" opacity=".8" />
      {label && <text y="-13" textAnchor="middle" fontFamily="Public Sans, sans-serif" fontWeight="700" fontSize="9" fill={INK}>{label}</text>}
    </g>
  );
}

export const STAGE_STEPS: Array<{ key: Stage; n: number; title: string; desc: string }> = [
  { key: "model", n: 1, title: "Attack sent", desc: "The red room sends a prompt into the hallway, which forwards it to the model." },
  { key: "judge", n: 2, title: "Reply forwarded", desc: "Only the model's reply travels on. The prompt stays locked in the hallway." },
  { key: "seal", n: 3, title: "Judged and sealed", desc: "The blue room scores the reply without ever seeing the attack, and the verdict is chained into the ledger." },
];

export function IsoSandbox({ stage = "idle", through = 0, total = 0, model, className, compact = false, lastVerdict }: { stage?: Stage; through?: number; total?: number; model?: string; className?: string; compact?: boolean; lastVerdict?: "blocked" | "passed_through" | "ambiguous" | null }) {
  const s = compact ? 5.6 : 7.2;
  const minX = (-2 - 24) * COS * s, maxX = (56 + 2) * COS * s;
  const minY = (-2 + -2) * SIN * s - 9 * s, maxY = (56 + 24) * SIN * s + 2.5 * s;
  const pad = 14;
  const W = Math.ceil(maxX - minX + pad * 2), H = Math.ceil(maxY - minY + pad * 2 + 22);
  const ox = pad - minX, oy = pad - minY;
  const P = (a: number, b: number, c: number) => iso(a, b, c, ox, oy, s);
  const seq = Math.max(1, total);
  const stackH = Math.min(8, Math.max(3, seq)) * 0.9;
  const ledgerTop = P(28, 21.5, 1 + stackH);

  // bubble paths follow the tubes at tube height; the verdict bubble drops onto the ledger stack
  const pathA = [P(8, 8, 1.5), P(14, 8, 1.5), P(20, 8, 1.5), P(25, 8, 1.5)];
  const pathB = [P(27, 8, 1.5), P(34, 8, 1.5), P(40, 8, 1.5), P(45, 8, 1.5)];
  const pathC = [P(46, 8, 1.5), P(46, 15, 1.5), P(38, 20, 1.5), P(31, 21.5, 3), [ledgerTop[0], ledgerTop[1]] as const];

  const [t, setT] = useState(0);
  const raf = useRef<number | null>(null);
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    if (stage === "idle") { setT(0); return; }
    if (reduced) { setT(1); return; }
    const dur = stage === "seal" ? 1500 : 1300;
    const start = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / dur);
      setT(smooth(k));
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [stage, reduced]);

  const path = stage === "model" ? pathA : stage === "judge" ? pathB : stage === "seal" ? pathC : null;
  const color = stage === "model" ? "#e38b86" : stage === "judge" ? "#c3b6f2" : lastVerdict === "passed_through" ? "#f0a8a3" : lastVerdict === "ambiguous" ? "#f0cf93" : "#a9e0c3";
  const label = stage === "model" ? "attack" : stage === "judge" ? "reply" : "verdict";
  const landed = stage === "seal" && t > 0.93;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cx("h-auto w-full", className)} role="img" aria-label="Isometric model of the sandbox">
      <defs>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.2" /></filter>
      </defs>
      {/* floor */}
      <polygon points={pts([P(-2, -2, 0), P(56, -2, 0), P(56, 24, 0), P(-2, 24, 0)])} fill="#ffffff" stroke={INK} strokeWidth={1.5} />
      <polygon points={pts([P(-2, 24, 0), P(56, 24, 0), P(56, 24, -2.5), P(-2, 24, -2.5)])} fill="#e6e9f2" stroke={INK} strokeWidth={1.5} />
      <polygon points={pts([P(56, -2, 0), P(56, 24, 0), P(56, 24, -2.5), P(56, -2, -2.5)])} fill="#d3d7e3" stroke={INK} strokeWidth={1.5} />
      {/* trenches */}
      <polygon points={pts([P(0, 16, 0.2), P(15, 16, 0.2), P(15, 19, 0.2), P(0, 19, 0.2)])} fill="#f0a8a3" stroke={INK} strokeWidth={1.2} />
      <polygon points={pts([P(34, 16, 0.2), P(54, 16, 0.2), P(54, 19, 0.2), P(34, 19, 0.2)])} fill="#b3c6f4" stroke={INK} strokeWidth={1.2} />
      <text x={P(9, 17.5, 0.2)[0]} y={P(9, 17.5, 0.2)[1] + 3} textAnchor="middle" fontFamily="JetBrains Mono" fontSize={8} fontWeight="600" fill={INK}>red-net</text>
      <text x={P(48, 17.5, 0.2)[0]} y={P(48, 17.5, 0.2)[1] + 3} textAnchor="middle" fontFamily="JetBrains Mono" fontSize={8} fontWeight="600" fill={INK}>blue-net</text>

      {/* ledger stack (front-left) */}
      {Array.from({ length: Math.min(8, Math.max(3, seq)) }, (_, i) => {
        const red = i < through;
        const newest = i === Math.min(8, Math.max(3, seq)) - 1;
        return (
          <g key={i} style={newest && landed ? { transformOrigin: `${ledgerTop[0]}px ${ledgerTop[1]}px`, animation: "pop .5s cubic-bezier(.34,1.56,.64,1)" } : undefined}>
            <Box x={25} y={20} z={i * 0.9} w={6} d={3} h={0.9} top={red ? "#f0a8a3" : "#a9e0c3"} left={red ? "#cf7f79" : "#79bb98"} right={red ? "#e0948f" : "#8fcdab"} ox={ox} oy={oy} s={s} stroke={1.2} />
          </g>
        );
      })}

      {/* rooms and tubes, back to front */}
      <Box x={2} y={2} w={12} d={12} h={9} top="#f0a8a3" left="#cf7f79" right="#e0948f" ox={ox} oy={oy} s={s} label="Red room" sub="attacks" hot={stage === "model"} />
      <g>
        <polyline points={pts([P(14, 8, 1.5), P(20, 8, 1.5)])} fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
        <polyline points={pts([P(14, 8, 1.5), P(20, 8, 1.5)])} fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
      </g>
      {/* hallway */}
      <Box x={20} y={4} w={14} d={8} h={5} top="#d2c8f5" left="#ab9de0" right="#bfb2ea" ox={ox} oy={oy} s={s} label="Hallway" sub={model ? (model.split("/").pop() ?? model).slice(0, 14) : "broker"} hot={stage === "judge"} />
      <g transform={`translate(${P(27, 12, 2.5)[0] - 6} ${P(27, 12, 2.5)[1] - 8})`}>
        <rect x="0" y="6" width="12" height="9" rx="1.5" fill="#e9d99a" stroke={INK} strokeWidth="1.3" />
        <path d="M3 6V4a3 3 0 0 1 6 0v2" fill="none" stroke={INK} strokeWidth="1.3" />
      </g>

      <g>
        <polyline points={pts([P(34, 8, 1.5), P(40, 8, 1.5)])} fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
        <polyline points={pts([P(34, 8, 1.5), P(40, 8, 1.5)])} fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
      </g>
      <Box x={40} y={2} w={12} d={12} h={9} top="#b3c6f4" left="#8aa3dc" right="#9fb5e9" ox={ox} oy={oy} s={s} label="Blue room" sub="judges blind" hot={stage === "seal"} />

      {/* bubbles: a trail of three smaller ones behind the main bubble */}
      {path && t < 1 && (
        <g>
          {[0.14, 0.09, 0.05].map((lag, i) => {
            const tt = Math.max(0, t - lag);
            if (tt <= 0) return null;
            const at = alongPath(path, tt);
            return <circle key={i} cx={at[0]} cy={at[1] + Math.sin(tt * Math.PI * 4 + i) * 1.5} r={3.5 - i * 0.8} fill={color} opacity={0.35 - i * 0.08} stroke={INK} strokeWidth=".6" filter="url(#soft)" />;
          })}
          <Bubble at={alongPath(path, t)} color={color} label={label} t={t} />
        </g>
      )}
      {/* pop ring when the verdict lands */}
      {landed && (
        <circle cx={ledgerTop[0]} cy={ledgerTop[1]} r="10" fill="none" stroke={color} strokeWidth="1.5" style={{ animation: "ring .6s ease-out forwards", transformOrigin: `${ledgerTop[0]}px ${ledgerTop[1]}px` }} />
      )}

      {/* numbered markers: one shared baseline, centred over what each step happens in */}
      {(() => {
        const my = P(2, 2, 9)[1] - 24;
        return (
          <>
            <Marker at={[P(8, 8, 9)[0], my]} n={1} active={stage === "model"} />
            <Marker at={[P(27, 8, 5)[0], my]} n={2} active={stage === "judge"} />
            <Marker at={[P(46, 8, 9)[0], my]} n={3} active={stage === "seal"} />
          </>
        );
      })()}

      <text x={10} y={H - 8} textAnchor="start" fontFamily="Public Sans, sans-serif" fontSize={10} fontWeight="600" fill={INK} opacity=".7">Ledger · {total ? `${through} of ${total} got through` : "empty"}</text>
    </svg>
  );
}

/** A single-line stepper under the figure. */
export function StageSteps({ stage, compact = false }: { stage: Stage; compact?: boolean }) {
  const activeIndex = stage === "model" ? 0 : stage === "judge" ? 1 : stage === "seal" ? 2 : -1;
  return (
    <ol className={cx("flex flex-wrap items-center", compact ? "gap-x-3 gap-y-1" : "gap-x-4 gap-y-2")}>
      {STAGE_STEPS.map((st, i) => {
        const active = i === activeIndex, done = activeIndex > i;
        return (
          <li key={st.key} className="flex items-center gap-2 text-[13px]" title={st.desc}>
            <span className={cx("flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold transition-all duration-300", active ? "scale-110 bg-accent text-white" : done ? "bg-green text-ink" : "bg-white text-ink-2 ring-1 ring-line")}>{st.n}</span>
            <span className={cx("font-semibold transition-colors", active ? "text-ink" : "text-muted")}>{st.title}</span>
            {i < STAGE_STEPS.length - 1 && !compact && <span className="ml-2 h-px w-5 bg-line-strong" />}
          </li>
        );
      })}
    </ol>
  );
}
