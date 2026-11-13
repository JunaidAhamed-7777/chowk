import { VEHICLE_CLASSES } from "@chowk/sim";
import { type ReactNode, useEffect, useState } from "react";
import "./controllers.css";

const seconds = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

function testedDelay(controller: string) {
  const row = __CHOWK_BRIEFING__?.delay.find((entry) => entry.controller === controller);
  return row ? `${seconds.format(row.mean)} s` : undefined;
}

function area(ids: string[]) {
  return ids.reduce((sum, id) => {
    const found = VEHICLE_CLASSES.find((entry) => entry.id === id);
    return sum + (found ? found.length * found.width : 0);
  }, 0);
}

const westArea = seconds.format(area(["bus", "car", "car"]));
const northArea = seconds.format(area(Array(6).fill("two-wheeler")));

function versusAreaPressure() {
  const result = __CHOWK_BRIEFING__?.comparisons.find(({ baseline }) => baseline === "mp-area");
  if (!result) return "It was trained in simulation only.";
  if (!result.clear)
    return "In the published test it was not clearly better than area max-pressure, and it was trained in simulation only.";
  const size = `${(Math.abs(result.relDiff) * 100).toFixed(1)}%`;
  return `In the published test it had ${size} ${result.relDiff < 0 ? "less" : "more"} delay than area max-pressure. It was trained in simulation only.`;
}

const phaseColours = ["#3df2b4", "#7db7ff", "#ffc27a", "#e59ad1"];

/** Two identical cycles: the timer never looks at the road. */
function WebsterDiagram() {
  const greens = [34, 20, 28, 14];
  const clearance = 4;
  const cycle = greens.reduce((sum, green) => sum + green + clearance, 0);
  const scale = 300 / (cycle * 2);
  let x = 30;
  const blocks: ReactNode[] = [];
  for (let repeat = 0; repeat < 2; repeat++) {
    greens.forEach((green, phase) => {
      blocks.push(
        <rect
          key={`green-${x}`}
          x={x}
          y={52}
          width={green * scale}
          height={26}
          rx={3}
          fill={phaseColours[phase]}
          opacity={0.85}
        />,
      );
      x += green * scale;
      blocks.push(
        <rect
          key={`clear-${x}`}
          x={x}
          y={52}
          width={clearance * scale}
          height={26}
          fill="#ffb020"
          opacity={0.6}
        />,
      );
      x += clearance * scale;
    });
  }
  return (
    <svg viewBox="0 0 360 120" role="img" aria-labelledby="webster-diagram">
      <title id="webster-diagram">
        Two identical signal cycles. Each road gets a fixed share of green, in the same order every
        time.
      </title>
      {blocks}
      <path d={`M30 90H${30 + cycle * scale}`} className="diagram-axis" />
      <text x={30 + (cycle * scale) / 2} y={106} textAnchor="middle" className="diagram-label">
        cycle 1
      </text>
      <text x={30 + cycle * scale * 1.5} y={106} textAnchor="middle" className="diagram-label">
        cycle 2 (identical)
      </text>
      {["North", "East", "South", "West", "Yellow + all-red"].map((name, phase) => (
        <g key={name} transform={`translate(${30 + phase * 58} 20)`}>
          <rect
            width="10"
            height="10"
            rx="2"
            fill={phaseColours[phase] ?? "#ffb020"}
            opacity={phase === 4 ? 0.6 : 1}
          />
          <text x="15" y="9" className="diagram-label">
            {name}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Green keeps going while vehicles keep arriving, then moves on after a gap. */
function ActuatedDiagram() {
  const arrivals = [44, 60, 74, 90, 102, 118, 150];
  return (
    <svg viewBox="0 0 360 130" role="img" aria-labelledby="actuated-diagram">
      <title id="actuated-diagram">
        The green is extended each time a vehicle arrives, until there is a gap or the maximum green
        is reached.
      </title>
      <rect x="30" y="58" width="60" height="24" rx="3" fill="#3df2b4" opacity="0.85" />
      <rect x="90" y="58" width="58" height="24" rx="3" fill="#3df2b4" opacity="0.5" />
      <rect x="148" y="58" width="12" height="24" fill="#ffb020" opacity="0.6" />
      <rect x="160" y="58" width="170" height="24" rx="3" fill="#7db7ff" opacity="0.85" />
      {arrivals.map((x) => (
        <g key={x}>
          <path d={`M${x} 30V52`} className="diagram-arrow" />
          <circle cx={x} cy={26} r={4} className={x > 148 ? "diagram-dot-muted" : "diagram-dot"} />
        </g>
      ))}
      <text x="30" y="98" className="diagram-label">
        minimum green
      </text>
      <text x="96" y="114" className="diagram-label">
        extended
      </text>
      <text x="196" y="118" textAnchor="middle" className="diagram-label">
        gap, so switch
      </text>
      <path d="M150 104L158 88" className="diagram-axis" />
      <text x="30" y="14" className="diagram-label">
        vehicles arriving on the green road
      </text>
    </svg>
  );
}

function Queue({
  x,
  y,
  vehicles,
  direction,
}: {
  x: number;
  y: number;
  vehicles: { length: number; width: number }[];
  direction: 1 | -1;
}) {
  let offset = 0;
  return (
    <g>
      {vehicles.map(({ length, width }, index) => {
        const left = direction === 1 ? x + offset : x - offset - length;
        offset += length + 3;
        return (
          <rect
            key={`vehicle-${left}`}
            x={left}
            y={y + (index % 2 ? 2 : -2) - width / 2}
            width={length}
            height={width}
            rx={2}
            className={length > 30 ? "diagram-bus" : "diagram-car"}
          />
        );
      })}
    </g>
  );
}

const bike = { length: 9, width: 5 };
const car = { length: 18, width: 10 };
const bus = { length: 44, width: 13 };

/** Pressure = traffic waiting minus traffic already on the road ahead. */
function PressureDiagram({ basis }: { basis: "count" | "area" }) {
  const north = Array(6).fill(bike);
  const east = [bus, car, car];
  return (
    <svg viewBox="0 0 360 170" role="img" aria-labelledby={`pressure-${basis}`}>
      <title id={`pressure-${basis}`}>
        {basis === "count"
          ? "Two queues scored by vehicle count: six two-wheelers beat a bus and two cars."
          : "The same comparison by road area: a bus and two cars cover more road than six two-wheelers."}
      </title>
      <rect x="0" y="70" width="360" height="30" className="diagram-road" />
      <rect x="165" y="0" width="30" height="170" className="diagram-road" />
      <rect x="165" y="70" width="30" height="30" className="diagram-box" />
      <Queue x={160} y={85} vehicles={east} direction={-1} />
      <g transform="rotate(90 180 64)">
        <Queue x={174} y={56} vehicles={north} direction={-1} />
      </g>
      <text x="12" y="62" className="diagram-label">
        {basis === "count" ? "West road: 3 vehicles" : `West road: ${westArea} m² of road`}
      </text>
      <text x="204" y="20" className="diagram-label">
        {basis === "count" ? "North road: 6 vehicles" : `North road: ${northArea} m² of road`}
      </text>
      <text x="204" y="126" className="diagram-label">
        Roads ahead: both clear
      </text>
      <text x="204" y="150" className="diagram-label diagram-strong">
        {basis === "count"
          ? "Green goes North (6 > 3)"
          : `Green goes West (${westArea} > ${northArea})`}
      </text>
    </svg>
  );
}

/** Final score = pressure + a learned adjustment. */
function ResidualDiagram({ pure }: { pure?: boolean }) {
  const options = [
    { name: "North", pressure: 0.42, learned: -0.12 },
    { name: "East", pressure: 0.3, learned: 0.18 },
    { name: "South", pressure: 0.12, learned: 0.02 },
  ];
  const scale = 300;
  return (
    <svg viewBox="0 0 360 150" role="img" aria-labelledby={pure ? "pure-diagram" : "chowk-diagram"}>
      <title id={pure ? "pure-diagram" : "chowk-diagram"}>
        {pure
          ? "Without the pressure score, the network's output alone decides."
          : "Each option's pressure score plus the network's adjustment gives the final score; East wins after the adjustment."}
      </title>
      {options.map(({ name, pressure, learned }, index) => {
        const y = 14 + index * 38;
        const base = pure ? 0 : pressure;
        const total = base + learned + (pure ? 0.3 : 0);
        const adjust = pure ? learned + 0.3 : learned;
        return (
          <g key={name}>
            <text x="0" y={y + 13} className="diagram-label">
              {name}
            </text>
            {!pure && (
              <rect x="50" y={y} width={pressure * scale} height="18" rx="2" fill="#8a99ad" />
            )}
            <rect
              x={50 + Math.min(base, base + adjust) * scale}
              y={y + 4}
              width={Math.abs(adjust) * scale}
              height="10"
              rx="2"
              fill={adjust < 0 ? "#ff7a85" : "#3df2b4"}
            />
            <path
              d={`M${50 + total * scale} ${y - 3}V${y + 21}`}
              stroke={index === 1 ? "#ffffff" : "#ffffff80"}
              strokeWidth="2"
            />
            {index === 1 && (
              <text x={58 + total * scale} y={y + 13} className="diagram-label diagram-strong">
                highest: green
              </text>
            )}
          </g>
        );
      })}
      <g transform="translate(50 132)">
        {!pure && <rect width="10" height="8" rx="2" fill="#8a99ad" />}
        {!pure && (
          <text x="14" y="8" className="diagram-label">
            pressure score
          </text>
        )}
        <rect x={pure ? 0 : 106} width="10" height="8" rx="2" fill="#3df2b4" />
        <rect x={pure ? 12 : 118} width="10" height="8" rx="2" fill="#ff7a85" />
        <text x={pure ? 26 : 132} y="8" className="diagram-label">
          {pure ? "network output" : "learned adjustment"}
        </text>
        <path d={`M${pure ? 128 : 248} -1V10`} stroke="#ffffff" strokeWidth="2" />
        <text x={pure ? 134 : 254} y="8" className="diagram-label">
          final score
        </text>
      </g>
    </svg>
  );
}

interface Method {
  id: string;
  name: string;
  short: string;
  looksAt: string;
  decides: string;
  good: string;
  weak: string;
  diagram: ReactNode;
  result?: string;
}

const methods: Method[] = [
  {
    id: "webster",
    name: "Fixed-time (Webster)",
    short: "A timer worked out in advance.",
    looksAt: "Nothing while it runs. Before the run it is told the average traffic on each road.",
    decides:
      "It uses Webster's 1958 formula to set one cycle length and give each road a share of green in proportion to its traffic. The same cycle then repeats. Neighbouring junctions are offset so a platoon can catch several greens in a row.",
    good: "Simple, predictable, and needs no sensors.",
    weak: "It cannot react. A surge, a blocked lane or an ambulance changes nothing.",
    diagram: <WebsterDiagram />,
    result: testedDelay("webster"),
  },
  {
    id: "actuated",
    name: "Actuated (gap-out)",
    short: "Keep the green while traffic keeps coming.",
    looksAt: "Whether vehicles are still near the stop line on the road that has green.",
    decides:
      "Each road gets a minimum green. The green is extended while traffic keeps arriving, up to a maximum. When the road goes quiet, the light moves on to the next road that has someone waiting.",
    good: "Does not waste green on an empty road, and needs only simple detectors.",
    weak: "It only looks at the road that is green, not at how long the others are.",
    diagram: <ActuatedDiagram />,
    result: testedDelay("actuated"),
  },
  {
    id: "mp-count",
    name: "Max-pressure (counts)",
    short: "Serve the road where green helps most, by counting vehicles.",
    looksAt:
      "The number of vehicles queued on each road, and the number on the roads they would drive into.",
    decides:
      "Pressure = vehicles waiting minus vehicles already on the road ahead. Every 5 seconds the light picks the road with the highest pressure. It keeps the current green unless another road beats it by a small margin, so it does not flicker.",
    good: "Well studied (Varaiya, 2013) and avoids sending traffic into a full road.",
    weak: "In lane-free traffic a count is misleading: a two-wheeler counts the same as a bus.",
    diagram: <PressureDiagram basis="count" />,
    result: testedDelay("mp-count"),
  },
  {
    id: "mp-area",
    name: "Max-pressure (area)",
    short: "The same rule, measured in road space instead of vehicles.",
    looksAt: "How much of each road is covered by vehicles, in square metres, not how many.",
    decides:
      "Exactly like the count version, but every quantity is road area. A bus counts for the road it fills.",
    good: "The fairest classical rule for mixed, lane-free traffic. CHOWK is built on it.",
    weak: "It treats a bus full of people the same as an empty van of the same size.",
    diagram: <PressureDiagram basis="area" />,
    result: testedDelay("mp-area"),
  },
  {
    id: "chowk",
    name: "CHOWK",
    short: "Area max-pressure plus a small learned adjustment.",
    looksAt:
      "The same road areas, plus people on board, the longest wait, how full the roads ahead are, and whether neighbouring lights are releasing traffic towards it.",
    decides:
      "It first scores every road with area max-pressure. A small neural network then adds or subtracts a little from each score. The road with the highest final score gets green. Before training the network adds exactly zero, so CHOWK starts as area max-pressure.",
    good: "Can learn patterns the rule misses, such as people on a bus or a platoon on its way, while keeping the rule as a floor.",
    weak: versusAreaPressure(),
    diagram: <ResidualDiagram />,
    result: testedDelay("chowk"),
  },
  {
    id: "chowk-pure",
    name: "CHOWK-pure",
    short: "The network on its own, with no max-pressure starting point.",
    looksAt: "The same inputs as CHOWK.",
    decides:
      "The network's output alone picks the green. It is trained the same way. It exists to test whether starting from max-pressure matters.",
    good: "Shows how much the classical starting point contributes.",
    weak: "It has to learn everything from scratch, including what max-pressure already knows.",
    diagram: <ResidualDiagram pure />,
  },
];

const sections = [
  ...methods.map(({ id, name }) => ({ id, name })),
  { id: "rules", name: "Shared rules" },
];

/** The section nearest the top of the viewport, so the index can show where the reader is. */
function useCurrentSection() {
  const [current, setCurrent] = useState(sections[0].id);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let found = sections[0].id;
      for (const { id } of sections) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top <= window.innerHeight * 0.35) found = id;
      }
      const bottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      setCurrent(bottom ? sections[sections.length - 1].id : found);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);
  return current;
}

export function ControllersView() {
  const current = useCurrentSection();
  return (
    <div className="controllers-layout">
      <nav className="controllers-index" aria-label="Controllers on this page">
        <p className="controllers-index-title">On this page</p>
        <ol>
          {sections.map(({ id, name }) => (
            <li key={id}>
              <a href={`#${id}`} aria-current={current === id ? "location" : undefined}>
                {name}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="controllers-content">
        <p className="information-intro">
          Six ways to run the same traffic lights. Each one is a rule for one question, asked every
          5 seconds at every junction: which road gets green next? On the Live page you can put any
          two side by side.
        </p>
        {methods.map((method) => (
          <section key={method.id} id={method.id} className="controller-section">
            <div className="controller-text">
              <h2>{method.name}</h2>
              <p className="controller-short">{method.short}</p>
              <dl>
                <div>
                  <dt>What it looks at</dt>
                  <dd>{method.looksAt}</dd>
                </div>
                <div>
                  <dt>How it decides</dt>
                  <dd>{method.decides}</dd>
                </div>
                <div>
                  <dt>Good at</dt>
                  <dd>{method.good}</dd>
                </div>
                <div>
                  <dt>Weak spot</dt>
                  <dd>{method.weak}</dd>
                </div>
              </dl>
              {method.result && (
                <p className="controller-result">
                  Average delay per person in testing (morning peak):{" "}
                  <strong>{method.result}</strong>. Simulation result.
                </p>
              )}
            </div>
            <figure className="controller-diagram">{method.diagram}</figure>
          </section>
        ))}
        <section id="rules" className="controller-section controller-rules">
          <div className="controller-text">
            <h2>Rules every controller follows</h2>
            <dl>
              <div>
                <dt>Safe changes</dt>
                <dd>
                  Every change of green goes through yellow and all-red, and each green lasts at
                  least a minimum time. The simulated signal enforces this for all six.
                </dd>
              </div>
              <div>
                <dt>Nobody waits forever</dt>
                <dd>
                  If any road has waited more than 150 seconds, it is served next. This applies to
                  every controller that reacts to traffic.
                </dd>
              </div>
              <div>
                <dt>Same traffic</dt>
                <dd>
                  In every comparison, both controllers face exactly the same vehicles arriving at
                  exactly the same moments.
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
    </div>
  );
}
