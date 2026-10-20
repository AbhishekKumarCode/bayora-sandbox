import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Lock, Eye, EyeOff, Network, Menu, X, Code2, Plus, Minus } from "lucide-react";
import { Button, Glow, Actor, Pill, cx } from "@/components/ui";
import { Logo } from "@/components/Shell";

export function Landing() {
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 12);
    f(); addEventListener("scroll", f, { passive: true });
    return () => removeEventListener("scroll", f);
  }, []);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* Nav */}
      <header className={cx("fixed inset-x-0 top-0 z-40 transition-all", scrolled ? "bg-canvas/80 backdrop-blur border-b border-line/80" : "")}>
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2"><Logo /><span className="text-[15px] font-semibold tracking-tight">Bayora Sandbox</span></Link>
          <nav className="hidden items-center gap-7 text-[13.5px] font-medium text-ink-2 md:flex">
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#isolation" className="hover:text-ink">Isolation</a>
            <a href="#proof" className="hover:text-ink">Sealed proof</a>
            <a href="#faq" className="hover:text-ink">FAQ</a>
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <Button variant="ghost" size="sm" to="/app/audit">Audit chain</Button>
            <Button size="sm" to="/app">Open the sandbox <ArrowRight size={14} /></Button>
          </div>
          <button onClick={() => setMenu(true)} aria-label="Open menu" className="rounded-[8px] p-2 md:hidden"><Menu size={20} /></button>
        </div>
      </header>
      {menu && (
        <div className="fixed inset-0 z-50 bg-canvas p-6 md:hidden rise">
          <div className="flex items-center justify-between"><span className="flex items-center gap-2"><Logo /><span className="font-semibold">Bayora Sandbox</span></span><button onClick={() => setMenu(false)} aria-label="Close menu" className="p-2"><X size={20} /></button></div>
          <nav className="mt-10 flex flex-col gap-5 text-[22px] font-semibold">
            <a href="#how" onClick={() => setMenu(false)}>How it works</a>
            <a href="#isolation" onClick={() => setMenu(false)}>Isolation</a>
            <a href="#proof" onClick={() => setMenu(false)}>Sealed proof</a>
            <a href="#faq" onClick={() => setMenu(false)}>FAQ</a>
            <Link to="/app" className="mt-4 text-brand">Open the sandbox →</Link>
          </nav>
        </div>
      )}

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
        <div className="grid-paper absolute inset-0" aria-hidden />
        <Glow tone="brand" size={760} className="-top-60 left-[55%] opacity-60" drift="a" />
        <Glow tone="attack" size={460} className="top-[30%] -left-40 opacity-45" drift="b" />
        <Glow tone="judge" size={520} className="top-[45%] right-[-12%] opacity-45" drift="c" />
        <Glow tone="sealed" size={420} className="bottom-[-10%] left-[35%] opacity-40" drift="a" />

        <div className="relative mx-auto grid max-w-[1200px] items-center gap-14 px-4 sm:px-6 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <Pill tone="brand" dot className="mb-5">Hack in Hills '26 · Track 04</Pill>
            <h1 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[56px]">
              Is your AI actually safe?<br />
              <span className="text-muted">Or does it just say so.</span>
            </h1>
            <p className="mt-6 max-w-[520px] text-[17px] leading-relaxed text-ink-2">
              A red team attacks your model. A blue team judges every reply without ever seeing the attack. Each verdict is sealed into an HMAC chain you can verify yourself.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" to="/app">Open the sandbox <ArrowRight size={16} /></Button>
              <Button size="lg" variant="secondary" to="/app/live">Watch a live run</Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-muted">
              <span className="flex items-center gap-1.5"><EyeOff size={14} className="text-judge" /> Judge never sees the prompt</span>
              <span className="flex items-center gap-1.5"><Network size={14} className="text-attack" /> Rooms share no network</span>
              <span className="flex items-center gap-1.5"><Lock size={14} className="text-sealed" /> HMAC-SHA256 chained log</span>
            </div>
          </div>
          <div className="lg:col-span-6"><HeroDiagram /></div>
        </div>
      </section>

      {/* Technique marquee */}
      <section className="border-y border-line/80 bg-white/60 py-5">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 text-[12.5px] font-medium uppercase tracking-[0.1em] text-muted">
          {["instruction override", "role-play bypass", "authority impersonation", "hypothetical framing", "prompt leak", "payload splitting", "encoding obfuscation"].map((t) => <span key={t}>{t}</span>)}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="relative py-24">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <div className="max-w-[640px]">
            <div className="text-[12px] font-medium uppercase tracking-[0.1em] text-brand">How a run works</div>
            <h2 className="mt-3 text-[32px] font-semibold leading-tight tracking-[-0.02em] sm:text-[40px]">Attack. Judge blind. Seal the record.</h2>
            <p className="mt-4 text-[16px] text-ink-2">Three rooms, one broker in the hallway. Nothing crosses between rooms except through it, and it writes everything down.</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            <StepCard n="01" kind="attacker" tone="attack" title="Red room attacks" desc="Fires jailbreaks, injections and leak attempts at the model under test. Holds only its own token." />
            <StepCard n="02" kind="judge" tone="judge" title="Blue room judges blind" desc="Receives the model's reply and nothing else. No prompt, no technique label, so the score can't be gamed." />
            <StepCard n="03" kind="seal" tone="sealed" title="Broker seals it" desc="Every event is appended to an HMAC-SHA256 chain. Alter one byte and verification fails from that entry on." />
          </div>
        </div>
      </section>

      {/* Bento */}
      <section id="isolation" className="relative py-24">
        <Glow tone="judge" size={600} className="left-[-10%] top-0 opacity-30" />
        <div className="relative mx-auto max-w-[1200px] px-4 sm:px-6">
          <div className="max-w-[640px]">
            <div className="text-[12px] font-medium uppercase tracking-[0.1em] text-judge">Isolation, enforced in code</div>
            <h2 className="mt-3 text-[32px] font-semibold leading-tight tracking-[-0.02em] sm:text-[40px]">Not promised. Built in.</h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-6">
            <Bento className="md:col-span-4" glow="attack">
              <div className="flex items-center gap-2"><Network size={16} className="text-attack" /><span className="text-[14px] font-semibold">Two networks, no bridge</span></div>
              <p className="mt-2 max-w-[460px] text-[14px] text-ink-2">The red room lives on <code className="mono">red-net</code>, the blue room on <code className="mono">blue-net</code>. Only the broker sits on both. There is no path between the rooms, so the judge cannot be nudged.</p>
              <NetDiagram />
            </Bento>
            <Bento className="md:col-span-2" glow="judge">
              <div className="flex items-center gap-2"><EyeOff size={16} className="text-judge" /><span className="text-[14px] font-semibold">Blind by API shape</span></div>
              <p className="mt-2 text-[14px] text-ink-2">The judge's only read is <code className="mono">GET /pending</code>, which returns reply text and an id. The prompt is not in the payload.</p>
              <pre className="mono mt-4 rounded-[10px] bg-canvas p-3 text-[12px] leading-relaxed text-ink-2">{`{ "item": {\n  "attackId": "c3e0…",\n  "response": "I can't…"\n} }`}</pre>
            </Bento>
            <Bento className="md:col-span-2" glow="brand">
              <div className="flex items-center gap-2"><Eye size={16} className="text-brand" /><span className="text-[14px] font-semibold">One token, one role</span></div>
              <p className="mt-2 text-[14px] text-ink-2">A valid blue token still gets <code className="mono">403</code> on <code className="mono">/audit</code>. Reading attacks out of the log is not a thing a judge can do.</p>
            </Bento>
            <Bento className="md:col-span-2" glow="sealed">
              <div className="flex items-center gap-2"><Lock size={16} className="text-sealed" /><span className="text-[14px] font-semibold">Keyed, not just hashed</span></div>
              <p className="mt-2 text-[14px] text-ink-2">A plain hash chain can be re-forged by anyone who can read it. An HMAC chain can't, without the key the rooms never hold.</p>
            </Bento>
            <Bento className="md:col-span-2" glow="pending">
              <div className="flex items-center gap-2"><ShieldCheck size={16} className="text-pending" /><span className="text-[14px] font-semibold">Hardened containers</span></div>
              <p className="mt-2 text-[14px] text-ink-2"><code className="mono">cap_drop: ALL</code>, no new privileges, read-only root, host port bound to loopback.</p>
            </Bento>
          </div>
        </div>
      </section>

      {/* Sealed proof */}
      <section id="proof" className="relative py-24">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-[24px] border border-line bg-white p-8 sm:p-12">
            <Glow tone="sealed" size={620} className="-top-40 -right-40 opacity-60" />
            <Glow tone="attack" size={400} className="-bottom-40 left-[20%] opacity-35" />
            <div className="relative grid items-center gap-10 lg:grid-cols-2">
              <div>
                <div className="text-[12px] font-medium uppercase tracking-[0.1em] text-sealed">Sealed proof</div>
                <h2 className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.02em] sm:text-[36px]">Tamper with it. Then watch it fail.</h2>
                <p className="mt-4 text-[15px] text-ink-2">The dashboard has a "Tamper → verify" control that asks the broker what verification would report if a single entry were altered. The real log is never touched. The break is found, and every later entry inherits it.</p>
                <div className="mt-6 flex gap-3">
                  <Button to="/app/audit">Try it on the chain <ArrowRight size={15} /></Button>
                </div>
              </div>
              <ChainDiagram />
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-10">
        <div className="mx-auto grid max-w-[1200px] gap-5 px-4 sm:px-6 md:grid-cols-3">
          <Big n="3" label="isolated rooms" sub="red, model, blue" />
          <Big n="0" label="shared networks" sub="between red and blue" />
          <Big n="1" label="key to the chain" sub="held by the broker only" />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24">
        <div className="mx-auto max-w-[800px] px-4 sm:px-6">
          <h2 className="text-[32px] font-semibold tracking-[-0.02em]">Questions</h2>
          <div className="mt-8 divide-y divide-line border-y border-line">
            <Faq q="Why does the judge have to be blind?">If the judge can see the attack, it can grade the attempt rather than the outcome. Blind scoring measures what the model actually did.</Faq>
            <Faq q="What stops the blue team from reading the log?">Role-scoped tokens. The blue token only unlocks <code className="mono">/pending</code> and <code className="mono">/score</code>. The audit routes need a separate token the rooms never receive.</Faq>
            <Faq q="Why HMAC instead of a plain hash chain?">A plain hash chain can be recomputed by anyone who can read it. HMAC needs the key, which lives only with the broker and the host-side verifier.</Faq>
            <Faq q="Does it work without a model API key?">Yes. The broker runs in mock mode with canned replies so the whole pipeline, including sealing and verification, works end to end.</Faq>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden py-24">
        <Glow tone="brand" size={700} className="left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-60" />
        <div className="relative mx-auto max-w-[760px] px-4 text-center sm:px-6">
          <h2 className="text-[36px] font-semibold leading-tight tracking-[-0.02em] sm:text-[48px]">Stop asking the model if it's safe.</h2>
          <p className="mt-4 text-[17px] text-ink-2">Attack it, judge it blind, and keep a record nobody can quietly edit.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" to="/app">Open the sandbox <ArrowRight size={16} /></Button>
            <a href="https://github.com/AbhishekKumarCode/bayora-sandbox" target="_blank" rel="noreferrer" className="inline-flex h-12 items-center gap-2 rounded-[10px] border border-line bg-white px-6 text-[15px] font-medium hover:border-line-strong"><Code2 size={16} /> Source</a>
          </div>
        </div>
      </section>

      <footer className="border-t border-line py-10">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 text-[13px] text-muted sm:px-6">
          <span className="flex items-center gap-2"><Logo size={20} /> Bayora Sandbox · Team Byteforce · Galgotias University</span>
          <span>Hack in Hills '26 · Track 04 · Securing Adversarial AI Safety Testing Infrastructure</span>
        </div>
      </footer>
    </div>
  );
}

/* ---------- pieces ---------- */

function HeroDiagram() {
  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      <div className="card relative overflow-hidden p-6 sm:p-8" style={{ transform: "perspective(1400px) rotateY(-6deg) rotateX(3deg)" }}>
        <Glow tone="brand" size={320} className="-top-28 left-1/2 -translate-x-1/2 opacity-50" />
        <div className="relative">
          <div className="flex items-center justify-between text-[12px] text-muted">
            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-attack pulse-ring text-attack relative" /> run 3 · in progress</span>
            <span className="mono">seq 41 → 47</span>
          </div>
          <div className="mt-6 grid grid-cols-3 items-start gap-2">
            <Pole kind="attacker" label="Red room" sub="attacks" />
            <Pole kind="model" label="Model" sub="under test" />
            <Pole kind="judge" label="Blue room" sub="judges blind" />
          </div>
          <svg className="pointer-events-none absolute left-0 right-0 top-[64px] h-2 w-full" aria-hidden>
            <line x1="22%" x2="44%" y1="4" y2="4" stroke="var(--color-attack)" strokeWidth="2" className="flow-line" />
            <line x1="56%" x2="78%" y1="4" y2="4" stroke="var(--color-judge)" strokeWidth="2" className="flow-line" />
          </svg>
          <div className="mt-6 space-y-2">
            <Row kind="attacker" text="instruction_override" right={<Pill tone="attack">fired</Pill>} />
            <Row kind="model" text="“I can't share my internal instructions…”" right={<Pill tone="brand">412 tok</Pill>} />
            <Row kind="judge" text="verdict · blocked" right={<Pill tone="sealed">92%</Pill>} />
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-[10px] bg-sealed-soft px-3 py-2 text-[12px]">
            <ShieldCheck size={14} className="text-sealed" />
            <span className="font-medium text-sealed">Sealed</span>
            <span className="mono text-muted">a91f3c…c3e0 ← 77b2…0d41</span>
          </div>
        </div>
      </div>
      {/* floating chips */}
      <div className="card absolute z-10 -left-10 top-[-18px] hidden items-center gap-2 px-3 py-2 text-[12px] font-medium sm:flex rise" style={{ animationDelay: ".3s" }}>
        <Actor kind="seal" size={22} /> chain intact · 47 entries
      </div>
      <div className="card absolute z-10 -right-8 -bottom-5 hidden items-center gap-2 px-3 py-2 text-[12px] font-medium sm:flex rise" style={{ animationDelay: ".5s" }}>
        <EyeOff size={14} className="text-judge" /> prompt hidden from judge
      </div>
    </div>
  );
}

function Pole({ kind, label, sub }: { kind: "attacker" | "model" | "judge"; label: string; sub: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="rounded-[14px] bg-white p-1.5 shadow-[0_1px_2px_rgb(17_19_24/0.06),0_0_0_1px_rgb(17_19_24/0.05)]"><Actor kind={kind} size={44} /></div>
      <div className="mt-2 text-[12.5px] font-semibold">{label}</div>
      <div className="text-[11.5px] text-muted">{sub}</div>
    </div>
  );
}

function Row({ kind, text, right }: { kind: "attacker" | "model" | "judge"; text: string; right: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] border border-line px-3 py-2">
      <Actor kind={kind} size={22} />
      <span className={cx("min-w-0 flex-1 truncate text-[12.5px]", kind === "model" ? "text-ink-2" : "mono")}>{text}</span>
      {right}
    </div>
  );
}

function StepCard({ n, kind, tone, title, desc }: { n: string; kind: "attacker" | "judge" | "seal"; tone: "attack" | "judge" | "sealed"; title: string; desc: string }) {
  return (
    <div className="card relative overflow-hidden p-6">
      <Glow tone={tone} size={260} className="-top-24 -right-24 opacity-60" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <Actor kind={kind} size={40} />
          <span className="mono text-[12px] text-faint">{n}</span>
        </div>
        <h3 className="mt-5 text-[17px] font-semibold tracking-tight">{title}</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{desc}</p>
      </div>
    </div>
  );
}

function Bento({ className, glow, children }: { className?: string; glow: "brand" | "attack" | "judge" | "sealed" | "pending"; children: React.ReactNode }) {
  return (
    <div className={cx("card relative overflow-hidden p-6", className)}>
      <Glow tone={glow} size={300} className="-top-28 -right-28 opacity-55" />
      <div className="relative">{children}</div>
    </div>
  );
}

function NetDiagram() {
  return (
    <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center text-[12px]">
      <div className="rounded-[12px] border border-attack/30 bg-attack-soft/60 p-4">
        <div className="font-semibold text-attack">red-net</div>
        <div className="mt-2 flex items-center justify-center gap-2"><Actor kind="attacker" size={28} /><span className="text-ink-2">red-team</span></div>
      </div>
      <div className="rounded-[12px] border border-line bg-white px-4 py-5">
        <div className="text-[11px] uppercase tracking-[0.1em] text-muted">hallway</div>
        <div className="mt-1 font-semibold">broker</div>
        <div className="mt-1 text-faint">on both</div>
      </div>
      <div className="rounded-[12px] border border-judge/30 bg-judge-soft/60 p-4">
        <div className="font-semibold text-judge">blue-net</div>
        <div className="mt-2 flex items-center justify-center gap-2"><Actor kind="judge" size={28} /><span className="text-ink-2">blue-team</span></div>
      </div>
    </div>
  );
}

function ChainDiagram() {
  const [tampered, setTampered] = useState(false);
  const boxes = [1, 2, 3, 4, 5];
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted">Audit chain</span>
        <button onClick={() => setTampered((t) => !t)} className={cx("rounded-full px-3 py-1 text-[12px] font-medium transition", tampered ? "bg-attack text-white" : "bg-pending-soft text-pending hover:bg-pending/20")}>{tampered ? "Restore" : "Tamper entry 3"}</button>
      </div>
      <div className="mt-4 space-y-2">
        {boxes.map((n) => {
          const broken = tampered && n >= 3;
          return (
            <div key={n} className={cx("flex items-center gap-3 rounded-[10px] border px-3 py-2.5 text-[12px] transition-colors", broken ? "border-attack/40 bg-attack-soft/50" : "border-line bg-white")}>
              <span className={cx("h-2.5 w-2.5 rounded-full ring-4", broken ? "bg-attack ring-attack/20" : "bg-sealed ring-sealed/20")} />
              <span className="mono text-muted">#{n}</span>
              <span className="font-medium">{["attack fired", "model replied", "blind verdict", "attack fired", "model replied"][n - 1]}</span>
              <span className="mono ml-auto text-faint">{broken ? (n === 3 ? "data altered" : "prev mismatch") : `h${n}…${(n * 37).toString(16)}`}</span>
            </div>
          );
        })}
      </div>
      <div className={cx("mt-3 flex items-center gap-2 rounded-[10px] px-3 py-2 text-[12.5px] font-medium", tampered ? "bg-attack-soft text-attack" : "bg-sealed-soft text-sealed")}>
        <ShieldCheck size={14} /> {tampered ? "verify → broken at seq 3 · data was altered" : "verify → ok · 5 entries · final hash matches"}
      </div>
    </div>
  );
}

function Big({ n, label, sub }: { n: string; label: string; sub: string }) {
  return (
    <div className="card p-6">
      <div className="text-[44px] font-semibold leading-none tracking-tight">{n}</div>
      <div className="mt-2 text-[14px] font-medium">{label}</div>
      <div className="text-[13px] text-muted">{sub}</div>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between py-5 text-left text-[16px] font-medium">
        {q}{open ? <Minus size={16} className="text-muted" /> : <Plus size={16} className="text-muted" />}
      </button>
      {open && <p className="pb-5 text-[15px] text-ink-2 rise">{children}</p>}
    </div>
  );
}
