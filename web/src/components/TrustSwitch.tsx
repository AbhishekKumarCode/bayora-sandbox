import { useState } from "react";

type Props = {
  realCatchRate: number; // computed from real audit data
  illustrativeLeakyRate: number; // clearly labeled as illustrative — see docs/PRD.md
};

export default function TrustSwitch({ realCatchRate, illustrativeLeakyRate }: Props) {
  const [sealed, setSealed] = useState(true);
  const shown = sealed ? realCatchRate : illustrativeLeakyRate;
  const gap = illustrativeLeakyRate - realCatchRate;

  return (
    <div
      className={`bg-card border rounded-card card-shadow card-hover p-5 transition-colors ${
        sealed ? "border-caught/40" : "border-leak/40"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-semibold text-sm">Trust Switch</h3>
        <button
          onClick={() => setSealed((s) => !s)}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            sealed ? "bg-caught" : "bg-leak"
          }`}
          aria-label="Toggle sealed/leaky"
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              sealed ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <div className={`font-display font-bold text-4xl ${sealed ? "text-caught" : "text-leak"}`}>
        {shown}%
      </div>
      <div className="text-xs text-muted-foreground mt-1 mb-3">
        {sealed ? "Sealed — this is the real number" : "Leaky (illustrative) — looks safe, isn't"}
      </div>

      <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
        <div
          key={`${sealed}-${shown}`}
          className={`h-full rounded-full grow ${sealed ? "bg-caught" : "bg-leak"}`}
          style={{ width: `${shown}%` }}
        />
      </div>

      <div className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
        <span className="font-mono font-medium text-leak">{gap} pts</span> — how much a leaky test
        can lie to you
      </div>
    </div>
  );
}
