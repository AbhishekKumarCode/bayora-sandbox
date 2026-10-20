import { useEffect, useState } from "react";
import { ShieldCheck, TrendingDown, Target, Bot } from "lucide-react";
import { getAudit, type AuditEntry } from "../lib/api";
import { computeStats } from "../lib/stats";
import { useCountUp } from "../lib/useCountUp";
import { Card, PageHead, ScoreRing } from "../components/ui";
import ActivityFeed from "../components/ActivityFeed";
import RoomCard from "../components/RoomCard";
import AttackPipeline from "../components/AttackPipeline";

function Kpi({ label, value, sub }: { label: string; value: number | string; sub: string }) {
  const numeric = typeof value === "number" ? value : parseInt(String(value).match(/^-?\d+/)?.[0] ?? "0", 10);
  const animated = useCountUp(Number.isFinite(numeric) ? numeric : 0);
  const suffix = typeof value === "string" ? value.replace(/^-?\d+/, "") : "";
  return (
    <div className="p-5 md:p-6">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-display mt-1.5 text-[32px] font-semibold leading-none tabular-nums">
        {animated}
        {suffix}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

export default function Overview() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sealed, setSealed] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const { entries } = await getAudit();
        if (!cancelled) {
          setEntries(entries);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "could not reach broker");
      }
    }
    poll();
    const id = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const stats = computeStats(entries);
  const shown = sealed ? stats.catchRate : stats.illustrativeLeakyRate;
  const gap = stats.illustrativeLeakyRate - stats.catchRate;

  return (
    <div className="flex flex-col gap-6 stagger">
      <div className="max-md:hidden">
        <PageHead title="Overview" sub="Is your AI actually safe? Here's the evidence, not just the claim." />
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5 text-destructive text-sm">
          Can't reach the broker right now — is it running? ({error})
        </Card>
      )}

      <section className="grid text-white lg:grid-cols-[1.05fr_1fr]">
        <div className="flex flex-col rounded-t-3xl bg-hero p-7 md:p-9 lg:rounded-3xl lg:rounded-tr-none">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm text-white/70">Trust Switch</p>
            <button
              onClick={() => setSealed((s) => !s)}
              className={`relative w-11 h-6 rounded-full transition-colors ${sealed ? "bg-caught" : "bg-leak"}`}
              aria-label="Toggle sealed/leaky"
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  sealed ? "translate-x-[22px]" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
          <div className="mt-3 flex items-end gap-4">
            <ScoreRing value={shown} size={72} tone={sealed ? "caught" : "leak"} dark />
            <h2 className="text-[34px] font-semibold leading-[1.08] md:text-[40px]">
              {sealed ? "Sealed" : "Leaky"}
            </h2>
          </div>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/80">
            {sealed
              ? "This is the real, verified catch rate — the defender never sees the attack prompt."
              : "Illustrative: what the score would look like if grading weren't isolated. Looks safer than it is."}
          </p>
          <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-white/20 pt-5">
            <div>
              <dt className="text-xs text-white/60">Attacks tried</dt>
              <dd className="font-display mt-1 text-2xl font-semibold tabular-nums">{stats.attacksTested}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/60">Caught</dt>
              <dd className="font-display mt-1 text-2xl font-semibold tabular-nums">{stats.caught}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/60">Gap if unsealed</dt>
              <dd className="font-display mt-1 text-2xl font-semibold tabular-nums">
                {gap}
                <span className="text-base font-medium text-white/50"> pts</span>
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-4 bg-hero px-7 pb-6 pt-7 md:px-9 md:pt-9 lg:rounded-tr-3xl">
            <div>
              <h3 className="text-lg font-semibold">The three rooms</h3>
              <p className="mt-1 text-sm text-white/70">Separate keys, one hallway, no shortcuts.</p>
            </div>
          </div>
          <div className="relative flex flex-1">
            <span aria-hidden className="absolute left-0 top-0 size-8 bg-hero" />
            <div className="relative flex flex-1 flex-col rounded-b-3xl bg-white p-7 text-foreground md:p-9 lg:rounded-tl-[2rem]">
              <div className="grid flex-1 gap-3">
                <RoomCard
                  icon={Target}
                  title="Attacker room"
                  description="Invents tricky prompts to trip up the model."
                  agentLabel="Red-team agent v4"
                  tone="attacker"
                />
                <RoomCard
                  icon={Bot}
                  title="Model under test"
                  description="Answers whatever it's given, with no idea it's being tested."
                  agentLabel="Subject model v1"
                  tone="default"
                />
                <RoomCard
                  icon={ShieldCheck}
                  title="Defender room"
                  description="Judges answers as safe or not — never sees the question."
                  agentLabel="Safety judge v2"
                  tone="defender"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 divide-border rounded-card border border-border bg-card lg:grid-cols-4 lg:divide-x [&>*:nth-child(-n+2)]:border-b [&>*:nth-child(-n+2)]:border-border lg:[&>*:nth-child(-n+2)]:border-b-0">
        <Kpi label="Attacks tried" value={stats.attacksTested} sub="this run" />
        <Kpi label="Caught" value={stats.caught} sub={`${stats.gotThrough} got through · ${stats.unsure} unsure`} />
        <Kpi label="Catch rate" value={`${stats.catchRate}%`} sub="the real number" />
        <Kpi label="Verdicts scored" value={`${stats.verdictsSoFar} / ${stats.attacksTested}`} sub="blind evaluation" />
      </section>

      <section className="grid divide-border rounded-card border border-border bg-card md:grid-cols-3 md:divide-x">
        <div className="flex gap-3 p-5">
          <Target size={18} className="mt-0.5 shrink-0 text-attacker" />
          <div>
            <p className="text-sm font-semibold">Blind by design</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              The defender only ever sees the model's answer, never the attack prompt — enforced in code.
            </p>
          </div>
        </div>
        <div className="flex gap-3 p-5">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-defender" />
          <div>
            <p className="text-sm font-semibold">Tamper-evident</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Every event is HMAC-chained. Edit one line and Verify points straight at it.
            </p>
          </div>
        </div>
        <div className="flex gap-3 p-5">
          <TrendingDown size={18} className="mt-0.5 shrink-0 text-leak" />
          <div>
            <p className="text-sm font-semibold">The gap is the point</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Most safety claims can't prove the grading wasn't rigged. The Trust Switch makes that visible.
            </p>
          </div>
        </div>
      </section>

      <AttackPipeline entries={entries} />

      <ActivityFeed entries={entries} limit={8} />
    </div>
  );
}
