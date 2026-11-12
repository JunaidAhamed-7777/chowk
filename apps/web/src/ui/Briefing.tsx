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
      note: "a count favours the left",
    },
    {
      label: "Road area",
      a: small.area,
      b: heavy.area,
      unit: "m²",
      note: "CHOWK’s sensors read this",
    },
    {
      label: "People",
      a: small.people,
      b: heavy.people,
      unit: "",
      note: "CHOWK minimises their delay",
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
      title: "Sense",
      body: "Every 5 s, per approach: road area occupied near, mid and far from the stop line, people, the longest wait, and how full the exit roads are.",
    },
    {
      title: "Max-pressure",
      body: "Score each green by waiting traffic minus traffic already on the roads it feeds. A classical rule (Varaiya, 2013), here measured in road area.",
    },
    {
      title: "Learned correction",
      body: "A small network (50 → 64 → 64 → 4) reads the same sensors plus neighbouring signals and nudges each score up or down.",
    },
    {
      title: "Choose",
      body: "Serve the highest score. Minimum green, clearance and a 150 s no-starvation rule apply to every controller.",
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
          max-pressure = 1.00
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
              chosen: generation {best.generation}
            </text>
          </g>
        )}
        <text x="34" y="192" className="art-caption">
          generation 0
        </text>
        <text x="344" y="192" textAnchor="end" className="art-caption">
          {last}
        </text>
      </svg>
      <figcaption>
        Validation delay relative to max-pressure; lower is better.
        {best &&
          ` The published checkpoint had ${oneDecimal.format(Math.abs(1 - best.fitness) * 100)}% ${best.fitness <= 1 ? "less" : "more"} delay than max-pressure on validation traffic.`}
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
        Mean delay per person in the morning peak over {rows[0].seedCount} held-out seeds; lines are
        95% intervals. The axis does not start at zero. Simulation result.
      </figcaption>
    </figure>
  );
}

function YourTurn() {
  const items = [
    [
      "A | B",
      "The green line splits the screen: identical vehicles on both sides, different signals.",
    ],
    ["ƒ", "Every live number has an ƒ button that shows its formula with the current totals."],
    ["◎", "How it decides opens any junction and recomputes its last decision in your browser."],
    ["✓", "Results re-runs the published benchmark in your browser and checks it matches."],
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
  seconds: number;
}

function chapters(): Chapter[] {
  const small = queueStats(smallQueue);
  const heavy = queueStats(heavyQueue);
  return [
    {
      label: "The problem",
      title: "A junction full of people, run by a clock",
      body: (
        <>
          <p>
            On Indian roads, two-wheelers, auto-rickshaws, cars and buses share the carriageway
            without lanes, squeezing into any gap.
          </p>
          <p>
            A fixed-time signal gives each road its slot whether that road is jammed or empty. Green
            spent on an empty road is waiting time for everyone else.
          </p>
        </>
      ),
      art: <ClockJunction />,
      seconds: 10,
    },
    {
      label: "Why counting misleads",
      title: "Without lanes, a queue is an area, not a number",
      body: (
        <>
          <p>
            A controller that counts vehicles sees the left queue as the longer one: {small.count}{" "}
            against {heavy.count}.
          </p>
          <p>
            Measure the road they cover and the people inside, using the simulator's sizes and
            assumed occupancies, and the right matters about{" "}
            {oneDecimal.format(heavy.people / small.people)} times as much. CHOWK senses area and
            weighs delay by people.
          </p>
        </>
      ),
      art: <CountVersusArea />,
      seconds: 12,
    },
    {
      label: "How CHOWK decides",
      title: "A classical rule, plus a learned nudge",
      body: (
        <>
          <p>
            Each junction decides every five simulated seconds. CHOWK starts from max-pressure, a
            well-studied rule, and adds a correction from a small neural network.
          </p>
          <p>
            The correction starts at exactly zero, so the untrained controller is max-pressure.
            Training can only move it where that reduced delay.
          </p>
        </>
      ),
      art: <Pipeline />,
      seconds: 13,
    },
    {
      label: "How it learned",
      title: "Trained by trial in the same simulator",
      body: (
        <>
          <p>
            Evolution strategies tried many small random changes to the network’s weights, ran each
            one through simulated traffic, and moved towards the changes that cut person-delay.
          </p>
          <p>
            The checkpoint was chosen on separate validation traffic. The traffic used for the
            published results was never used for training or choosing.
          </p>
        </>
      ),
      art: <TrainingSketch />,
      seconds: 12,
    },
    {
      label: "Does it work?",
      title: "Judged on traffic it never saw",
      body: (
        <>
          <p>
            Every controller faces identical held-out traffic. This sentence is generated from the
            published benchmark, including where CHOWK does not win:
          </p>
          <p className="briefing-headline">{__CHOWK_BRIEFING__?.headline}</p>
        </>
      ),
      art: <ProofBars />,
      seconds: 15,
    },
    {
      label: "Your turn",
      title: "Everything you see is computed live",
      body: (
        <>
          <p>
            The city behind this card is the real simulator and controller, running in your browser.
            Nothing is a recording.
          </p>
          <p>Every number on screen can show you how it was calculated.</p>
        </>
      ),
      art: <YourTurn />,
      seconds: 12,
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
  const [hold, setHold] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const primary = useRef<HTMLButtonElement>(null);
  const current = content[chapter];
  const last = chapter === content.length - 1;

  function close() {
    rememberBriefingSeen();
    onClose();
  }

  function go(next: number) {
    setWaiting(false);
    setChapter(Math.max(0, Math.min(content.length - 1, next)));
  }

  function advance() {
    if (!last) go(chapter + 1);
    else if (ready) close();
    else setWaiting(true);
  }

  // A visitor who reaches the end before the simulation is ready enters as soon as it is.
  useEffect(() => {
    if (waiting && ready) close();
  });

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
    <section
      className="briefing"
      role="dialog"
      aria-modal="false"
      aria-labelledby="briefing-title"
      onPointerEnter={() => setHold(true)}
      onPointerLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHold(false);
      }}
    >
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
              <i
                key={index === chapter ? `run-${chapter}` : "idle"}
                style={{
                  animationDuration: `${current.seconds}s`,
                  animationPlayState: hold ? "paused" : "running",
                }}
                onAnimationEnd={(event) => {
                  if (index === chapter && event.animationName === "briefing-timer") advance();
                }}
              />
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
              : waiting
                ? "Opening as soon as the simulation is ready…"
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
        <p className="briefing-hint">
          {hold ? "Paused while you read · " : "Advances by itself · "}← → to move · Esc to skip
        </p>
      </div>
    </section>
  );
}
