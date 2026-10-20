import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, ArrowDown, ChevronUp, Info, X } from 'lucide-react';
import { useScrollProgress } from '@/useScrollProgress';
import { Scene } from '@/Scene';
import { Footage } from '@/Footage';

const APP = '/app/';
const NAVY = '#0B1020';

const NAV = [
  { label: 'BAYORA SANDBOX', href: APP, active: true },
  { label: 'LIVE TESTING', href: `${APP}?page=live-testing` },
  { label: 'ATTACK LIBRARY', href: `${APP}?page=attack-library` },
  { label: 'DEFENSE LAB', href: `${APP}?page=defense-lab` },
  { label: 'AUDIT LOGS', href: `${APP}?page=audit-logs` },
];

const EASE = 'cubic-bezier(0.16,1,0.3,1)';

function Stagger({ visible, delay, children, className = '' }: { visible: boolean; delay: number; children: ReactNode; className?: string }) {
  return (
    <div
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.8s ${EASE} ${delay}ms, transform 0.8s ${EASE} ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

function s1Opacity(p: number) {
  return p < 0.2 ? 1 : Math.max(0, 1 - (p - 0.2) / 0.08);
}
function s2Opacity(p: number) {
  if (p < 0.32) return 0;
  if (p < 0.4) return (p - 0.32) / 0.08;
  if (p < 0.55) return 1;
  return Math.max(0, 1 - (p - 0.55) / 0.08);
}
function s3Opacity(p: number) {
  if (p < 0.67) return 0;
  if (p < 0.75) return (p - 0.67) / 0.08;
  return 1;
}

function Mono({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-[11px] tracking-[0.18em] uppercase ${className}`}>{children}</span>;
}

function Navbar({ onMenu }: { onMenu: () => void }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setEntered(true), 200);
    return () => window.clearTimeout(t);
  }, []);
  const enter = (delay: number) => ({
    opacity: entered ? 1 : 0,
    transform: entered ? 'translateY(0)' : 'translateY(-12px)',
    transition: `opacity 0.6s ${EASE} ${delay}ms, transform 0.6s ${EASE} ${delay}ms`,
  });

  return (
    <header className="absolute top-0 left-0 right-0 z-50 pointer-events-auto px-6 sm:px-8 md:px-12 pt-8 sm:pt-12 pb-6 flex items-center justify-between text-white">
      <button type="button" aria-label="Open menu" onClick={onMenu} className="lg:hidden flex flex-col" style={{ gap: 5, ...enter(100) }}>
        <span className="bg-white" style={{ width: 24, height: 2 }} />
        <span className="bg-white" style={{ width: 24, height: 2 }} />
        <span className="bg-white" style={{ width: 16, height: 2 }} />
      </button>

      <nav className="hidden lg:flex items-center gap-8 xl:gap-10">
        {NAV.map((item, i) => (
          <a key={item.label} href={item.href} className="relative text-xs tracking-[0.15em] uppercase font-medium hover:opacity-70 transition-opacity" style={enter(i * 80 + 100)}>
            {item.label}
            {item.active && <span className="absolute left-0 right-0 -bottom-3 h-[2px] bg-white" />}
          </a>
        ))}
      </nav>

      <div className="hidden sm:flex items-center gap-8" style={enter(500)}>
        <a href={APP} className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase font-medium hover:opacity-70 transition-opacity">
          DEMO
          <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center">
            <Info size={10} style={{ color: NAVY }} />
          </span>
        </a>
        <span className="hidden lg:inline text-xs tracking-[0.2em] uppercase font-medium">MENU</span>
        <button type="button" onClick={onMenu} className="lg:hidden text-xs tracking-[0.2em] uppercase font-medium hover:opacity-70">MENU</button>
      </div>
    </header>
  );
}

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col transition-all duration-500 ${open ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
      style={{ background: NAVY, transitionTimingFunction: 'cubic-bezier(0.4,0,0.2,1)' }}
    >
      <div className={`flex flex-col flex-1 transition-transform duration-500 ${open ? 'translate-y-0' : '-translate-y-8'}`} style={{ transitionTimingFunction: 'cubic-bezier(0.4,0,0.2,1)' }}>
        <div className="flex justify-end px-6 sm:px-8 pt-8 sm:pt-12">
          <button type="button" aria-label="Close menu" onClick={onClose} className="w-10 h-10 rounded-full border border-white/30 hover:border-white flex items-center justify-center text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 flex flex-col justify-center px-8 sm:px-12">
          {NAV.map((item, i) => (
            <a
              key={item.label}
              href={item.href}
              className={`py-3 text-2xl sm:text-3xl font-light tracking-wide uppercase transition-colors ${item.active ? 'text-white' : 'text-white/60 hover:text-white'}`}
              style={{
                opacity: open ? 1 : 0,
                transform: open ? 'translateY(0)' : 'translateY(20px)',
                transition: `opacity 0.6s ${EASE} ${i * 60}ms, transform 0.6s ${EASE} ${i * 60}ms, color 0.3s`,
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex gap-8 px-8 sm:px-12 pb-10 text-xs tracking-[0.2em] uppercase text-white/60">
          <a href={APP} className="hover:text-white transition-colors">DEMO</a>
          <a href={`${APP}?page=settings`} className="hover:text-white transition-colors">CONTACT</a>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { containerRef, progressRef, progress: p } = useScrollProgress();
  const [menuOpen, setMenuOpen] = useState(false);

  const o1 = s1Opacity(p);
  const o2 = s2Opacity(p);
  const o3 = s3Opacity(p);
  const sectionStyle = (o: number) => ({ opacity: o, transition: 'opacity 0.1s ease-out' });
  const phase = p < 0.3 ? '01 — MODEL UNDER TEST' : p < 0.63 ? '02 — RED TEAM ATTACKING' : '03 — BLIND VERDICT · SEALED';

  return (
    <>
      <div ref={containerRef} className="relative h-[500vh]">
        <div className="sticky top-0 w-full h-screen overflow-hidden" style={{ background: NAVY }}>
          <Footage progressRef={progressRef} />
          <Scene progressRef={progressRef} />

          <div className="absolute inset-0 pointer-events-none text-white">
            <Navbar onMenu={() => setMenuOpen(true)} />

            <div className="absolute left-6 sm:left-8 md:left-12 bottom-12 hidden sm:flex items-center gap-3">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: p < 0.3 ? '#4F7DF3' : p < 0.63 ? '#F45B5B' : '#1DB97F' }} />
              <Mono className="text-white/60">{phase}</Mono>
            </div>

            {/* Section 1 */}
            <section className="absolute inset-0 flex items-center px-6 sm:px-8 md:px-20 lg:px-32" style={sectionStyle(o1)}>
              <div className="max-w-3xl">
                <Stagger visible={o1 > 0.3} delay={0}>
                  <Mono className="text-white/55">Secure adversarial AI safety testing</Mono>
                </Stagger>
                <Stagger visible={o1 > 0.3} delay={100}>
                  <h1 className="mt-5 font-light leading-[1.08] tracking-[-0.02em]" style={{ fontSize: 'clamp(2.2rem,5vw,5rem)' }}>
                    Is your AI actually&nbsp;safe?<br />
                    <span className="text-white/55">Or does it just say so.</span>
                  </h1>
                </Stagger>
                <Stagger visible={o1 > 0.3} delay={200}>
                  <p className="mt-6 max-w-xl text-base sm:text-lg text-white/65 leading-relaxed font-light">
                    A red team attacks the model. A separate judge scores every answer blind. Every step is sealed in a tamper-evident log. Scroll to watch it happen.
                  </p>
                </Stagger>
              </div>
              <Stagger visible={o1 > 0.3} delay={300} className="absolute bottom-12 right-6 sm:right-8 md:right-12 pointer-events-auto">
                <a href={APP} aria-label="Open the sandbox" className="w-12 h-12 rounded-full border border-white/50 flex items-center justify-center hover:opacity-70 transition-opacity">
                  <ArrowRight size={18} />
                </a>
              </Stagger>
            </section>

            {/* Section 2 */}
            <section className="absolute inset-0 flex items-center justify-center px-6 sm:px-8" style={sectionStyle(o2)}>
              <Stagger visible={o2 > 0.3} delay={0} className="max-w-[900px] text-center">
                <Mono className="text-[#F45B5B]">Attacks in flight</Mono>
                <h2 className="mt-5 font-extralight leading-[1.25] tracking-[-0.01em]" style={{ fontSize: 'clamp(1.6rem,4.5vw,4.5rem)' }}>
                  Isolated rooms. One broker. <span className="text-white/70">The judge never sees the attack</span> <span className="text-white/45">— so the score can't be gamed.</span>
                </h2>
              </Stagger>
              <div className="absolute bottom-16 right-6 sm:right-8 md:right-12 flex flex-col items-center gap-4">
                <Stagger visible={o2 > 0.3} delay={200}>
                  <span className="w-12 h-12 rounded-full border border-white/40 flex items-center justify-center"><ArrowDown size={18} /></span>
                </Stagger>
                <Stagger visible={o2 > 0.3} delay={350} className="mt-4 flex flex-col items-center gap-2">
                  <span className="rounded-full bg-white" style={{ width: 8, height: 8 }} />
                  <span className="rounded-full bg-white/40" style={{ width: 6, height: 6 }} />
                  <span className="rounded-full bg-white/40" style={{ width: 6, height: 6 }} />
                </Stagger>
                <Stagger visible={o2 > 0.3} delay={500} className="mt-2">
                  <span className="w-10 h-10 rounded-full border border-white/30 text-white/80 flex items-center justify-center"><ChevronUp size={16} /></span>
                </Stagger>
              </div>
            </section>

            {/* Section 3 */}
            <section className="absolute inset-0 flex items-center justify-end px-6 sm:px-8 md:px-20 lg:px-32" style={sectionStyle(o3)}>
              <div className="max-w-2xl text-left">
                <Stagger visible={o3 > 0.3} delay={0}>
                  <Mono className="text-[#1DB97F]">Verdict sealed · HMAC chain intact</Mono>
                </Stagger>
                <Stagger visible={o3 > 0.3} delay={150}>
                  <h2 className="mt-5 font-light leading-[1.15] tracking-[-0.02em] mb-8" style={{ fontSize: 'clamp(2rem,4vw,4rem)' }}>
                    Attack. Judge blind.<br />Seal the record.
                  </h2>
                </Stagger>
                <Stagger visible={o3 > 0.3} delay={300} className="pointer-events-auto">
                  <a href={APP} className="inline-flex items-center gap-4 group">
                    <span className="text-sm tracking-[0.3em] text-white/80 uppercase">Open the sandbox</span>
                    <span className="w-10 h-10 rounded-full bg-white text-gray-900 flex items-center justify-center transition-transform duration-300 group-hover:scale-110"><ArrowRight size={16} /></span>
                  </a>
                </Stagger>
              </div>
            </section>
          </div>
        </div>
      </div>
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
