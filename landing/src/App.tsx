import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, ArrowDown, ChevronUp, Info, X } from 'lucide-react';
import { useVideoScrub } from '@/useVideoScrub';

const VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260821_114821_a8ca298f-be2c-4613-a4dd-51b69e16bbde.mp4';
const DARK = '#1D3045';
const APP = '/app/';

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

function Navbar({ isLight, onMenu }: { isLight: boolean; onMenu: () => void }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setEntered(true), 200);
    return () => window.clearTimeout(t);
  }, []);
  const color = isLight ? DARK : '#ffffff';
  const enter = (delay: number) => ({
    opacity: entered ? 1 : 0,
    transform: entered ? 'translateY(0)' : 'translateY(-12px)',
    transition: `opacity 0.6s ${EASE} ${delay}ms, transform 0.6s ${EASE} ${delay}ms, color 0.5s`,
  });

  return (
    <header className="absolute top-0 left-0 right-0 z-50 pointer-events-auto px-6 sm:px-8 md:px-12 pt-8 sm:pt-12 pb-6 flex items-center justify-between transition-colors duration-500" style={{ color }}>
      <button
        type="button"
        aria-label="Open menu"
        onClick={onMenu}
        className="lg:hidden flex flex-col"
        style={{ gap: 5, ...enter(100) }}
      >
        <span style={{ width: 24, height: 2, background: color, transition: 'background 0.5s' }} />
        <span style={{ width: 24, height: 2, background: color, transition: 'background 0.5s' }} />
        <span style={{ width: 16, height: 2, background: color, transition: 'background 0.5s' }} />
      </button>

      <nav className="hidden lg:flex items-center gap-8 xl:gap-10">
        {NAV.map((item, i) => (
          <a
            key={item.label}
            href={item.href}
            className="relative text-xs tracking-[0.15em] uppercase font-medium hover:opacity-70"
            style={enter(i * 80 + 100)}
          >
            {item.label}
            {item.active && (
              <span className="absolute left-0 right-0 -bottom-3 h-[2px]" style={{ background: color, transition: 'background 0.5s' }} />
            )}
          </a>
        ))}
      </nav>

      <div className="hidden sm:flex items-center gap-8" style={enter(500)}>
        <a href={APP} className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase font-medium hover:opacity-70">
          NEWS
          <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: color, transition: 'background 0.5s' }}>
            <Info size={10} style={{ color: isLight ? '#ffffff' : DARK }} />
          </span>
        </a>
        <span className="hidden lg:inline text-xs tracking-[0.2em] uppercase font-medium">MENU</span>
        <button type="button" onClick={onMenu} className="lg:hidden text-xs tracking-[0.2em] uppercase font-medium hover:opacity-70">
          MENU
        </button>
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
      style={{ background: DARK, transitionTimingFunction: 'cubic-bezier(0.4,0,0.2,1)' }}
    >
      <div className={`flex flex-col flex-1 transition-transform duration-500 ${open ? 'translate-y-0' : '-translate-y-8'}`} style={{ transitionTimingFunction: 'cubic-bezier(0.4,0,0.2,1)' }}>
        <div className="flex justify-end px-6 sm:px-8 pt-8 sm:pt-12">
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="w-10 h-10 rounded-full border border-white/30 hover:border-white flex items-center justify-center text-white transition-colors"
          >
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
          <a href={APP} className="hover:text-white transition-colors">NEWS</a>
          <a href={`${APP}?page=settings`} className="hover:text-white transition-colors">CONTACT</a>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { videoRef, canvasRef, containerRef, scrollProgress: p, canvasLive } = useVideoScrub(VIDEO_SRC);
  const [menuOpen, setMenuOpen] = useState(false);

  const o1 = s1Opacity(p);
  const o2 = s2Opacity(p);
  const o3 = s3Opacity(p);
  const isLight = p <= 0.55;
  const sectionStyle = (o: number) => ({ opacity: o, transition: 'opacity 0.1s ease-out' });

  return (
    <>
      <div ref={containerRef} className="relative h-[500vh]">
        <div className="sticky top-0 w-full h-screen overflow-hidden">
          <video
            ref={videoRef}
            src={VIDEO_SRC}
            muted
            playsInline
            preload="auto"
            crossOrigin="anonymous"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <canvas
            ref={canvasRef}
            width={1920}
            height={1080}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${canvasLive ? 'opacity-100' : 'opacity-0'}`}
          />

          <div className="absolute inset-0 pointer-events-none">
            <Navbar isLight={isLight} onMenu={() => setMenuOpen(true)} />

            {/* Section 1 */}
            <section className="absolute inset-0 flex items-center px-6 sm:px-8 md:px-20 lg:px-32" style={sectionStyle(o1)}>
              <div>
                <Stagger visible={o1 > 0.3} delay={0}>
                  <h1 className="font-light uppercase leading-[1.2]" style={{ fontSize: 'clamp(2rem,5vw,5rem)', color: DARK }}>
                    Adversarial testing for a safer AI future
                  </h1>
                </Stagger>
                <Stagger visible={o1 > 0.3} delay={150}>
                  <p className="mt-6 text-sm tracking-[0.3em] uppercase" style={{ color: '#1D304590' }}>
                    Trust, made verifiable
                  </p>
                </Stagger>
              </div>
              <Stagger visible={o1 > 0.3} delay={300} className="absolute bottom-12 right-6 sm:right-8 md:right-12 pointer-events-auto">
                <a
                  href={APP}
                  aria-label="Open the sandbox"
                  className="w-12 h-12 rounded-full border flex items-center justify-center hover:opacity-70 transition-opacity"
                  style={{ borderColor: '#1D304580', color: DARK }}
                >
                  <ArrowRight size={18} />
                </a>
              </Stagger>
            </section>

            {/* Section 2 */}
            <section className="absolute inset-0 flex items-center justify-center px-6 sm:px-8" style={sectionStyle(o2)}>
              <Stagger visible={o2 > 0.3} delay={0} className="max-w-[900px]">
                <h2 className="font-extralight tracking-wide leading-[1.3] text-center uppercase" style={{ fontSize: 'clamp(1.5rem,4.5vw,4.5rem)', color: DARK }}>
                  We prove AI safety with isolation <span style={{ color: '#1D3045CC' }}>and blind judgment</span>{' '}
                  <span style={{ color: '#1D304580' }}>across every attack</span>
                </h2>
              </Stagger>
              <div className="absolute bottom-16 right-6 sm:right-8 md:right-12 flex flex-col items-center gap-4">
                <Stagger visible={o2 > 0.3} delay={200}>
                  <span className="w-12 h-12 rounded-full border flex items-center justify-center" style={{ borderColor: '#1D304566', color: DARK }}>
                    <ArrowDown size={18} />
                  </span>
                </Stagger>
                <Stagger visible={o2 > 0.3} delay={350} className="mt-4 flex flex-col items-center gap-2">
                  <span className="rounded-full" style={{ width: 8, height: 8, background: DARK }} />
                  <span className="rounded-full" style={{ width: 6, height: 6, background: '#1D304566' }} />
                  <span className="rounded-full" style={{ width: 6, height: 6, background: '#1D304566' }} />
                </Stagger>
                <Stagger visible={o2 > 0.3} delay={500} className="mt-2">
                  <span className="w-10 h-10 rounded-full border flex items-center justify-center" style={{ borderColor: '#1D30454D', color: '#1D3045CC' }}>
                    <ChevronUp size={16} />
                  </span>
                </Stagger>
              </div>
            </section>

            {/* Section 3 */}
            <section className="absolute inset-0 flex items-center justify-end px-6 sm:px-8 md:px-20 lg:px-32" style={sectionStyle(o3)}>
              <div className="max-w-2xl text-left">
                <Stagger visible={o3 > 0.3} delay={0}>
                  <p className="text-white/60 text-lg tracking-wide mb-4">Byteforce | Hack in Hills ’26</p>
                </Stagger>
                <Stagger visible={o3 > 0.3} delay={150}>
                  <h2 className="font-light text-white leading-[1.2] uppercase tracking-wide mb-8" style={{ fontSize: 'clamp(2rem,4vw,4rem)' }}>
                    Attack. Judge blind.
                    <br />
                    Seal the record.
                  </h2>
                </Stagger>
                <Stagger visible={o3 > 0.3} delay={300} className="pointer-events-auto">
                  <a href={APP} className="inline-flex items-center gap-4 group">
                    <span className="text-sm tracking-[0.3em] text-white/80 uppercase">Open the sandbox</span>
                    <span className="w-10 h-10 rounded-full bg-white text-gray-800 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                      <ArrowRight size={16} />
                    </span>
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
