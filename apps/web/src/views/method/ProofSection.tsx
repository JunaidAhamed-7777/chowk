import { useRef } from "react";
import { highlights, whole } from "./explainerData";
import { useCountUp, useInView } from "./motion";

function Counter({ value, label, run }: { value: number; label: string; run: boolean }) {
  const shown = useCountUp(value, run, 1700);
  return (
    <div className="proof-counter">
      <strong>{whole.format(Math.round(shown))}</strong>
      <span>{label}</span>
    </div>
  );
}

export function ProofSection() {
  const grid = useRef<HTMLDivElement>(null);
  const run = useInView(grid);
  const { scale } = highlights;
  return (
    <div className="explainer-proof">
      <div className="proof-grid" ref={grid}>
        <Counter run={run} value={scale.episodes} label="simulated episodes" />
        <Counter run={run} value={scale.simulatedHours} label="hours of simulated traffic" />
        <Counter run={run} value={scale.vehicles} label="vehicles through the measured windows" />
        <Counter run={run} value={scale.people} label="people in those vehicles" />
        <Counter
          run={run}
          value={scale.comparisons}
          label="paired comparisons with 95% intervals"
        />
        <Counter run={run} value={scale.conditions} label="distinct traffic conditions" />
        <Counter run={run} value={scale.suites} label="benchmark suites" />
        <Counter run={run} value={scale.controllers} label="controllers compared" />
      </div>

      <div className="proof-points">
        <article>
          <svg viewBox="0 0 220 96" aria-hidden="true" className="proof-twin">
            <rect x="4" y="10" width="100" height="76" rx="8" />
            <rect x="116" y="10" width="100" height="76" rx="8" />
            {[22, 40, 58, 76].map((x) => (
              <g key={x}>
                <rect x={x} y="44" width="10" height="6" rx="2" className="proof-car" />
                <rect x={x + 112} y="44" width="10" height="6" rx="2" className="proof-car" />
              </g>
            ))}
            <circle cx="92" cy="26" r="5" className="proof-red" />
            <circle cx="204" cy="26" r="5" className="proof-green" />
          </svg>
          <h3>Same traffic, both sides</h3>
          <p>
            Every comparison runs two controllers on the identical seed: the same vehicles arrive at
            the same moments. Only the signals differ, so the difference is the controller.
          </p>
        </article>
        <article>
          <div className="proof-engines" aria-hidden="true">
            {(scale.engines.length > 0 ? scale.engines : ["Node"]).map((engine) => (
              <span key={engine}>{engine}</span>
            ))}
          </div>
          <h3>Bit-for-bit reproducible</h3>
          <p>
            {scale.engines.length > 1
              ? `${scale.engines.join(", ")} all reach the identical simulation state. `
              : ""}
            The Results page re-runs published episodes in your browser and checks every metric and
            final state hash against the publication.
          </p>
        </article>
        <article>
          <div className="proof-seal" aria-hidden="true">
            <span>sha-256</span>
          </div>
          <h3>Tamper-evident</h3>
          <p>
            The published benchmark stores a fingerprint of the simulator, controllers and
            scenarios. If any of that code changes, the build refuses to ship stale results.
          </p>
        </article>
      </div>
      <div className="explainer-cta">
        <a href="/results">See every result and re-run it →</a>
      </div>
    </div>
  );
}
