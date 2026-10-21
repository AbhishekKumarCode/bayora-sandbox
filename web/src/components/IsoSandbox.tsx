import { cx } from "./ui";

/**
 * Isometric model of the sandbox: red room → hallway (broker) → blue room,
 * with a ledger stack. Pure SVG, thick ink outlines, flat faces.
 * `stage` lights the room that is working; `through`/`total` fill the ledger.
 */
type Stage = "idle" | "model" | "judge" | "seal";

const COS = Math.cos(Math.PI / 6), SIN = Math.sin(Math.PI / 6);
const iso = (x: number, y: number, z: number, ox: number, oy: number, s: number) => [ox + (x - y) * COS * s, oy + (x + y) * SIN * s - z * s] as const;
const pts = (list: Array<readonly [number, number]>) => list.map((p) => p.join(",")).join(" ");

function Box({ x, y, z = 0, w, d, h, top, left, right, ox, oy, s, label, sub, hot, stroke = 3 }: { x: number; y: number; z?: number; w: number; d: number; h: number; top: string; left: string; right: string; ox: number; oy: number; s: number; label?: string; sub?: string; hot?: boolean; stroke?: number }) {
  const P = (a: number, b: number, c: number) => iso(a, b, c, ox, oy, s);
  const T = [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)];
  const L = [P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)];
  const R = [P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)];
  const c = P(x + w / 2, y + d / 2, z + h);
  return (
    <g>
      {hot && <polygon points={pts(T)} fill="#ffd23f" opacity=".0" />}
      <polygon points={pts(L)} fill={left} stroke="#0d0d0d" strokeWidth={stroke} strokeLinejoin="round" />
      <polygon points={pts(R)} fill={right} stroke="#0d0d0d" strokeWidth={stroke} strokeLinejoin="round" />
      <polygon points={pts(T)} fill={top} stroke="#0d0d0d" strokeWidth={stroke} strokeLinejoin="round" />
      {hot && <polygon points={pts(T)} fill="none" stroke="#0d0d0d" strokeWidth={stroke} strokeDasharray="6 5" className="flow-line" />}
      {label && <text x={c[0]} y={c[1] + 4} textAnchor="middle" fontFamily="Bricolage Grotesque, sans-serif" fontWeight="800" fontSize={13 * (s / 10)} fill="#0d0d0d">{label}</text>}
      {sub && <text x={c[0]} y={c[1] + 4 + 13 * (s / 10)} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize={9 * (s / 10)} fill="#0d0d0d" opacity=".75">{sub}</text>}
    </g>
  );
}

export function IsoSandbox({ stage = "idle", through = 0, total = 0, model, className, compact = false }: { stage?: Stage; through?: number; total?: number; model?: string; className?: string; compact?: boolean }) {
  const s = compact ? 5.6 : 7.2;
  // scene bounds: x,y in [-2,56]x[-2,24], z in [-2.5, 9]. Derive the origin and
  // viewBox from them so nothing is ever clipped.
  const minX = (-2 - 24) * COS * s, maxX = (56 + 2) * COS * s;
  const minY = (-2 + -2) * SIN * s - 9 * s, maxY = (56 + 24) * SIN * s + 2.5 * s;
  const pad = 14;
  const W = Math.ceil(maxX - minX + pad * 2), H = Math.ceil(maxY - minY + pad * 2 + 22);
  const ox = pad - minX, oy = pad - minY;
  const P = (a: number, b: number, c: number) => iso(a, b, c, ox, oy, s);
  const live = stage !== "idle";
  // tube paths: red → hallway, hallway → blue
  const t1 = [P(14, 8, 7), P(20, 8, 7), P(20, 8, 4)];
  const t2 = [P(34, 8, 4), P(34, 8, 7), P(40, 8, 7)];
  const seq = Math.max(1, total);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cx("h-auto w-full", className)} role="img" aria-label="Isometric model of the sandbox">
      {/* floor */}
      <polygon points={pts([P(-2, -2, 0), P(56, -2, 0), P(56, 24, 0), P(-2, 24, 0)])} fill="#fffdf7" stroke="#0d0d0d" strokeWidth={3} />
      <polygon points={pts([P(-2, 24, 0), P(56, 24, 0), P(56, 24, -2.5), P(-2, 24, -2.5)])} fill="#ffd23f" stroke="#0d0d0d" strokeWidth={3} />
      <polygon points={pts([P(56, -2, 0), P(56, 24, 0), P(56, 24, -2.5), P(56, -2, -2.5)])} fill="#e0b320" stroke="#0d0d0d" strokeWidth={3} />
      {/* network trenches */}
      <polygon points={pts([P(0, 16, 0.2), P(20, 16, 0.2), P(20, 19, 0.2), P(0, 19, 0.2)])} fill="#ff4d3d" stroke="#0d0d0d" strokeWidth={2} />
      <polygon points={pts([P(34, 16, 0.2), P(54, 16, 0.2), P(54, 19, 0.2), P(34, 19, 0.2)])} fill="#4f8cff" stroke="#0d0d0d" strokeWidth={2} />
      <text x={P(15, 17.5, 0.2)[0]} y={P(15, 17.5, 0.2)[1] + 3} textAnchor="middle" fontFamily="JetBrains Mono" fontSize={8} fontWeight="700" fill="#fff">RED-NET</text>
      <text x={P(48, 17.5, 0.2)[0]} y={P(48, 17.5, 0.2)[1] + 3} textAnchor="middle" fontFamily="JetBrains Mono" fontSize={8} fontWeight="700" fill="#fff">BLUE-NET</text>
      {/* rooms (back to front) */}
      <Box x={2} y={2} w={12} d={12} h={9} top="#ff4d3d" left="#cc3a2d" right="#e2443a" ox={ox} oy={oy} s={s} label="RED ROOM" sub="attacks" hot={stage === "model"} />
      <Box x={40} y={2} w={12} d={12} h={9} top="#4f8cff" left="#3a69c2" right="#4478dd" ox={ox} oy={oy} s={s} label="BLUE ROOM" sub="judges blind" hot={stage === "seal"} />
      {/* tubes */}
      <polyline points={pts(t1)} fill="none" stroke="#0d0d0d" strokeWidth={7} strokeLinejoin="round" />
      <polyline points={pts(t1)} fill="none" stroke={live && stage === "model" ? "#ffd23f" : "#fffdf7"} strokeWidth={3} strokeLinejoin="round" className={cx(stage === "model" && "flow-line")} />
      <polyline points={pts(t2)} fill="none" stroke="#0d0d0d" strokeWidth={7} strokeLinejoin="round" />
      <polyline points={pts(t2)} fill="none" stroke={live && stage === "judge" ? "#ffd23f" : "#fffdf7"} strokeWidth={3} strokeLinejoin="round" className={cx(stage === "judge" && "flow-line")} />
      {/* hallway / broker */}
      <Box x={20} y={4} w={14} d={8} h={5} top="#a78bfa" left="#7c5ed6" right="#8f72e8" ox={ox} oy={oy} s={s} label="HALLWAY" sub={model ? model.slice(0, 18) : "broker"} hot={stage === "judge"} />
      {/* ledger stack in front */}
      {Array.from({ length: Math.min(8, Math.max(3, seq)) }, (_, i) => {
        const red = i < through;
        return <Box key={i} x={3} y={20.5} z={i * 0.9} w={6} d={3} h={0.9} top={red ? "#ff4d3d" : "#2bd36a"} left={red ? "#cc3a2d" : "#1f9c4e"} right={red ? "#e2443a" : "#25b85c"} ox={ox} oy={oy} s={s} stroke={2} />;
      })}
      <text x={10} y={H - 8} textAnchor="start" fontFamily="JetBrains Mono" fontSize={9} fontWeight="700" fill="#0d0d0d">LEDGER · {total ? `${through} OF ${total} THROUGH` : "EMPTY"}</text>
      {/* padlock on the hallway drawer */}
      <g transform={`translate(${P(27, 12, 2.5)[0] - 6} ${P(27, 12, 2.5)[1] - 8})`}>
        <rect x="0" y="6" width="12" height="9" fill="#ffd23f" stroke="#0d0d0d" strokeWidth="2" />
        <path d="M3 6V4a3 3 0 0 1 6 0v2" fill="none" stroke="#0d0d0d" strokeWidth="2" />
      </g>
    </svg>
  );
}
