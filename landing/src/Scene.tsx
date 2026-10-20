import { useEffect, useRef } from 'react';

type Node = { x: number; y: number; z: number; vx: number; vy: number; hit: number };
type Streak = { x: number; y: number; vx: number; vy: number; life: number; state: 'inbound' | 'deflected' | 'landed'; len: number };

const NAVY = '#0B1020';
const BLUE = [79, 125, 243] as const;
const RED = [244, 91, 91] as const;
const GREEN = [29, 185, 127] as const;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const rgba = (c: readonly [number, number, number], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export function Scene({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, dpr = 1;
    const nodes: Node[] = [];
    const streaks: Streak[] = [];
    const mouse = { x: 0.5, y: 0.5 };

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(220, (w * h) / 9000));
      nodes.length = 0;
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.pow(Math.random(), 0.6);
        nodes.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, z: 0.35 + Math.random() * 0.65, vx: (Math.random() - 0.5) * 0.0006, vy: (Math.random() - 0.5) * 0.0006, hit: 0 });
      }
    };
    resize();
    window.addEventListener('resize', resize);
    const onMove = (e: PointerEvent) => { mouse.x = e.clientX / w; mouse.y = e.clientY / h; };
    window.addEventListener('pointermove', onMove);

    let raf = 0;
    let last = performance.now();
    let t = 0;

    const frame = (now: number) => {
      const dt = reduced ? 0 : Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      const p = progressRef.current;

      const attack = smooth(0.22, 0.42, p) * (1 - 0.55 * smooth(0.72, 0.9, p));
      const shield = smooth(0.6, 0.78, p);
      const chain = smooth(0.74, 0.95, p);
      const drift = smooth(0.58, 0.76, p);

      const narrow = w < 768;
      const cx = (narrow ? w * 0.5 : w * (0.66 - 0.34 * drift)) + (mouse.x - 0.5) * 18;
      const cy = (narrow ? h * (0.78 - 0.1 * drift) : h * 0.52) + (mouse.y - 0.5) * 12;
      const R = Math.min(w, h) * (narrow ? 0.34 : 0.3 - 0.04 * drift);

      // background
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, NAVY); g.addColorStop(1, '#0E1530');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.9);
      glow.addColorStop(0, rgba(BLUE, 0.16 + 0.1 * shield)); glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);

      // lattice
      const pts: { x: number; y: number; z: number; n: Node }[] = [];
      for (const n of nodes) {
        n.x += n.vx * dt * 60; n.y += n.vy * dt * 60;
        if (n.x * n.x + n.y * n.y > 1) { n.vx *= -1; n.vy *= -1; }
        n.hit = Math.max(0, n.hit - dt * 1.4);
        const jitter = attack * (1 - shield) * 2.2;
        const x = cx + n.x * R * (0.9 + 0.1 * n.z) + Math.sin(t * 3 + n.x * 9) * jitter;
        const y = cy + n.y * R * (0.9 + 0.1 * n.z) + Math.cos(t * 2.6 + n.y * 7) * jitter;
        pts.push({ x, y, z: n.z, n });
      }
      const linkD = R * 0.34;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const d = Math.hypot(dx, dy);
          if (d > linkD) continue;
          const a = (1 - d / linkD) * 0.28 * Math.min(pts[i].z, pts[j].z);
          const red = Math.max(pts[i].n.hit, pts[j].n.hit);
          ctx.strokeStyle = red > 0 ? rgba(RED, a * 1.6 * red + a * (1 - red)) : rgba(BLUE, a);
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
        }
      }
      for (const q of pts) {
        const r = 1.2 + q.z * 1.6 + q.n.hit * 2;
        ctx.fillStyle = q.n.hit > 0 ? rgba(RED, 0.5 + 0.5 * q.n.hit) : rgba(BLUE, 0.45 + 0.5 * q.z);
        ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();
      }

      // attacks
      const wanted = Math.round(attack * 26);
      let active = streaks.filter((s) => s.state === 'inbound').length;
      while (active < wanted && Math.random() < 0.35) {
        const fromLeft = Math.random() < 0.7;
        const sy = cy + (Math.random() - 0.5) * h * 0.9;
        const sx = fromLeft ? -40 : w + 40;
        const ang = Math.atan2(cy + (Math.random() - 0.5) * R * 0.8 - sy, cx - sx);
        const sp = (260 + Math.random() * 220);
        streaks.push({ x: sx, y: sy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 1, state: 'inbound', len: 40 + Math.random() * 60 });
        active++;
      }
      for (let i = streaks.length - 1; i >= 0; i--) {
        const s = streaks[i];
        s.x += s.vx * dt; s.y += s.vy * dt;
        const d = Math.hypot(s.x - cx, s.y - cy);
        if (s.state === 'inbound' && d < R * 1.08) {
          if (shield > 0.45 && Math.random() < shield) {
            const nx = (s.x - cx) / d, ny = (s.y - cy) / d;
            const dot = s.vx * nx + s.vy * ny;
            s.vx = (s.vx - 2 * dot * nx) * 0.55; s.vy = (s.vy - 2 * dot * ny) * 0.55;
            s.state = 'deflected';
          } else if (d < R * 0.75) {
            s.state = 'landed';
            let best = pts[0], bd = Infinity;
            for (const q of pts) { const dd = Math.hypot(q.x - s.x, q.y - s.y); if (dd < bd) { bd = dd; best = q; } }
            best.n.hit = 1;
          }
        }
        if (s.state !== 'inbound') s.life -= dt * 1.6;
        if (s.life <= 0 || s.x < -120 || s.x > w + 120 || s.y < -120 || s.y > h + 120) { streaks.splice(i, 1); continue; }
        const sp = Math.hypot(s.vx, s.vy) || 1;
        const tx = s.x - (s.vx / sp) * s.len * s.life, ty = s.y - (s.vy / sp) * s.len * s.life;
        const lg = ctx.createLinearGradient(tx, ty, s.x, s.y);
        const col = s.state === 'deflected' ? BLUE : RED;
        lg.addColorStop(0, rgba(col, 0)); lg.addColorStop(1, rgba(col, 0.9 * s.life));
        ctx.strokeStyle = lg; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(s.x, s.y); ctx.stroke();
        ctx.fillStyle = rgba(col, s.life);
        ctx.beginPath(); ctx.arc(s.x, s.y, 2, 0, Math.PI * 2); ctx.fill();
      }

      // defender ring
      if (shield > 0) {
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = rgba(BLUE, 0.55 * shield);
        ctx.beginPath(); ctx.arc(cx, cy, R * 1.08, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([6, 14]); ctx.lineDashOffset = -t * 40;
        ctx.strokeStyle = rgba(BLUE, 0.9 * shield); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, R * 1.16, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        const ring = ctx.createRadialGradient(cx, cy, R * 1.0, cx, cy, R * 1.3);
        ring.addColorStop(0, rgba(BLUE, 0.14 * shield)); ring.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = ring; ctx.beginPath(); ctx.arc(cx, cy, R * 1.3, 0, Math.PI * 2); ctx.fill();
      }

      // hash chain
      if (chain > 0) {
        const n = 14, pad = w < 640 ? 24 : 48, y = h - (w < 640 ? 150 : 118);
        const span = Math.min(w - pad * 2, 620);
        const step = span / (n - 1);
        const shown = chain * n;
        ctx.font = '11px "JetBrains Mono", ui-monospace, monospace';
        for (let i = 0; i < n; i++) {
          const a = Math.max(0, Math.min(1, shown - i));
          if (a <= 0) break;
          const x = pad + i * step;
          if (i > 0) {
            ctx.strokeStyle = rgba(GREEN, 0.5 * a); ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x - step + 6, y); ctx.lineTo(x - 6, y); ctx.stroke();
          }
          ctx.strokeStyle = rgba(GREEN, 0.9 * a); ctx.lineWidth = 1.2;
          ctx.strokeRect(x - 5, y - 5, 10, 10);
          ctx.fillStyle = rgba(GREEN, 0.9 * a);
          ctx.fillRect(x - 2, y - 2, 4, 4);
        }
        ctx.fillStyle = rgba(GREEN, 0.7 * chain);
        ctx.fillText('HMAC CHAIN · VERIFIED', pad, y + 24);
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
    };
  }, [progressRef]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-hidden="true" />;
}
