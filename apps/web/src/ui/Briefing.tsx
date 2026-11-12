import { VEHICLE_CLASSES } from "@chowk/sim";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { trainingCurve } from "../sim/livePolicies";
import "./briefing.css";

const storageKey = "chowk-briefing";
const controllerNames: Record<string, string> = {
  webster: "Fixed-time (Webster)",
  actuated: "Actuated (gap-out)",
  "mp-count": "Max-pressure (counts)",
  "mp-area": "Max-pressure (area)",
  chowk: "CHOWK",
};
const oneDecimal = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** First visits open the briefing; automated browsers and capture runs skip it unless asked. */
export function shouldOpenBriefing(tour: boolean, capture: boolean) {
  const requested = new URLSearchParams(window.location.search).get("intro");
  if (requested === "on") return true;
  if (requested === "off" || !tour || capture || navigator.webdriver) return false;
  try {
    return window.localStorage.getItem(storageKey) !== "done";
  } catch {
    return true;
  }
}

function rememberBriefingSeen() {
  try {
    window.localStorage.setItem(storageKey, "done");
  } catch {
    // Without storage the briefing reappears next visit, which is harmless.
  }
}

const vehicle = (id: string) => {
  const found = VEHICLE_CLASSES.find((entry) => entry.id === id);
  if (!found) throw new Error(`Unknown vehicle class ${id}`);
  return found;
};

/** Two queues drawn to scale from the simulator's own vehicle sizes and assumed occupancies. */
function queueStats(members: string[]) {
  let area = 0;
  let people = 0;
  for (const id of members) {
    const { length, width, occupancy } = vehicle(id);
    area += length * width;
    people += occupancy;
  }
  return { count: members.length, area, people };
}

const smallQueue = Array.from({ length: 8 }, () => "two-wheeler");
const heavyQueue = ["bus", "car", "car"];

function ClockJunction() {
  return (
    <svg className="briefing-art" viewBox="0 0 360 260" aria-hidden="true">
      <rect x="150" y="0" width="60" height="260" className="art-road" />
      <rect x="0" y="100" width="360" height="60" className="art-road" />
      <rect x="150" y="100" width="60" height="60" className="art-box" />
      <path d="M180 0V96M180 164V260M0 130H146M214 130H360" className="art-lane" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((index) => (
        <rect
          key={index}
          className="art-car art-queue-grow"
          style={{ animationDelay: `${index * 0.55}s` }}
          x={128 - index * 15 - (index % 3 === 2 ? 8 : 0)}
          y={index % 2 ? 136 : 140}
          width={index % 3 === 2 ? 20 : 10}
          height={index % 3 === 2 ? 11 : 7}
          rx="2"
        />
      ))}
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <rect
          key={index}
          className="art-car art-queue-grow"
          style={{ animationDelay: `${0.3 + index * 0.7}s` }}
          x={236 + index * 17}
          y={index % 2 ? 112 : 116}
          width={index === 3 ? 22 : 11}
          height={index === 3 ? 11 : 7}
          rx="2"
        />
      ))}
      <circle cx="143" cy="143" r="6" className="art-lamp-red" />
      <circle cx="217" cy="117" r="6" className="art-lamp-red" />
      <circle cx="167" cy="93" r="6" className="art-lamp-green" />
      <circle cx="193" cy="167" r="6" className="art-lamp-green" />
      <g transform="translate(296 44)">
        <circle r="26" className="art-timer-track" />
        <circle r="26" className="art-timer" transform="rotate(-90)" />
        <text y="4" textAnchor="middle" className="art-timer-label">
          timer
        </text>
      </g>
      <text x="180" y="250" textAnchor="middle" className="art-caption">
        green for an empty road · red for the queue
      </text>
    </svg>
  );
}

function CountVersusArea() {
  const small = queueStats(smallQueue);
  const heavy = queueStats(heavyQueue);
  const scale = 7;
  const drawQueue = (members: string[], originX: number) => {
    let x = originX;
    let row = 0;
    return members.map((id, index) => {
      const { length, width } = vehicle(id);
      const w = length * scale;
      const h = width * scale;
      const two = id === "two-wheeler";
      const y = two ? 60 + row * 10 : 58 + (index % 2) * 4;
      const shape = (
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width={w}
          height={h}
          rx={two ? 2 : 3}
          className={id === "bus" ? "art-bus" : "art-car"}
        />
      );
      if (two) {
        row = (row + 1) % 2;
        if (row === 0) x += w + 3;
      } else x += w + 4;
      return shape;
    });
  };
  const bar = (value: number, max: number) => `${Math.max(4, (value / max) * 100)}%`;
  const rows = [
    {
      label: "Vehicles",
      a: small.count,
      b: heavy.count,
      unit: "",
      note: "by count, left looks bigger",
    },
    {
      label: "Road area",
      a: small.area,
      b: heavy.area,
      unit: "m²",
      note: "what CHOWK measures",
    },
    {
      label: "People",
      a: small.people,
      b: heavy.people,
      unit: "",
      note: "who is actually waiting",
    },
  ];
  return (
    <div className="briefing-compare" aria-hidden="true">
      <svg viewBox="0 0 360 110" className="briefing-art briefing-art-short" aria-hidden="true">
        <rect x="0" y="48" width="170" height="40" className="art-road" />
        <rect x="190" y="48" width="170" height="40" className="art-road" />
        {drawQueue(smallQueue, 14)}
        {drawQueue(heavyQueue, 202)}
        <text x="85" y="30" textAnchor="middle" className="art-caption">
          8 two-wheelers
        </text>
        <text x="275" y="30" textAnchor="middle" className="art-caption">
          1 bus + 2 cars
        </text>
      </svg>
      <dl className="briefing-bars">
        {rows.map(({ label, a, b, unit, note }) => {
          const max = Math.max(a, b);
          return (
            <div key={label}>
              <dt>
                {label}
                <small>{note}</small>
              </dt>
              <dd>
                <span style={{ width: bar(a, max) }} data-win={a > b} />
                <b>
                  {oneDecimal.format(a)} {unit}
                </b>
              </dd>
              <dd>
                <span style={{ width: bar(b, max) }} data-win={b > a} />
                <b>
                  {oneDecimal.format(b)} {unit}
                </b>
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function Pipeline() {
  const steps = [
    {
      title: "Measure",
      body: "For each road into the junction: how much road the queue covers, how many people are in it, how long they have waited, and how full the road ahead is.",
    },
    {
      title: "Score with max-pressure",
      body: "Score = size of the queue minus traffic already on the road ahead. A long queue heading into an empty road scores high. This is a standard rule.",
    },
    {
      title: "Adjust with a neural network",
      body: "A small network looks at the same measurements, plus what the neighbouring lights are doing, and adds or subtracts a little from each score.",
    },
    {
      title: "Pick",
      body: "The road with the highest score gets green. Safety rules always apply: minimum green, yellow and all-red, and no road waits more than 150 s.",
    },
  ];
  return (
    <ol className="briefing-pipeline">
      {steps.map(({ title, body }, index) => (
        <li key={title} style={{ animationDelay: `${0.25 + index * 0.55}s` }}>
          <span>{index + 1}</span>
          <div>
            <strong>{title}</strong>
            <p>{body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function TrainingSketch() {
  const curve = trainingCurve();
  const points = curve?.points.flatMap(({ generation, validationFitness }) =>
    validationFitness === undefined ? [] : [{ generation, fitness: validationFitness }],
  );
  if (!curve || !points?.length) return null;
  const last = points[points.length - 1].generation || 1;
  const low = Math.min(...points.map(({ fitness }) => fitness), 0.99);
  const high = Math.max(...points.map(({ fitness }) => fitness), 1.005);
  const x = (generation: number) => 34 + (generation / last) * 310;
  const y = (fitness: number) => 20 + ((high - fitness) / (high - low)) * 150;
  const path = points
    .map(({ generation, fitness }, index) => `${index ? "L" : "M"}${x(generation)} ${y(fitness)}`)
    .join("");
  const best = points.find(({ generation }) => generation === curve.bestGeneration);
  return (
    <figure className="briefing-figure">
      <svg className="briefing-art" viewBox="0 0 360 200" aria-hidden="true">
        <line x1="34" x2="344" y1={y(1)} y2={y(1)} className="art-baseline" />
        <text x="344" y={y(1) - 6} textAnchor="end" className="art-caption">
          same as max-pressure
        </text>
        <path d={path} className="art-curve" pathLength={1} />
        {best && (
          <g>
            <circle cx={x(best.generation)} cy={y(best.fitness)} r="5" className="art-best" />
            <text
              x={x(best.generation)}
              y={y(best.fitness) - 12}
              textAnchor="middle"
              className="art-caption art-caption-strong"
            >
              kept: round {best.generation}
            </text>
          </g>
        )}
        <text x="34" y="192" className="art-caption">
          round 0
        </text>
        <text x="344" y="192" textAnchor="end" className="art-caption">
          {last}
        </text>
      </svg>
      <figcaption>
        Delay compared with max-pressure: 1.00 means equal, lower is better.
        {best &&
          ` The version we kept had ${oneDecimal.format(Math.abs(1 - best.fitness) * 100)}% ${best.fitness <= 1 ? "less" : "more"} delay than max-pressure on the traffic used to choose it.`}
      </figcaption>
    </figure>
  );
}

function ProofBars() {
  const data = __CHOWK_BRIEFING__;
  if (!data?.delay.length) return <p>The published benchmark is not available in this build.</p>;
  const rows = [...data.delay].sort((a, b) => a.mean - b.mean);
  // Points and intervals, not bars: the axis does not start at zero.
  const low = Math.floor(Math.min(...rows.map(({ ciLow }) => ciLow)) / 10) * 10;
  const high = Math.ceil(Math.max(...rows.map(({ ciHigh }) => ciHigh)) / 10) * 10;
  const at = (value: number) => `${((value - low) / (high - low)) * 100}%`;
  return (
    <figure className="briefing-figure">
      <ul className="briefing-proof">
        {rows.map(({ controller, mean, ciLow, ciHigh }) => (
          <li key={controller} data-main={controller === "chowk"}>
            <span>{controllerNames[controller] ?? controller}</span>
            <span className="briefing-proof-track">
              <em style={{ left: at(ciLow), width: `calc(${at(ciHigh)} - ${at(ciLow)})` }} />
              <i style={{ left: at(mean) }} />
            </span>
            <b>{whole.format(mean)} s</b>
          </li>
        ))}
        <li className="briefing-proof-axis" aria-hidden="true">
          <span />
          <span>
            <small>{whole.format(low)} s</small>
            <small>{whole.format(high)} s</small>
          </span>
          <span />
        </li>
      </ul>
      <figcaption>
        Average delay per person in the morning rush, {rows[0].seedCount} traffic samples. Dot =
        average, line = 95% range. The axis does not start at zero. Simulation result.
      </figcaption>
    </figure>
  );
}

function YourTurn() {
  const items = [
    [
      "A | B",
      "A green line splits the screen. Both sides have the same cars. Only the traffic lights differ.",
    ],
    ["ƒ", "Click ƒ next to any number to see how it was calculated."],
    ["◎", "Click How it decides to see the maths behind a junction's last choice."],
    ["✓", "Open Results to re-run the test in your own browser."],
  ];
  return (
    <ul className="briefing-legend">
      {items.map(([mark, text], index) => (
        <li key={mark} style={{ animationDelay: `${0.2 + index * 0.35}s` }}>
          <span>{mark}</span>
          {text}
        </li>
      ))}
    </ul>
  );
}

interface Chapter {
  label: string;
  title: string;
  body: ReactNode;
  art: ReactNode;
}

function plainResult(baseline: string) {
  const result = __CHOWK_BRIEFING__?.comparisons.find((entry) => entry.baseline === baseline);
  if (!result) return undefined;
  const name = controllerNames[baseline] ?? baseline;
  if (!result.clear) return `vs ${name}: no clear difference`;
  const size = oneDecimal.format(Math.abs(result.relDiff) * 100);
  return `vs ${name}: ${size}% ${result.relDiff < 0 ? "less" : "more"} delay`;
}

function chapters(): Chapter[] {
  const small = queueStats(smallQueue);
  const heavy = queueStats(heavyQueue);
  const results = ["webster", "mp-count", "mp-area", "actuated"].flatMap(
    (baseline) => plainResult(baseline) ?? [],
  );
  return [
    {
      label: "The problem",
      title: "Traffic lights that ignore the traffic",
      body: (
        <>
          <p>
            A fixed-time traffic light runs on a timer. Each road gets the same green every cycle.
          </p>
          <p>
            The timer does not look at the queues. So an empty road can get green while a long queue
            waits at red.
          </p>
          <p>
            Indian traffic makes this harder. Bikes, autos, cars and buses share the road with no
            lanes.
          </p>
        </>
      ),
      art: <ClockJunction />,
    },
    {
      label: "Counting is not enough",
      title: "Why counting vehicles gets it wrong",
      body: (
        <>
          <p>
            Some smarter lights count the vehicles in each queue. By count, the left queue is
            bigger: {small.count} vehicles against {heavy.count}.
          </p>
          <p>
            But the right queue covers {whole.format(heavy.area / small.area)}× more road and holds
            about {whole.format(heavy.people / small.people)}× more people.
          </p>
          <p>So CHOWK measures road space and people, not the number of vehicles.</p>
        </>
      ),
      art: <CountVersusArea />,
    },
    {
      label: "How CHOWK works",
      title: "How CHOWK picks which light turns green",
      body: (
        <>
          <p>Every 5 seconds, at every junction, CHOWK runs the four steps on the right.</p>
          <p>Step 2 is a well-known rule called max-pressure. Step 3 is the part CHOWK learned.</p>
          <p>
            Before training, step 3 adds nothing, so CHOWK starts out the same as max-pressure.
            Training only changes it where that cuts delay.
          </p>
        </>
      ),
      art: <Pipeline />,
    },
    {
      label: "Training",
      title: "How it learned",
      body: (
        <>
          <p>
            We made many small random changes to the network and ran each version in the simulator.
            Changes that cut delay were kept. This method is called evolution strategies.
          </p>
          <p>
            The chart shows each round of training. We kept the best round, judged on separate
            traffic that was not used for training.
          </p>
        </>
      ),
      art: <TrainingSketch />,
    },
    {
      label: "Results",
      title: "Does it beat the other lights?",
      body: (
        <>
          <p>
            We tested every controller on the same traffic, which CHOWK had never seen. In the
            morning rush, compared with each one, CHOWK had:
          </p>
          <ul className="briefing-results">
            {results.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <details className="briefing-exact">
            <summary>Exact published result</summary>
            <p>{__CHOWK_BRIEFING__?.headline}</p>
          </details>
        </>
      ),
      art: <ProofBars />,
    },
    {
      label: "Using this page",
      title: "How to read the live view",
      body: (
        <>
          <p>The city behind this card is the simulation, running in your browser right now.</p>
          <p>Nothing is pre-recorded, and you can check every number.</p>
        </>
      ),
      art: <YourTurn />,
    },
  ];
}

export function Briefing({
  ready,
  onClose,
  onDecision,
}: {
  ready: boolean;
  onClose: () => void;
  onDecision: () => void;
}) {
  const [content] = useState(chapters);
  const [chapter, setChapter] = useState(0);
  const primary = useRef<HTMLButtonElement>(null);
  const current = content[chapter];
  const last = chapter === content.length - 1;

  function close() {
    rememberBriefingSeen();
    onClose();
  }

  function go(next: number) {
    setChapter(Math.max(0, Math.min(content.length - 1, next)));
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      else if (event.key === "ArrowRight") go(chapter + 1);
      else if (event.key === "ArrowLeft") go(chapter - 1);
      else return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  useEffect(() => {
    primary.current?.focus({ preventScroll: true });
  }, []);

  return (
    <section className="briefing" role="dialog" aria-modal="false" aria-labelledby="briefing-title">
      <div className="briefing-card">
        <nav className="briefing-progress" aria-label="Briefing chapters">
          {content.map((entry, index) => (
            <button
              key={entry.label}
              type="button"
              aria-label={`${index + 1}. ${entry.label}`}
              aria-current={index === chapter ? "step" : undefined}
              data-state={index < chapter ? "done" : index === chapter ? "now" : "next"}
              onClick={() => go(index)}
            >
              <i />
            </button>
          ))}
        </nav>
        <div className="briefing-content" key={chapter}>
          <div className="briefing-text">
            <p className="briefing-label">
              <span>
                {chapter + 1}/{content.length}
              </span>{" "}
              {current.label}
            </p>
            <h2 id="briefing-title">{current.title}</h2>
            <div className="briefing-body">{current.body}</div>
          </div>
          <div className="briefing-visual">{current.art}</div>
        </div>
        <footer className="briefing-footer">
          <span className="briefing-status" data-ready={ready}>
            <i />
            {ready
              ? "Simulation running behind this card"
              : "Starting the simulation in your browser…"}
          </span>
          <span className="briefing-actions">
            <button className="briefing-skip" type="button" onClick={close}>
              {last ? "Close" : "Skip intro"}
            </button>
            {chapter > 0 && (
              <button className="control-button" type="button" onClick={() => go(chapter - 1)}>
                Back
              </button>
            )}
            {last && (
              <button
                className="control-button"
                type="button"
                disabled={!ready}
                onClick={() => {
                  close();
                  onDecision();
                }}
              >
                Show how it decides
              </button>
            )}
            <button
              ref={primary}
              className="control-button briefing-next"
              type="button"
              disabled={last && !ready}
              onClick={() => (last ? close() : go(chapter + 1))}
            >
              {last ? "Enter the live corridor" : "Next"}
            </button>
          </span>
        </footer>
        <p className="briefing-hint">← → to move · Esc to skip</p>
      </div>
    </section>
  );
}
