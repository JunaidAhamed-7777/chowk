import { useRef, useState } from "react";
import {
  highlights,
  oneDecimal,
  percent,
  policyParameters,
  signedPercent,
  whole,
} from "./explainerData";
import { useCountUp, useInView } from "./motion";

function StatTile({
  value,
  format,
  label,
  detail,
  run,
}: {
  value: number;
  format: (value: number) => string;
  label: string;
  detail?: string;
  run: boolean;
}) {
  const shown = useCountUp(value, run);
  return (
    <div className="fix-stat">
      <strong>{format(shown)}</strong>
      <span>{label}</span>
      {detail && <small>{detail}</small>}
    </div>
  );
}

function ScenarioRace() {
  const [selected, setSelected] = useState(highlights.scenarios[0]?.id);
  const scenario =
    highlights.scenarios.find(({ id }) => id === selected) ?? highlights.scenarios[0];
  if (!scenario) return null;
  const top = Math.max(...scenario.delay.map(({ ciHigh }) => ciHigh));
  return (
    <figure className="fix-race">
      <header>
        <figcaption>
          <strong>Delay per person, every controller</strong>
          <span>
            Mean of {highlights.scale.seeds} held-out seeds with its 95% interval. Shorter is
            better.
          </span>
        </figcaption>
        <div className="fix-race-tabs" role="tablist" aria-label="Scenario">
          {highlights.scenarios.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={id === scenario.id}
              onClick={() => setSelected(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      <ol className="fix-race-bars">
        {scenario.delay.map(({ controller, label, mean, ciLow, ciHigh }) => (
          <li key={controller} data-chowk={controller === "chowk"}>
            <span>{label}</span>
            <div className="fix-race-track">
              <i style={{ width: `${(mean / top) * 100}%` }} />
              <em
                style={{
                  left: `${(ciLow / top) * 100}%`,
                  width: `${((ciHigh - ciLow) / top) * 100}%`,
                }}
              />
            </div>
            <b>{oneDecimal.format(mean)} s</b>
          </li>
        ))}
      </ol>
      <ul className="fix-race-versus">
        {scenario.versus.map(({ baseline, label, relDiff, ciLow, ciHigh, clear }) => (
          <li key={baseline} data-clear={clear && relDiff < 0}>
            <span>vs {label}</span>
            <strong>{signedPercent(relDiff)}</strong>
            <small>
              95% interval {signedPercent(ciLow)} to {signedPercent(ciHigh)}
            </small>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function FixSection() {
  const statsRef = useRef<HTMLDivElement>(null);
  const run = useInView(statsRef);
  const morning = highlights.scenarios[0];
  const versus = (baseline: string) => morning?.versus.find((row) => row.baseline === baseline);
  const webster = versus("webster");
  const area = versus("mp-area");
  const totalWins = highlights.wins.reduce((sum, { count }) => sum + count, 0);

  return (
    <div className="explainer-fix">
      <p className="explainer-lede">
        CHOWK looks at the road the way the traffic actually uses it: as occupied space full of
        people. It starts from the strongest classic rule, max-pressure on road area, and learns a
        correction that cuts the delay people feel.
      </p>

      <div className="fix-stats" ref={statsRef}>
        {webster && (
          <StatTile
            run={run}
            value={Math.abs(webster.relDiff)}
            format={percent}
            label={`less delay per person than fixed-time signals in the ${morning.label.toLowerCase()}`}
            detail={`95% interval ${signedPercent(webster.ciLow)} to ${signedPercent(webster.ciHigh)}`}
          />
        )}
        {area && (
          <StatTile
            run={run}
            value={Math.abs(area.relDiff)}
            format={percent}
            label="less than area max-pressure, the strongest baseline"
            detail={`95% interval ${signedPercent(area.ciLow)} to ${signedPercent(area.ciHigh)}`}
          />
        )}
        <StatTile
          run={run}
          value={totalWins}
          format={(value) => whole.format(Math.round(value))}
          label="clear wins over the four baselines"
          detail="metric × traffic condition, 95% intervals excluding zero"
        />
        {highlights.policyMicroseconds !== null && (
          <StatTile
            run={run}
            value={highlights.policyMicroseconds}
            format={(value) => `${oneDecimal.format(value)} µs`}
            label="to make a decision"
            detail={`${whole.format(policyParameters)} parameters, no GPU`}
          />
        )}
      </div>

      <ScenarioRace />

      <h3 className="explainer-subheading">Biggest wins</h3>
      <ul className="fix-wins">
        {highlights.biggest.slice(0, 6).map((win) => (
          <li key={`${win.baseline}-${win.metric}`}>
            <strong>{signedPercent(win.relDiff)}</strong>
            <span>{win.metricLabel.toLowerCase()}</span>
            <small>
              vs {win.baselineLabel} · {win.condition}
            </small>
          </li>
        ))}
      </ul>

      <h3 className="explainer-subheading">Why it works</h3>
      <ul className="fix-reasons">
        <li>
          <b>Sees space, not counts</b>
          Its pressure measures occupied road area, so a filtering swarm of two-wheelers and a wide
          bus each count for the road they take.
        </li>
        <li>
          <b>Scored on people</b>
          Training counts delay by occupancy, so a bus full of commuters weighs what its passengers
          weigh.
        </li>
        <li>
          <b>Built on a proven rule</b>
          It starts as area max-pressure at generation zero and learns only a correction on top.
          Checkpoints are chosen on separate validation traffic.
        </li>
        <li>
          <b>Safety stays outside the AI</b>
          Minimum green, yellow, all-red and a starvation guard are enforced by the signal driver,
          whatever the network proposes.
        </li>
        <li>
          <b>Small enough for a cabinet</b>
          {whole.format(policyParameters)} parameters using only addition, multiplication and
          maximum, with a dependency-free C version checked bit for bit in CI.
        </li>
        <li>
          <b>One network, every junction</b>
          The same weights run all five junctions and coordinate through what neighbouring signals
          are releasing.
        </li>
      </ul>

      <div className="explainer-cta">
        <a href="/">Watch it beat fixed-time live →</a>
        <a href="/results">Re-run the benchmark in your browser →</a>
      </div>
    </div>
  );
}
