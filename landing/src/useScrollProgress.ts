import { useEffect, useRef, useState } from 'react';

const LERP_TAU = 8;
const SNAP = 0.002;

export function useScrollProgress() {
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let span = 1;
    const measure = () => {
      const c = containerRef.current;
      span = Math.max(1, (c ? c.offsetHeight : 0) - window.innerHeight);
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);

    let raf = 0;
    let last = performance.now();
    let current = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const target = Math.max(0, Math.min(1, window.scrollY / span));
      if (reduced) current = target;
      else {
        current += (target - current) * (1 - Math.exp(-dt * LERP_TAU));
        if (Math.abs(target - current) < SNAP) current = target;
      }
      progressRef.current = current;
      setProgress((prev) => (Math.abs(prev - current) < 0.0005 ? prev : current));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, []);

  return { containerRef, progressRef, progress };
}
