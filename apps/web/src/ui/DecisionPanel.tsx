import type { Explanation } from "@chowk/controllers";
import { decodePolicy } from "@chowk/controllers";
import { layoutFor } from "@chowk/controllers/observation";
import { bestPhase } from "@chowk/controllers/pressure";
import { corridor, DT, type Scenario } from "@chowk/sim";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { attribute } from "../sim/attribution";
import {
  ACTUATED_EXTEND_THRESHOLD,
  approachDirections,
  controllerModel,
  matchesController,
  type PhaseBreakdown,
  phaseLabels,
  pressureBreakdown,
  turnShares,
} from "../sim/decisionMath";
import type { DecisionRecord } from "../sim/protocol";
import type { ControllerPair, SimHost, SimulationSide } from "../sim/SimHost";
import "./decisionPanel.css";

const DECISION_SECONDS = 5;
const STARVATION_SECONDS = 150;
const fixed3 = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});
const fixed2 = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const whole = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("en-IN", { style: "percent", maximumFractionDigits: 0 });
const signed = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
  signDisplay: "always",
});

interface Reading {
  record?: DecisionRecord;
  explanation?: Explanation;
  observation?: number[];
  now: number;
}

interface LogEntry {
  time: number;
  from: number;
  to: number;
  flipped: boolean;
  guard: boolean;
}

function clock(seconds: number) {
  const time = Math.max(0, Math.floor(seconds));
  return `${Math.floor(time / 60)
    .toString()
    .padStart(2, "0")}:${(time % 60).toString().padStart(2, "0")}`;
}

const featureOrder = [
  "Near area",
  "Mid area",
  "Far area",
  "Stopped area",
  "People",
  "Wait",
  "Emergency",
  "Exit area",
  "Green",
  "Present",
];
const observationLabels = [
  ...["Green approach", "Clockwise 1", "Clockwise 2", "Clockwise 3"].flatMap((group) =>
    featureOrder.map((feature, index) => ({
      label: `${group} · ${feature}`,
      max: index === 4 || index === 7 ? 3 : index === 5 ? 2 : 1,
    })),
  ),
  ...["Green approach", "Clockwise 1", "Clockwise 2", "Clockwise 3"].flatMap((group) => [
    { label: `${group} · Upstream releasing`, max: 1 },
    { label: `${group} · Upstream elapsed`, max: 1 },
  ]),
  { label: "Green elapsed", max: 1 },
  { label: "In clearance", max: 1 },
];

/** A schematic of the junction: each arm fills with the road area its sensors report. */
function JunctionSketch({
  directions,
  occupancy,
  green,
  next,
}: {
  directions: string[];
  occupancy: number[];
  green: number;
  next: number;
}) {
  const arms: Record<string, [number, number]> = {
    North: [0, -1],
    East: [1, 0],
    South: [0, 1],
    West: [-1, 0],
  };
  return (
    <svg className="decision-sketch" viewBox="-60 -60 120 120" aria-hidden="true">
      <rect x="-12" y="-12" width="24" height="24" rx="3" className="decision-sketch-box" />
      {directions.map((direction, approach) => {
        const [dx, dz] = arms[direction] ?? [0, 0];
        const fill = Math.min(1, occupancy[approach]);
        const horizontal = dx !== 0;
        const length = 38;
        const x = horizontal ? (dx > 0 ? 12 : -12 - length) : -9;
        const y = horizontal ? -9 : dz > 0 ? 12 : -12 - length;
        const filled = length * fill;
        const fx = horizontal ? (dx > 0 ? 12 : -12 - filled) : -9;
        const fy = horizontal ? -9 : dz > 0 ? 12 : -12 - filled;
        const state = approach === green ? "green" : approach === next ? "next" : "red";
        return (
          <g key={direction} data-state={state}>
            <rect
              x={x}
              y={y}
              width={horizontal ? length : 18}
              height={horizontal ? 18 : length}
              className="decision-sketch-road"
            />
            <rect
              x={fx}
              y={fy}
              width={horizontal ? filled : 18}
              height={horizontal ? 18 : filled}
              className="decision-sketch-queue"
            />
            <circle cx={dx * 17} cy={dz * 17} r="3.4" className="decision-sketch-lamp" />
            <text
              x={dx * 55}
              y={dz * 55 + 3.5}
              textAnchor="middle"
              className="decision-sketch-label"
            >
              {direction[0]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function PressureCard({
  phase,
  chosen,
  current,
  basis,
  pick,
}: {
  phase: PhaseBreakdown;
  chosen: boolean;
  current: boolean;
  basis: "area" | "count";
  pick: string;
}) {
  return (
    <li className="decision-phase" data-chosen={chosen}>
      <header>
        <strong>Green for {phase.label}</strong>
        <span>{[current && "current green", chosen && pick].filter(Boolean).join(" · ")}</span>
      </header>
      {phase.approaches.map((term) => (
        <div key={term.approach} className="decision-terms">
          <span>Waiting {basis === "area" ? "area" : "vehicles"}</span>
          <code>
            {basis === "area"
              ? `(${fixed2.format(term.areaNear)}×${whole.format(term.nearLength)} m + ${fixed2.format(term.areaMid)}×${whole.format(term.midLength)} m) ÷ ${whole.format(term.nearLength + term.midLength)} m`
              : `${whole.format(term.count)} vehicles`}
          </code>
          <b>{signed.format(term.queue)}</b>
          <span>Exit traffic</span>
          <code>
            {term.exits.length
              ? term.exits
                  .map(({ share, load }) => `${fixed2.format(share)}×${fixed2.format(load)}`)
                  .join(" + ")
              : "no exits sensed"}
          </code>
          <b>{signed.format(-term.exitTotal)}</b>
        </div>
      ))}
      {phase.hold > 0 && (
        <div className="decision-terms">
          <span>Hold bonus</span>
          <code>avoids switching for a tiny gain</code>
          <b>{signed.format(phase.hold)}</b>
        </div>
      )}
      <footer>
        <span>Pressure</span>
        <b>{fixed3.format(phase.pressure)}</b>
      </footer>
    </li>
  );
}

function ScoreBars({
  labels,
  prior,
  learned,
  chosen,
}: {
  labels: string[];
  prior: number[];
  learned: number[];
  chosen: number;
}) {
  const extent = Math.max(
    0.05,
    ...prior.map(Math.abs),
    ...learned.map(Math.abs),
    ...prior.map((value, index) => Math.abs(value + learned[index])),
  );
  const scale = (value: number) => (value / extent) * 50;
  return (
    <ul className="decision-scores">
      {labels.map((label, phase) => {
        const total = prior[phase] + learned[phase];
        return (
          <li key={label} data-chosen={phase === chosen}>
            <span className="decision-score-label">{label}</span>
            <span className="decision-score-track" aria-hidden="true">
              <i
                className="decision-score-prior"
                style={{
                  left: `${50 + Math.min(0, scale(prior[phase]))}%`,
                  width: `${Math.abs(scale(prior[phase]))}%`,
                }}
              />
              <i
                className="decision-score-learned"
                data-negative={learned[phase] < 0}
                style={{
                  left: `${50 + Math.min(scale(prior[phase]), scale(total))}%`,
                  width: `${Math.abs(scale(learned[phase]))}%`,
                }}
              />
              <i className="decision-score-total" style={{ left: `${50 + scale(total)}%` }} />
            </span>
            <code>
              {fixed3.format(prior[phase])} {learned[phase] < 0 ? "−" : "+"}{" "}
              {fixed3.format(Math.abs(learned[phase]))} = <b>{fixed3.format(total)}</b>
            </code>
          </li>
        );
      })}
    </ul>
  );
}

export function DecisionPanel({
  host,
  junction,
  controllers,
  labelOf,
  scenario,
  onJunction,
  onClose,
}: {
  host: RefObject<SimHost | null>;
  junction: number;
  controllers: ControllerPair;
  labelOf: (id: string) => string;
  scenario: Scenario;
  onJunction: (junction: number) => void;
  onClose: () => void;
}) {
  const [side, setSide] = useState<SimulationSide>(1);
  const [reading, setReading] = useState<Reading>({ now: 0 });
  const [log, setLog] = useState<LogEntry[]>([]);
  const lastLogged = useRef<number>(-1);

  useEffect(() => {
    setLog([]);
    lastLogged.current = -1;
    function read() {
      const snapshot = host.current?.streams[side].current;
      if (!snapshot) return;
      const record = snapshot.decisions?.[junction];
      const explanation = snapshot.explanations?.[junction];
      const observation = snapshot.observations?.[junction];
      const now = snapshot.tick * DT;
      setReading((current) =>
        current.record === record &&
        current.explanation === explanation &&
        current.observation === observation &&
        Math.floor(current.now) === Math.floor(now)
          ? current
          : { record, explanation, observation, now },
      );
    }
    read();
    const interval = window.setInterval(read, 200);
    return () => window.clearInterval(interval);
  }, [host, junction, side]);

  const controller = controllers[side];
  const model = useMemo(
    () => controllerModel(controller.id, controller.policy),
    [controller.id, controller.policy],
  );
  const directions = useMemo(() => approachDirections(corridor, junction), [junction]);
  const labels = useMemo(() => phaseLabels(corridor, junction), [junction]);
  const network = corridor.junctions[junction];
  const { record, explanation, observation, now } = reading;
  const sense = record?.sense;

  const breakdown = useMemo(
    () =>
      sense && model.basis
        ? pressureBreakdown(
            corridor,
            junction,
            sense,
            turnShares(corridor, scenario),
            model.basis,
            model.hysteresis,
          )
        : undefined,
    [sense, model, junction, scenario],
  );
  const verified = breakdown ? matchesController(breakdown, model, explanation) : undefined;
  const prior = explanation?.prior;
  const learned = explanation?.learned;
  const scores = explanation?.scores ?? [];
  const priorChoice = prior && sense ? bestPhase(prior, sense.phase) : undefined;
  const scoreChoice = scores.length && sense ? bestPhase(scores, sense.phase) : undefined;
  const guard = explanation?.reason === "Serving the approach with the longest wait";
  const requested = record?.requested ?? sense?.phase ?? 0;
  // The driver's starvation guard serves the phase of the longest wait over the limit.
  let longest = STARVATION_SECONDS;
  let starved = -1;
  sense?.approaches.forEach(({ waitMax }, approach) => {
    if (waitMax <= longest) return;
    longest = waitMax;
    starved = network.phases.findIndex(({ approaches }) =>
      approaches.includes(network.approaches[approach]),
    );
  });
  const applied = guard ? starved : requested;
  const finalPhase = applied >= 0 ? applied : requested;
  const vector = useMemo(
    () => (controller.policy ? decodePolicy(controller.policy) : undefined),
    [controller.policy],
  );
  const drivers = useMemo(() => {
    if (!vector || !observation || !sense || !learned || model.kind !== "learned") return undefined;
    const choice = scoreChoice ?? sense.phase;
    const layout = layoutFor(corridor, junction);
    const relative =
      (layout.directionOfPhase[choice] + 4 - layout.directionOfPhase[sense.phase]) % 4;
    const result = attribute(vector, observation, relative);
    const matches = result.outputs[relative] === learned[choice];
    const ranked = Array.from(result.contributions, (value, index) => ({ value, index }))
      .filter(({ value }) => value !== 0)
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 3);
    return { choice, ranked, matches, bias: result.biasPath, output: result.outputs[relative] };
  }, [vector, observation, sense, learned, model.kind, scoreChoice, junction]);
  const flipped =
    model.kind === "learned" &&
    priorChoice !== undefined &&
    scoreChoice !== undefined &&
    priorChoice !== scoreChoice;

  useEffect(() => {
    if (!record || !sense || record.time === lastLogged.current) return;
    lastLogged.current = record.time;
    setLog((entries) =>
      [{ time: record.time, from: sense.phase, to: finalPhase, flipped, guard }, ...entries].slice(
        0,
        8,
      ),
    );
  }, [record, sense, finalPhase, flipped, guard]);

  const greenApproach = sense
    ? network.approaches.indexOf(network.phases[sense.phase].approaches[0])
    : -1;
  const nextApproach = network.approaches.indexOf(network.phases[finalPhase]?.approaches[0] ?? -1);
  const sinceDecision = record ? Math.max(0, now - record.time) : 0;
  const untilNext = Math.max(0, DECISION_SECONDS - (sinceDecision % DECISION_SECONDS));

  return (
    <aside className="decision-panel" aria-labelledby="decision-heading">
      <header className="decision-header">
        <div>
          <p className="decision-eyebrow">Inside one decision</p>
          <h2 id="decision-heading">How J{junction + 1} decides</h2>
        </div>
        <button
          className="control-button decision-close"
          type="button"
          onClick={onClose}
          aria-label="Close decision panel"
        >
          ×
        </button>
      </header>
      <div className="decision-pickers">
        <fieldset className="decision-segment" aria-label="Junction">
          {corridor.junctions.map(({ id }) => (
            <button
              key={id}
              type="button"
              aria-pressed={id === junction}
              onClick={() => onJunction(id)}
            >
              J{id + 1}
            </button>
          ))}
        </fieldset>
        <fieldset className="decision-segment" aria-label="Simulation side">
          {([0, 1] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={side === value}
              onClick={() => setSide(value)}
              title={labelOf(controllers[value].id)}
            >
              {value === 0 ? "A" : "B"} · {labelOf(controllers[value].id)}
            </button>
          ))}
        </fieldset>
      </div>

      {!sense ? (
        <p className="decision-wait" role="status">
          Waiting for the next decision. Controllers decide every {DECISION_SECONDS} simulated
          seconds.
        </p>
      ) : (
        <div className="decision-body">
          <p className="decision-clock">
            <span className="decision-pulse" /> Decided at {clock(record.time)} · next in{" "}
            {whole.format(Math.ceil(untilNext))} s · every {DECISION_SECONDS} s at each junction
          </p>

          <section className="decision-step">
            <h3>
              <span>1</span> What the sensors report
            </h3>
            <div className="decision-sense">
              <JunctionSketch
                directions={directions}
                occupancy={sense.approaches.map(({ areaNear }) => areaNear)}
                green={sense.state === "green" ? greenApproach : -1}
                next={nextApproach}
              />
              <table>
                <thead>
                  <tr>
                    <th scope="col">From</th>
                    <th
                      scope="col"
                      title="Share of road area occupied in the 60 m before the stop line"
                    >
                      Near
                    </th>
                    <th scope="col">People</th>
                    <th scope="col">Wait</th>
                    <th scope="col" title="Occupied share of the roads this approach feeds">
                      Exit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sense.approaches.map((approach, index) => (
                    <tr
                      key={network.approaches[index]}
                      data-green={index === greenApproach && sense.state === "green"}
                    >
                      <th scope="row">
                        {directions[index]}
                        {approach.emergency ? " 🚑" : ""}
                      </th>
                      <td>{percent.format(approach.areaNear)}</td>
                      <td>{whole.format(approach.people)}</td>
                      <td>{whole.format(approach.waitMax)} s</td>
                      <td>{percent.format(approach.outArea)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="decision-note">
              Signal: {labels[sense.phase]} {sense.state}, {whole.format(sense.elapsed)} s. Sensors
              measure road <em>area</em>, not vehicle counts: a bus fills more road than a
              two-wheeler.
            </p>
          </section>

          {model.kind === "fixed" && (
            <section className="decision-step">
              <h3>
                <span>2</span> Follow the timetable
              </h3>
              <p>
                Fixed-time control ignores the readings above. Before the run it sets a cycle from
                the scenario's average demand with Webster's formula, C = (1.5L + 5) ÷ (1 − Σy), and
                splits green in proportion to each approach's demand. Here the clock says{" "}
                <strong>{labels[requested]}</strong>.
              </p>
            </section>
          )}

          {model.kind === "actuated" && (
            <section className="decision-step">
              <h3>
                <span>2</span> Extend or move on
              </h3>
              <p>
                Keep the green while the green approach's near zone is at least{" "}
                {percent.format(ACTUATED_EXTEND_THRESHOLD)} occupied, up to {network.maxGreen} s;
                otherwise move to the next approach with vehicles. Now:{" "}
                {percent.format(sense.approaches[greenApproach]?.areaNear ?? 0)} near the line after{" "}
                {whole.format(sense.elapsed)} s → <strong>{labels[requested]}</strong>.
              </p>
            </section>
          )}

          {breakdown && model.basis && (
            <section className="decision-step">
              <h3>
                <span>2</span> Max-pressure: which green relieves the most?
              </h3>
              <p>
                Pressure = traffic waiting on the approach − traffic already on the roads it would
                feed, weighted by the expected turning shares. Serving a full approach into empty
                roads scores highest.
              </p>
              <ul className="decision-phases">
                {breakdown.map((phase) => (
                  <PressureCard
                    key={phase.phase}
                    phase={phase}
                    basis={model.basis ?? "area"}
                    pick={model.kind === "learned" ? "max-pressure pick" : "chosen"}
                    current={phase.phase === sense.phase}
                    chosen={phase.phase === (model.kind === "learned" ? priorChoice : scoreChoice)}
                  />
                ))}
              </ul>
            </section>
          )}

          {model.kind === "learned" && prior && learned && (
            <section className="decision-step">
              <h3>
                <span>3</span> CHOWK adds a learned correction
              </h3>
              <p>
                Score = β × pressure + network output. β = {fixed3.format(model.scale)} was learned
                in training. The network (50 inputs → 64 → 64 → 4, about 7,700 weights) reads the
                same sensors plus upstream signals and nudges each option up or down.
              </p>
              <ScoreBars
                labels={labels}
                prior={prior}
                learned={learned}
                chosen={scoreChoice ?? sense.phase}
              />
              <p className="decision-legend">
                <i className="legend-prior" /> β × pressure <i className="legend-up" /> learned
                boost <i className="legend-down" /> learned penalty
              </p>
              {drivers && (
                <div className="decision-drivers">
                  <p>
                    What moved the correction for <strong>{labels[drivers.choice]}</strong> (
                    {drivers.output < 0 ? "−" : "+"}
                    {fixed3.format(Math.abs(drivers.output))}){" "}
                    {drivers.matches && (
                      <span
                        className="decision-check"
                        title="The browser's restatement of the network gives the controller's own output"
                      >
                        ✓ matches the controller
                      </span>
                    )}
                  </p>
                  <ol>
                    {drivers.ranked.map(({ value, index }) => (
                      <li key={index} data-negative={value < 0}>
                        <span>{observationLabels[index].label}</span>
                        <b>
                          {value < 0 ? "−" : "+"}
                          {fixed3.format(Math.abs(value))}
                        </b>
                      </li>
                    ))}
                  </ol>
                  <p className="decision-legend">
                    Input × gradient through the active part of the network. All 50 parts plus a
                    bias term of {drivers.bias < 0 ? "−" : "+"}
                    {fixed3.format(Math.abs(drivers.bias))} add up exactly to the output.
                  </p>
                </div>
              )}
              {observation && (
                <details className="decision-vector">
                  <summary>The 50 numbers the network read</summary>
                  <dl>
                    {observationLabels.map(({ label, max }, index) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{fixed2.format(observation[index])}</dd>
                        <meter min={0} max={max} value={Math.min(max, observation[index])} />
                      </div>
                    ))}
                  </dl>
                </details>
              )}
            </section>
          )}

          <section className="decision-step decision-outcome">
            <h3>
              <span>{model.kind === "learned" ? 4 : 3}</span> Decision
            </h3>
            <p className="decision-verdict">
              {finalPhase === sense.phase ? "Keep green on " : "Switch green to "}
              <strong>{labels[finalPhase]}</strong>
            </p>
            {guard && (
              <p className="decision-flag" data-tone="guard">
                Safety rule: an approach waited more than {STARVATION_SECONDS} s, so it is served
                next. Every adaptive controller has this rule.
              </p>
            )}
            {flipped && priorChoice !== undefined && (
              <p className="decision-flag" data-tone="learned">
                Max-pressure alone would pick {labels[priorChoice]}. The learned correction changed
                the choice.
              </p>
            )}
            {model.kind === "learned" && !flipped && !guard && (
              <p className="decision-flag">Max-pressure and CHOWK agree on this decision.</p>
            )}
            {explanation?.reason && (
              <p className="decision-reason">
                {model.kind === "learned" && explanation.reason.includes(":")
                  ? "Input that moved the network most: "
                  : "Controller's reason: "}
                “{explanation.reason}”
              </p>
            )}
            {verified !== undefined && (
              <p className="decision-check" data-ok={verified}>
                {verified
                  ? "✓ Recomputed in your browser from the sensor reading above: matches the controller's own numbers."
                  : "✗ The browser's recomputation differs from the controller's numbers."}
              </p>
            )}
            <p className="decision-note">
              Yellow and all-red clearance and minimum green are enforced by the simulated signal
              for every controller.
            </p>
          </section>

          {log.length > 1 && (
            <section className="decision-step">
              <h3>Recent decisions</h3>
              <ol className="decision-log">
                {log.map((entry) => (
                  <li key={entry.time}>
                    <code>{clock(entry.time)}</code>
                    <span>
                      {entry.from === entry.to
                        ? `keep ${labels[entry.to]}`
                        : `${labels[entry.from]} → ${labels[entry.to]}`}
                    </span>
                    {entry.flipped && <em>learned</em>}
                    {entry.guard && <em>safety</em>}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      )}
      <p className="decision-footer">Simulation result</p>
    </aside>
  );
}
