import { useEffect, useId, useRef, useState } from "react";
import { TrainingCurveChart } from "../../benchmark/TrainingCurveChart";
import { trainingCurve } from "../../sim/livePolicies";
import {
  highlights,
  oneDecimal,
  policyInputs,
  policyLayers,
  policyParameters,
  whole,
} from "./explainerData";
import { prefersReducedMotion, useCountUp, useInView } from "./motion";

type Arm = "north" | "east" | "south" | "west";
const arms: readonly Arm[] = ["north", "east", "south", "west"];
const armNames: Record<Arm, string> = {
  north: "North",
  east: "East",
  south: "South",
  west: "West",
};
const opposite: Record<Arm, Arm> = { north: "south", south: "north", east: "west", west: "east" };

interface ArmState {
  queue: number;
  bus: boolean;
  jammed: boolean;
}

const startArms: Record<Arm, ArmState> = {
  north: { queue: 30, bus: false, jammed: false },
  east: { queue: 55, bus: false, jammed: false },
  south: { queue: 20, bus: true, jammed: false },
  west: { queue: 70, bus: false, jammed: true },
};

const steps = [
  {
    title: "Sense",
    body: `Every five simulated seconds each junction reads its approaches: how much road is occupied near, mid and far from the stop line, how many people are waiting and for how long, how full each exit is, and what the neighbouring junctions are releasing. That is ${policyInputs} numbers.`,
  },
  {
    title: "Weigh the pressure",
    body: "Max-pressure asks which green relieves the most: occupied road on an approach minus the road already occupied where that traffic is going. A full approach feeding a jammed exit scores low, because serving it only moves the queue.",
  },
  {
    title: "Add the learned correction",
    body: `A small neural network reads the same ${policyInputs} numbers and nudges each score up or down. Because it was trained on delay to people, it can weigh what the formula ignores: who is on board, how long an approach has waited, and traffic a neighbour is about to release towards it.`,
  },
  {
    title: "Switch safely",
    body: "The highest score is a request, not an order. The signal driver still holds the minimum green, runs yellow and all-red, and never lets an approach starve, so the network can only choose among safe options.",
  },
] as const;

function pressureOf(state: Record<Arm, ArmState>, arm: Arm) {
  const exit = state[opposite[arm]].jammed ? 80 : 15;
  return Math.max(0, state[arm].queue - exit * 0.6);
}

/** Illustrative only: a nudge towards approaches carrying a bus. The real one is learned. */
function correctionOf(state: Record<Arm, ArmState>, arm: Arm) {
  return state[arm].bus ? 22 : -4;
}

function JunctionFigure({
  state,
  step,
  chosen,
}: {
  state: Record<Arm, ArmState>;
  step: number;
  chosen: Arm;
}) {
  const centre = 150;
  const half = 26;
  const length = 118;
  const rotation: Record<Arm, number> = { north: 0, east: 90, south: 180, west: 270 };
  return (
    <svg
      className="works-junction"
      viewBox="0 0 300 300"
      role="img"
      aria-label="A four-arm junction"
    >
      <rect width="300" height="300" rx="14" className="works-ground" />
      <rect x={centre - half} y="0" width={half * 2} height="300" className="works-road" />
      <rect x="0" y={centre - half} width="300" height={half * 2} className="works-road" />
      <rect
        x={centre - half}
        y={centre - half}
        width={half * 2}
        height={half * 2}
        className="works-box"
      />
      {arms.map((arm) => {
        const { queue, bus, jammed } = state[arm];
        const fill = (queue / 100) * (length - 12);
        const lit = step >= 3 && arm === chosen;
        return (
          <g key={arm} transform={`rotate(${rotation[arm]} ${centre} ${centre})`}>
            {/* Left-hand traffic: arriving vehicles keep to their left, which is +x on the north arm. */}
            <rect
              className="works-queue"
              data-highlight={step === 0 || step === 1}
              x={centre + 3}
              y={centre - half - 6 - fill}
              width={half - 6}
              height={fill}
              rx="3"
            />
            {bus && (
              <rect
                className="works-bus"
                x={centre + 6}
                y={centre - half - 6 - Math.min(fill, 44)}
                width={half - 12}
                height={Math.min(fill, 40)}
                rx="3"
              />
            )}
            <rect
              className="works-exit"
              data-jammed={jammed}
              data-highlight={step === 1}
              x={centre - half + 3}
              y={centre - half - 6 - (jammed ? 82 : 18)}
              width={half - 6}
              height={jammed ? 82 : 18}
              rx="3"
            />
            <circle
              className="works-lamp"
              data-lit={lit}
              cx={centre + half + 9}
              cy={centre - half - 9}
              r="6"
            />
          </g>
        );
      })}
      {arms.map((arm) => {
        const position: Record<Arm, [number, number]> = {
          north: [centre - 64, 16],
          east: [284, centre - 40],
          south: [centre + 64, 290],
          west: [16, centre + 48],
        };
        const [x, y] = position[arm];
        return (
          <text
            key={arm}
            x={x}
            y={y}
            className="works-arm-label"
            textAnchor={arm === "east" ? "end" : "start"}
          >
            {armNames[arm]}
          </text>
        );
      })}
    </svg>
  );
}

/** The policy's real layer sizes, drawn with a sample of nodes per layer. */
const network = (() => {
  const layers = policyLayers.map((size, index) => {
    const shown = Math.min(size, index === policyLayers.length - 1 ? size : 8);
    const x = 30 + index * 92;
    return {
      size,
      x,
      output: index === policyLayers.length - 1,
      nodes: Array.from({ length: shown }, (_, node) => ({
        id: `n${x}-${node}`,
        y: 20 + (node * 150) / Math.max(1, shown - 1),
        order: node,
      })),
    };
  });
  const edges = layers.slice(0, -1).flatMap((layer, index) =>
    layer.nodes.flatMap((from) =>
      layers[index + 1].nodes.map((to) => ({
        id: `${from.id}:${to.id}`,
        x1: layer.x,
        x2: layers[index + 1].x,
        y1: from.y,
        y2: to.y,
        delay: index * 0.35 + ((from.order + to.order) % 5) * 0.08,
      })),
    ),
  );
  return { layers, edges };
})();

function NetworkFigure({ active }: { active: boolean }) {
  return (
    <svg className="works-network" viewBox="0 0 330 190" role="img" aria-label="The policy network">
      {network.edges.map(({ id, x1, x2, y1, y2, delay }) => (
        <line
          key={id}
          className="works-edge"
          data-active={active}
          style={{ animationDelay: `${delay.toFixed(2)}s` }}
          x1={x1}
          x2={x2}
          y1={y1}
          y2={y2}
        />
      ))}
      {network.layers.flatMap(({ x, nodes, output }) =>
        nodes.map(({ id, y }) => (
          <circle key={id} className="works-node" data-output={output} cx={x} cy={y} r="4.5" />
        )),
      )}
      {network.layers.map(({ x, size, output }) => (
        <text key={x} x={x} y="186" textAnchor="middle" className="works-network-label">
          {output ? `${size} phases` : whole.format(size)}
        </text>
      ))}
    </svg>
  );
}

export function WorksSection() {
  const [state, setState] = useState(startArms);
  const [step, setStep] = useState(0);
  const pressures = arms.map((arm) => ({ arm, pressure: pressureOf(state, arm) }));
  const scores = pressures.map(({ arm, pressure }) => ({
    arm,
    pressure,
    correction: correctionOf(state, arm),
  }));
  const best = (values: { arm: Arm; value: number }[]) =>
    values.reduce((top, entry) => (entry.value > top.value ? entry : top)).arm;
  const pressureChoice = best(pressures.map(({ arm, pressure }) => ({ arm, value: pressure })));
  const chosen =
    step >= 2
      ? best(scores.map(({ arm, pressure, correction }) => ({ arm, value: pressure + correction })))
      : pressureChoice;
  const top = Math.max(
    ...scores.map(({ pressure, correction }) => pressure + Math.max(0, correction)),
    1,
  );

  return (
    <div className="explainer-works">
      <div className="works-stepper" role="tablist" aria-label="One decision, step by step">
        {steps.map(({ title }, index) => (
          <button
            key={title}
            type="button"
            role="tab"
            aria-selected={step === index}
            onClick={() => setStep(index)}
          >
            <span>{index + 1}</span>
            {title}
          </button>
        ))}
      </div>

      <div className="works-stage">
        <div className="works-visual">
          <JunctionFigure state={state} step={step} chosen={chosen} />
          <div className="works-arms">
            {arms.map((arm) => (
              <fieldset key={arm}>
                <legend>{armNames[arm]}</legend>
                <label>
                  Queue
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={state[arm].queue}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        [arm]: { ...current[arm], queue: Number(event.target.value) },
                      }))
                    }
                  />
                </label>
                <label className="works-toggle">
                  <input
                    type="checkbox"
                    checked={state[arm].bus}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        [arm]: { ...current[arm], bus: event.target.checked },
                      }))
                    }
                  />
                  Bus waiting
                </label>
                <label className="works-toggle">
                  <input
                    type="checkbox"
                    checked={state[arm].jammed}
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        [arm]: { ...current[arm], jammed: event.target.checked },
                      }))
                    }
                  />
                  Exit jammed
                </label>
              </fieldset>
            ))}
          </div>
        </div>

        <div className="works-explain" role="tabpanel" aria-live="polite">
          <h3>
            {step + 1}. {steps[step].title}
          </h3>
          <p>{steps[step].body}</p>

          {step === 0 && (
            <ul className="works-inputs">
              {[
                "Occupied road near, mid and far",
                "Stopped road area",
                "People waiting",
                "Longest wait",
                "Emergency vehicle present",
                "Exit occupancy",
                "Which approach has green",
                "Neighbours releasing towards it",
              ].map((input) => (
                <li key={input}>{input}</li>
              ))}
            </ul>
          )}

          {(step === 1 || step === 2) && (
            <ol className="works-scores">
              {scores.map(({ arm, pressure, correction }) => {
                const winner = arm === (step === 1 ? pressureChoice : chosen);
                return (
                  <li key={arm} data-winner={winner}>
                    <span>{armNames[arm]}</span>
                    <div className="works-score-track">
                      <i style={{ width: `${(pressure / top) * 100}%` }} />
                      {step === 2 && (
                        <em
                          data-sign={correction >= 0 ? "up" : "down"}
                          style={{
                            width: `${(Math.abs(correction) / top) * 100}%`,
                            left:
                              correction >= 0
                                ? `${(pressure / top) * 100}%`
                                : `${(Math.max(0, pressure + correction) / top) * 100}%`,
                          }}
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {step === 1 && (
            <p className="works-note">
              Max-pressure serves <strong>{armNames[pressureChoice]}</strong>. Try jamming its exit.
            </p>
          )}
          {step === 2 && (
            <>
              <NetworkFigure active />
              <p className="works-note">
                With the correction, CHOWK serves <strong>{armNames[chosen]}</strong>.{" "}
                {chosen !== pressureChoice && "The learned nudge changed the decision. "}
                Bars here are an illustration; How it decides in the live demo shows the real
                numbers.
              </p>
            </>
          )}
          {step === 3 && (
            <ol className="works-sequence">
              <li data-phase="yellow">Yellow for the old green</li>
              <li data-phase="red">All-red while the box clears</li>
              <li data-phase="green">Green for {armNames[chosen]}</li>
              <li data-phase="hold">Held for at least the minimum green</li>
            </ol>
          )}

          <div className="works-nav">
            <button type="button" disabled={step === 0} onClick={() => setStep(step - 1)}>
              ← Back
            </button>
            <button
              type="button"
              disabled={step === steps.length - 1}
              onClick={() => setStep(step + 1)}
            >
              Next step →
            </button>
          </div>
        </div>
      </div>
      <p className="works-footnote">
        This happens at every junction, every five simulated seconds, with the same{" "}
        {whole.format(policyParameters)} weights.
      </p>
    </div>
  );
}

interface Sample {
  id: string;
  x: number;
  y: number;
  score: number;
}

// Seeds are identifiers, written the way the code and the repository write them.
const seedFormat = new Intl.NumberFormat("en-GB");
const target = { x: 248, y: 78 };
const fitness = (x: number, y: number) => Math.hypot(x - target.x, y - target.y);

/** A toy picture of evolution strategies: try paired nudges, keep the direction that helped. */
function EvolutionFigure() {
  const figure = useRef<HTMLDivElement>(null);
  const visible = useInView(figure);
  const [centre, setCentre] = useState({ x: 64, y: 210 });
  const [trail, setTrail] = useState<{ x: number; y: number }[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [generation, setGeneration] = useState(0);
  const id = useId();

  useEffect(() => {
    if (!visible) return;
    const reduced = prefersReducedMotion();
    let timer = 0;
    let current = { x: 64, y: 210 };
    let count = 0;
    const path: { x: number; y: number }[] = [];
    const advance = () => {
      const nudges: Sample[] = [];
      let stepX = 0;
      let stepY = 0;
      for (let pair = 0; pair < 6; pair++) {
        const angle = (pair / 6) * Math.PI * 2 + count * 0.7;
        const dx = Math.cos(angle) * 26;
        const dy = Math.sin(angle) * 26;
        for (const sign of [1, -1]) {
          const x = current.x + sign * dx;
          const y = current.y + sign * dy;
          nudges.push({ id: `${count}-${pair}-${sign}`, x, y, score: fitness(x, y) });
        }
        // Paired samples share the same traffic, so their difference is the signal.
        const gain =
          fitness(current.x - dx, current.y - dy) - fitness(current.x + dx, current.y + dy);
        stepX += gain * dx;
        stepY += gain * dy;
      }
      const length = Math.hypot(stepX, stepY) || 1;
      const move = Math.min(24, fitness(current.x, current.y) * 0.35);
      path.push(current);
      current = { x: current.x + (stepX / length) * move, y: current.y + (stepY / length) * move };
      count++;
      setSamples(nudges);
      setTrail([...path]);
      setCentre(current);
      setGeneration(count);
      if (count < 12 && !reduced) timer = window.setTimeout(advance, 900);
    };
    timer = window.setTimeout(advance, reduced ? 0 : 400);
    return () => window.clearTimeout(timer);
  }, [visible]);

  const worst = Math.max(...samples.map(({ score }) => score), 1);
  const bestScore = Math.min(...samples.map(({ score }) => score), worst);
  return (
    <div className="works-evolution" ref={figure}>
      <svg viewBox="0 0 320 260" role="img" aria-labelledby={id}>
        <title id={id}>
          Each generation tries pairs of small changes to the weights and moves towards the ones
          that cut delay
        </title>
        <defs>
          <radialGradient id={`${id}-valley`} cx={target.x / 320} cy={target.y / 260} r="0.9">
            <stop offset="0" stopColor="#1f6b57" />
            <stop offset="0.45" stopColor="#14283a" />
            <stop offset="1" stopColor="#0a0f1a" />
          </radialGradient>
        </defs>
        <rect width="320" height="260" rx="12" fill={`url(#${id}-valley)`} />
        {[30, 60, 95, 135, 180].map((radius) => (
          <circle
            key={radius}
            cx={target.x}
            cy={target.y}
            r={radius}
            className="evolution-contour"
          />
        ))}
        <text x={target.x} y={target.y + 4} textAnchor="middle" className="evolution-goal">
          less delay
        </text>
        {trail.length > 0 && (
          <polyline
            className="evolution-trail"
            points={[...trail, centre].map(({ x, y }) => `${x},${y}`).join(" ")}
          />
        )}
        {samples.map(({ id: sample, x, y, score }) => (
          <circle
            key={sample}
            cx={x}
            cy={y}
            r="4"
            className="evolution-sample"
            style={{
              opacity: 0.35 + 0.65 * (1 - (score - bestScore) / Math.max(1, worst - bestScore)),
            }}
          />
        ))}
        <circle cx={centre.x} cy={centre.y} r="7" className="evolution-centre" />
      </svg>
      <p>
        Generation <strong>{generation}</strong>: try twelve nudges in ± pairs on the same traffic,
        step towards the side that cut delay. CHOWK did this for all{" "}
        {whole.format(policyParameters)} weights at once.
      </p>
    </div>
  );
}

const hoursPerYear = 24 * 365;

/** "almost 3 years" just under a whole number, otherwise "about 2.4 years". */
function yearsPhrase(years: number): string {
  const next = Math.ceil(years);
  return next - years < 0.15 ? `almost ${next} years` : `about ${oneDecimal.format(years)} years`;
}

function ScaleNumber({
  value,
  run,
  format,
}: {
  value: number;
  run: boolean;
  format: (value: number) => string;
}) {
  return <strong>{format(useCountUp(value, run, 1800))}</strong>;
}

/** How much simulated traffic the training run used, from the exported run totals. */
function TrainingScale() {
  const banner = useRef<HTMLElement>(null);
  const run = useInView(banner);
  const curve = trainingCurve();
  const totals = curve?.totals;
  if (!curve || !totals) return null;
  const years = totals.simulatedHours / hoursPerYear;
  const episodeMinutes = Math.round(totals.episodeSeconds / 60);
  return (
    <section className="training-scale" ref={banner} aria-label="How much traffic CHOWK trained on">
      <p className="training-scale-kicker">The training run, in numbers</p>
      <div className="training-scale-grid">
        <div className="training-scale-lead">
          <ScaleNumber
            run={run}
            value={totals.simulatedHours}
            format={(value) => whole.format(Math.round(value))}
          />
          <span>hours of simulated traffic</span>
          <em>
            {yearsPhrase(years)} of rush-hour traffic, surges, blocked lanes, monsoons and
            ambulances, laid end to end
          </em>
        </div>
        <div>
          <ScaleNumber
            run={run}
            value={totals.trainingEpisodes}
            format={(value) => whole.format(Math.round(value))}
          />
          <span>training episodes</span>
          <em>each a {episodeMinutes}-minute simulation of the corridor</em>
        </div>
        <div>
          <ScaleNumber
            run={run}
            value={totals.wallSeconds / 60}
            format={(value) => `${whole.format(Math.round(value))} min`}
          />
          <span>of computing</span>
          <em>the simulator runs far faster than real time, with episodes in parallel</em>
        </div>
      </div>
      <p className="training-scale-note">
        Across {totals.generations} generations, plus {whole.format(totals.validationEpisodes)}{" "}
        validation episodes. The CHOWK that ships is the checkpoint from generation{" "}
        {curve.bestGeneration}, the one that did best on validation traffic.
      </p>
    </section>
  );
}

export function LearnedSection() {
  return (
    <div className="explainer-learned">
      <div className="learned-grid">
        <EvolutionFigure />
        <div className="learned-copy">
          <p>
            CHOWK was trained with evolution strategies. Each generation perturbs the network’s
            weights in mirrored pairs, runs every variant on identical simulated traffic, and moves
            the weights towards the variants that left people with less delay. Training traffic
            varies load, vehicle mix, direction, weather, sensing faults and scripted events.
          </p>
          <ol className="learned-seeds">
            <li>
              <b>Training traffic</b>
              Varied demand the network learns from.
            </li>
            <li>
              <b>Validation seeds 500,000–500,019</b>
              Pick which checkpoint to keep. Never used to report results.
            </li>
            <li>
              <b>
                Test seeds {seedFormat.format(highlights.scale.firstSeed)}–
                {seedFormat.format(highlights.scale.firstSeed + highlights.scale.seeds - 1)}
              </b>
              Touched only by the benchmark and the browser replay.
            </li>
          </ol>
        </div>
      </div>
      <TrainingCurveChart />
      <TrainingScale />
    </div>
  );
}
