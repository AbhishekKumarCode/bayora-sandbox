import { useEffect, useRef } from 'react';

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const LAYERS = [
  { src: '/videos/model.mp4', weight: (p: number) => 1 - smooth(0.24, 0.4, p) },
  { src: '/videos/attack.mp4', weight: (p: number) => smooth(0.24, 0.4, p) * (1 - smooth(0.6, 0.76, p)) },
  { src: '/videos/verdict.mp4', weight: (p: number) => smooth(0.6, 0.76, p) },
];

// Three looping clips, one per phase, crossfaded by scroll progress. A clip only
// plays while it is visible so the page never decodes three videos at once.
export function Footage({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  const refs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const p = progressRef.current;
      LAYERS.forEach((layer, i) => {
        const v = refs.current[i];
        if (!v) return;
        const w = layer.weight(p);
        v.style.opacity = String(w * 0.9);
        if (w > 0.02) { if (v.paused) v.play().catch(() => {}); }
        else if (!v.paused) v.pause();
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progressRef]);

  return (
    <div className="absolute inset-0" aria-hidden="true">
      {LAYERS.map((layer, i) => (
        <video
          key={layer.src}
          ref={(el) => { refs.current[i] = el; }}
          src={layer.src}
          muted
          loop
          playsInline
          preload={i === 0 ? 'auto' : 'metadata'}
          poster={i === 0 ? '/videos/model-poster.jpg' : undefined}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: i === 0 ? 0.9 : 0, transition: 'opacity 0.15s linear' }}
        />
      ))}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(11,16,32,0.78) 0%, rgba(11,16,32,0.45) 45%, rgba(11,16,32,0.25) 100%)' }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(11,16,32,0.55) 0%, rgba(11,16,32,0) 30%, rgba(11,16,32,0) 70%, rgba(11,16,32,0.7) 100%)' }} />
    </div>
  );
}
