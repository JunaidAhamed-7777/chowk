import { useId, useState } from "react";
import { oneDecimal, type SandboxClass, vehicle, vehicleNames, whole } from "./explainerData";

type Queue = Record<SandboxClass, number>;
type Side = "west" | "south";
type Lens = "count" | "chowk";

const classes: readonly SandboxClass[] = ["two-wheeler", "auto-rickshaw", "car", "bus"];
const limits: Record<SandboxClass, number> = {
  "two-wheeler": 18,
  "auto-rickshaw": 6,
  car: 6,
  bus: 2,
};
const colours: Record<SandboxClass, string> = {
  "two-wheeler": "#7dd3fc",
  "auto-rickshaw": "#facc15",
  car: "#c4b5fd",
  bus: "#fb923c",
};
const empty: Queue = { "two-wheeler": 0, "auto-rickshaw": 0, car: 0, bus: 0 };

const presets: { label: string; west: Queue; south: Queue }[] = [
  {
    label: "One bus vs a swarm",
    west: { ...empty, bus: 1, car: 1 },
    south: { ...empty, "two-wheeler": 9, "auto-rickshaw": 1 },
  },
  {
    label: "Same count, different size",
    west: { ...empty, car: 2, bus: 1, "auto-rickshaw": 1 },
    south: { ...empty, "two-wheeler": 4 },
  },
  {
    label: "Filtering two-wheelers",
    west: { ...empty, car: 3, "auto-rickshaw": 2 },
    south: { ...empty, "two-wheeler": 14 },
  },
];

// The road is drawn top-down: one metre is this many SVG units.
const scale = 12;
const roadWidth = 7.5;
const box = { x: 446, y: 140, size: roadWidth * scale };

function totals(queue: Queue) {
  let vehicles = 0;
  let area = 0;
  let people = 0;
  for (const id of classes) {
    const count = queue[id];
    const { length, width, occupancy } = vehicle[id];
    vehicles += count;
    area += count * length * width;
    people += count * occupancy;
  }
  return { vehicles, area, people };
}

interface Placed {
  key: string;
  id: SandboxClass;
  depth: number;
  lateral: number;
  length: number;
  width: number;
}

/** Packs a lane-free queue: vehicles sit side by side wherever their width fits. */
function pack(queue: Queue): Placed[] {
  const order: SandboxClass[] = [];
  const remaining = { ...queue };
  // Interleave classes so the queue looks mixed, larger vehicles first in each round.
  while (classes.some((id) => remaining[id] > 0)) {
    for (const id of ["bus", "car", "auto-rickshaw", "two-wheeler", "two-wheeler"] as const) {
      if (remaining[id] > 0) {
        order.push(id);
        remaining[id]--;
      }
    }
  }
  const placed: Placed[] = [];
  let depth = 0.8;
  let rowDepth = 0;
  let used = 0.3;
  order.forEach((id, index) => {
    const { length, width } = vehicle[id];
    if (used + width + 0.3 > roadWidth) {
      depth += rowDepth + 0.9;
      rowDepth = 0;
      used = 0.3;
    }
    placed.push({ key: `${id}-${index}`, id, depth, lateral: used, length, width });
    used += width + 0.35;
    rowDepth = Math.max(rowDepth, length);
  });
  return placed;
}

function Lights({ x, y, green }: { x: number; y: number; green: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} className="sandbox-light" data-green={green}>
      <rect x={-7} y={-16} width={14} height={32} rx={5} />
      <circle cy={-7} r={4.2} className="sandbox-lamp-red" />
      <circle cy={7} r={4.2} className="sandbox-lamp-green" />
    </g>
  );
}

function Counter({
  label,
  value,
  onChange,
  max,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  max: number;
}) {
  return (
    <div className="sandbox-counter">
      <span>{label}</span>
      <button
        type="button"
        aria-label={`One fewer ${label.toLowerCase()}`}
        disabled={value === 0}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <output>{value}</output>
      <button
        type="button"
        aria-label={`One more ${label.toLowerCase()}`}
        disabled={value === max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}

function Meter({
  label,
  hint,
  west,
  south,
  format,
  lens,
}: {
  label: string;
  hint: string;
  west: number;
  south: number;
  format: (value: number) => string;
  lens: "count" | "area" | "people";
}) {
  const top = Math.max(west, south, 0.001);
  const winner = west === south ? "tie" : west > south ? "west" : "south";
  return (
    <div className="sandbox-meter" data-lens={lens}>
      <header>
        <strong>{label}</strong>
        <span>{hint}</span>
      </header>
      {(["west", "south"] as const).map((side) => {
        const value = side === "west" ? west : south;
        return (
          <div key={side} className="sandbox-bar" data-winner={winner === side}>
            <span>{side === "west" ? "Approach A" : "Approach B"}</span>
            <i style={{ width: `${(value / top) * 100}%` }} />
            <b>{format(value)}</b>
          </div>
        );
      })}
    </div>
  );
}

export function ProblemSection() {
  const titleId = useId();
  const [queues, setQueues] = useState<Record<Side, Queue>>({
    west: presets[0].west,
    south: presets[0].south,
  });
  const [lens, setLens] = useState<Lens>("chowk");
  const west = totals(queues.west);
  const south = totals(queues.south);
  // Road area is what CHOWK's pressure measures; people are what its training counts.
  const areaPick: Side = west.area >= south.area ? "west" : "south";
  const peoplePick: Side = west.people >= south.people ? "west" : "south";
  const countPick: Side | "tie" =
    west.vehicles === south.vehicles ? "tie" : west.vehicles > south.vehicles ? "west" : "south";
  const chowkPick = areaPick === peoplePick ? areaPick : peoplePick;
  const green = lens === "count" ? (countPick === "tie" ? "west" : countPick) : chowkPick;
  const name = (side: Side) => (side === "west" ? "Approach A" : "Approach B");
  const disagree = countPick !== "tie" && countPick !== chowkPick;

  const placedWest = pack(queues.west);
  const placedSouth = pack(queues.south);

  return (
    <div className="explainer-problem">
      <div className="problem-cards">
        <article>
          <span className="problem-icon" aria-hidden="true">
            ⇋
          </span>
          <h3>No lanes</h3>
          <p>
            Two-wheelers filter through any gap. Autos, cars and buses share the same width. A queue
            is a shape on the road, not a line of cars.
          </p>
        </article>
        <article>
          <span className="problem-icon" aria-hidden="true">
            ≠
          </span>
          <h3>One vehicle is not one vehicle</h3>
          <p>
            In the simulator a bus carries {whole.format(vehicle.bus.occupancy)} people and a
            two-wheeler {oneDecimal.format(vehicle["two-wheeler"].occupancy)}. A signal that counts
            vehicles treats them the same.
          </p>
        </article>
        <article>
          <span className="problem-icon" aria-hidden="true">
            ⏱
          </span>
          <h3>People pay for it</h3>
          <p>
            TomTom estimates that Bengaluru drivers lost 168 hours to rush-hour traffic in 2025.{" "}
            <a href="https://www.tomtom.com/traffic-index/city/bengaluru/">TomTom Traffic Index</a>
          </p>
        </article>
      </div>

      <figure className="sandbox" aria-labelledby={titleId}>
        <header className="sandbox-header">
          <div>
            <h3 id={titleId}>Try it: who deserves the green?</h3>
            <p>Build two queues and see who each kind of signal would serve first.</p>
          </div>
          <div className="sandbox-presets">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setQueues({ west: preset.west, south: preset.south })}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </header>

        <div className="sandbox-body">
          <div className="sandbox-scene">
            <fieldset className="sandbox-lens">
              <legend className="sr-only">Signal decides by</legend>
              <button
                type="button"
                aria-pressed={lens === "count"}
                onClick={() => setLens("count")}
              >
                A vehicle-counting signal
              </button>
              <button
                type="button"
                aria-pressed={lens === "chowk"}
                onClick={() => setLens("chowk")}
              >
                CHOWK
              </button>
            </fieldset>
            <svg viewBox="0 0 640 420" role="img" aria-label="Two queues approaching a junction">
              <defs>
                <clipPath id={`${titleId}-west`}>
                  <rect x="0" y={box.y} width={box.x} height={box.size} />
                </clipPath>
                <clipPath id={`${titleId}-south`}>
                  <rect x={box.x} y={box.y + box.size} width={box.size} height={420} />
                </clipPath>
              </defs>
              <rect className="sandbox-ground" width="640" height="420" rx="14" />
              <rect className="sandbox-road" x="0" y={box.y} width="640" height={box.size} />
              <rect className="sandbox-road" x={box.x} y="0" width={box.size} height="420" />
              <rect
                className="sandbox-box"
                x={box.x}
                y={box.y}
                width={box.size}
                height={box.size}
              />
              <path
                className="sandbox-stop"
                d={`M${box.x - 3} ${box.y}v${box.size}M${box.x} ${box.y + box.size + 3}h${box.size}`}
              />
              <g
                className="sandbox-glow"
                data-on={green === "west"}
                clipPath={`url(#${titleId}-west)`}
              >
                <rect x="0" y={box.y} width={box.x} height={box.size} />
              </g>
              <g
                className="sandbox-glow"
                data-on={green === "south"}
                clipPath={`url(#${titleId}-south)`}
              >
                <rect x={box.x} y={box.y + box.size} width={box.size} height="420" />
              </g>
              <g clipPath={`url(#${titleId}-west)`}>
                {placedWest.map(({ key, id, depth, lateral, length, width }) => (
                  <rect
                    key={key}
                    className="sandbox-vehicle"
                    x={box.x - 6 - (depth + length) * scale}
                    y={box.y + lateral * scale}
                    width={length * scale}
                    height={width * scale}
                    rx={Math.min(4, width * 3)}
                    fill={colours[id]}
                  >
                    <title>{vehicleNames[id]}</title>
                  </rect>
                ))}
              </g>
              <g clipPath={`url(#${titleId}-south)`}>
                {placedSouth.map(({ key, id, depth, lateral, length, width }) => (
                  <rect
                    key={key}
                    className="sandbox-vehicle"
                    x={box.x + lateral * scale}
                    y={box.y + box.size + 6 + depth * scale}
                    width={width * scale}
                    height={length * scale}
                    rx={Math.min(4, width * 3)}
                    fill={colours[id]}
                  >
                    <title>{vehicleNames[id]}</title>
                  </rect>
                ))}
              </g>
              <Lights x={box.x - 16} y={box.y - 22} green={green === "west"} />
              <Lights
                x={box.x + box.size + 18}
                y={box.y + box.size + 24}
                green={green === "south"}
              />
              <text className="sandbox-label" x="16" y={box.y - 14}>
                Approach A
              </text>
              <text className="sandbox-label" x={box.x - 12} y="404" textAnchor="end">
                Approach B
              </text>
            </svg>
            <p className="sandbox-verdict" aria-live="polite">
              {lens === "count" ? (
                countPick === "tie" ? (
                  <>
                    Both queues have the same number of vehicles, so a counting signal sees a tie.
                  </>
                ) : (
                  <>
                    A vehicle-counting signal serves <strong>{name(countPick)}</strong>: it has more
                    vehicles.
                    {disagree &&
                      ` Meanwhile ${oneDecimal.format(chowkPick === "west" ? west.people : south.people)} people wait on the other side, in fewer but bigger vehicles.`}
                  </>
                )
              ) : (
                <>
                  CHOWK sees <strong>{name(chowkPick)}</strong>: more road area
                  {areaPick === peoplePick ? " and more people" : ""} waiting there.
                  {disagree && " A counting signal would have served the other side."}
                </>
              )}
            </p>
          </div>

          <div className="sandbox-controls">
            {(["west", "south"] as const).map((side) => (
              <fieldset key={side}>
                <legend>{name(side)}</legend>
                {classes.map((id) => (
                  <Counter
                    key={id}
                    label={vehicleNames[id]}
                    value={queues[side][id]}
                    max={limits[id]}
                    onChange={(next) =>
                      setQueues((current) => ({
                        ...current,
                        [side]: { ...current[side], [id]: next },
                      }))
                    }
                  />
                ))}
              </fieldset>
            ))}
            <Meter
              lens="count"
              label="Vehicles"
              hint="what a counting signal sees"
              west={west.vehicles}
              south={south.vehicles}
              format={(value) => whole.format(value)}
            />
            <Meter
              lens="area"
              label="Road area"
              hint="what CHOWK measures"
              west={west.area}
              south={south.area}
              format={(value) => `${whole.format(Math.round(value))} m²`}
            />
            <Meter
              lens="people"
              label="People"
              hint="what CHOWK is trained to serve"
              west={west.people}
              south={south.people}
              format={(value) => oneDecimal.format(value)}
            />
          </div>
        </div>
        <figcaption>
          Vehicle sizes and occupancies are the simulator’s assumptions. This sandbox compares what
          each signal looks at; the live demo shows CHOWK’s real decisions.
        </figcaption>
      </figure>
    </div>
  );
}
