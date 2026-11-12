import { type ReactNode, useEffect, useState } from "react";
import { type LiveReadout, type MetricParts, metricDefinitions } from "../sim/LiveMetrics";
import "./metricHud.css";

type MetricKey = (typeof metricDefinitions)[number]["key"];
type Explained = MetricKey | "headline";

const number = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});
const precise = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 });
const relative = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});
const width = 160;
const height = 21;
const unavailable = (
  <>
    <span aria-hidden="true">—</span>
    <span className="sr-only">Unavailable</span>
  </>
);

/** The rule behind each card, and this moment's window totals substituted into it. */
const formulas: Record<
  MetricKey,
  { rule: string; line: (parts: MetricParts) => [string, string] | undefined }
> = {
  delay: {
    rule: "Every 0.25 s tick, each person in a vehicle on the road or still waiting to enter adds the time lost against free speed: occupancy × 0.25 s × (1 − speed ÷ free speed).",
    line: ({ personDelay, people }) =>
      people > 0
        ? [`${number.format(personDelay)} person-s ÷ ${number.format(people)} people`, "s"]
        : undefined,
  },
  stops: {
    rule: "A stop counts when a vehicle slows below 0.5 m/s after having exceeded 2 m/s.",
    line: ({ stops, vehicles }) =>
      vehicles > 0
        ? [`${number.format(stops)} stops ÷ ${number.format(vehicles)} vehicles`, ""]
        : undefined,
  },
  throughput: {
    rule: "People in vehicles that finished their trip during the window, scaled to one simulated hour.",
    line: ({ completedPeople, hours }) =>
      hours > 0
        ? [`${number.format(completedPeople)} people ÷ ${precise.format(hours)} h`, "people/h"]
        : undefined,
  },
  emissions: {
    rule: "Each tick, per vehicle: fuel = idle + k₁·speed + k₂·speed·acceleration with per-class coefficients, times a CO₂ factor for its fuel. The coefficients are assumed, so this is an estimate.",
    line: ({ co2Kg, hours }) =>
      hours > 0 ? [`${decimal.format(co2Kg)} kg ÷ ${precise.format(hours)} h`, "kg/h"] : undefined,
  },
  ambulance: {
    rule: "Entry-to-exit travel time of the most recent ambulance to finish its trip. Not averaged over a window.",
    line: ({ ambulance }) => (ambulance === null ? undefined : ["latest completed trip", "s"]),
  },
};

function Calculation({
  id,
  title,
  open,
  onClose,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="metric-calculation" id={id} role="tooltip" data-open={open}>
      <header>
        <strong>{title}</strong>
        {open && (
          <button type="button" className="metric-calculation-close" onClick={onClose}>
            <span aria-hidden="true">×</span>
            <span className="sr-only">Close calculation</span>
          </button>
        )}
      </header>
      {children}
    </div>
  );
}

function MetricCalculation({
  metric,
  readout,
  single,
  open,
  onClose,
  clock,
}: {
  metric: (typeof metricDefinitions)[number];
  readout: LiveReadout;
  clock: (elapsed: number) => string;
  single: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const { key, label, precision } = metric;
  const formula = formulas[key];
  const format = precision ? decimal : number;
  const sides = single ? ([1] as const) : ([0, 1] as const);
  return (
    <Calculation
      id={`metric-${key}-description`}
      title={`How ${label.toLowerCase()} is calculated`}
      open={open}
      onClose={onClose}
    >
      <p className="metric-calculation-rule">{formula.rule}</p>
      {key !== "ambulance" && (
        <p className="metric-calculation-window">
          Window: {clock(readout.window.from)} to {clock(readout.window.to)} simulated
        </p>
      )}
      <ul>
        {sides.map((side) => {
          const value = readout.values[side][key];
          const line = formula.line(readout.parts[side]);
          return (
            <li key={side} data-side={side}>
              <span className="metric-calculation-side">{side === 0 ? "A" : "B"}</span>
              {line && value !== null ? (
                <span>
                  {line[0]} = <strong>{format.format(value)}</strong> {line[1]}
                </span>
              ) : (
                <span>No data in this window yet</span>
              )}
            </li>
          );
        })}
      </ul>
      {key === "delay" && (
        <>
          <p className="metric-calculation-window">Counting vehicles instead of people:</p>
          <ul>
            {sides.map((side) => {
              const { vehicleDelay, vehicles } = readout.parts[side];
              return (
                <li key={side} data-side={side}>
                  <span className="metric-calculation-side">{side === 0 ? "A" : "B"}</span>
                  {vehicles > 0 ? (
                    <span>
                      {number.format(vehicleDelay)} vehicle-s ÷ {number.format(vehicles)} vehicles ={" "}
                      <strong>{decimal.format(vehicleDelay / vehicles)}</strong> s
                    </span>
                  ) : (
                    <span>No data in this window yet</span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="metric-calculation-note">
            Per person, a bus with 40 passengers counts 40 times; per vehicle it counts once. CHOWK
            is trained to cut delay per person.
          </p>
        </>
      )}
      <p className="metric-calculation-note">
        {single ? "" : "Change = (B − A) ÷ A. "}Simulation result.
      </p>
    </Calculation>
  );
}

function Series({
  readout,
  metric,
  single,
}: {
  readout: LiveReadout;
  metric: MetricKey;
  single: boolean;
}) {
  let min = Infinity;
  let max = -Infinity;
  for (const { values } of [...readout.history, ...readout.ghost]) {
    for (const side of [0, 1] as const) {
      if (single && side === 0) continue;
      const value = values[side][metric];
      if (value === null) continue;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }
  const last = Math.max(readout.elapsed, readout.ghost.at(-1)?.time ?? 0, 1);
  const range = Math.max(max - min, 0.01);
  return (
    <svg
      className="metric-series"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {readout.marks
        .filter(({ time }) => time <= last)
        .map(({ id, time, label }) => {
          const x = (time / last) * width;
          return (
            <path key={id} className="metric-series-mark" d={`M${x} 0 V${height}`}>
              <title>{label}</title>
            </path>
          );
        })}
      {([0, 1] as const).map((side) => {
        if (single && side === 0) return null;
        let ghost = "";
        readout.ghost.forEach(({ time, values }, index) => {
          const value = values[side][metric];
          if (value === null) return;
          const x = ((time / last) * width).toFixed(2);
          const y = (height - 2 - ((value - min) / range) * (height - 4)).toFixed(2);
          ghost += `${index === 0 ? "M" : "L"}${x} ${y}`;
        });
        return ghost ? (
          <path
            key={`ghost-${side}`}
            className={`metric-series-ghost metric-series-ghost-${side === 0 ? "left" : "right"}`}
            d={ghost}
          />
        ) : null;
      })}
      {([0, 1] as const).map((side) => {
        if (single && side === 0) return null;
        let path = "";
        let visible = false;
        for (const { time, values } of readout.history) {
          const value = values[side][metric];
          if (value === null) {
            visible = false;
            continue;
          }
          const x = ((time / last) * width).toFixed(2);
          const y = (height - 2 - ((value - min) / range) * (height - 4)).toFixed(2);
          path += `${visible ? "L" : "M"}${x} ${y}`;
          visible = true;
        }
        return (
          <path
            key={side}
            className={side === 0 ? "metric-series-left" : "metric-series-right"}
            d={path}
          />
        );
      })}
    </svg>
  );
}

function InfoButton({
  explained,
  label,
  help,
  onHelp,
}: {
  explained: Explained;
  label: string;
  help: Explained | undefined;
  onHelp: (next: Explained | undefined) => void;
}) {
  return (
    <button
      className="metric-info"
      type="button"
      aria-label={`How ${label} is calculated`}
      aria-describedby={`metric-${explained}-description`}
      aria-expanded={help === explained}
      title="Show the calculation"
      onClick={() => onHelp(help === explained ? undefined : explained)}
      onKeyDown={(event) => {
        if (event.key === "Escape") onHelp(undefined);
      }}
    >
      <span aria-hidden="true">ƒ</span>
    </button>
  );
}

export function MetricHud({
  readout,
  single,
  clock,
}: {
  readout: LiveReadout;
  single: boolean;
  clock: (elapsed: number) => string;
}) {
  const [help, setHelp] = useState<Explained>();
  useEffect(() => {
    if (!help) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest(".metric-calculation, .metric-info")) setHelp(undefined);
    };
    document.addEventListener("pointerdown", close, true);
    return () => document.removeEventListener("pointerdown", close, true);
  }, [help]);
  const saved = readout.peopleHours >= 0;
  const headline = saved ? "People-hours saved this hour" : "People-hours added this hour";
  return (
    <section className="comparison-hud" aria-label="Live simulation results">
      {!single && (
        <div className="comparison-headline">
          <span>{headline}</span>
          <strong>{decimal.format(Math.abs(readout.peopleHours))}</strong>
          <InfoButton
            explained="headline"
            label="people-hours saved"
            help={help}
            onHelp={setHelp}
          />
          <Calculation
            id="metric-headline-description"
            title="How people-hours saved is calculated"
            open={help === "headline"}
            onClose={() => setHelp(undefined)}
          >
            <p className="metric-calculation-rule">
              Total person-delay under A minus total person-delay under B over the last simulated
              hour, converted from person-seconds to person-hours. Both sides face identical
              vehicles, so the difference comes from the signals.
            </p>
            <p className="metric-calculation-window">
              Window: {clock(readout.hour.from)} to {clock(readout.hour.to)} simulated
            </p>
            <ul>
              <li>
                <span className="metric-calculation-side">=</span>
                <span>
                  ({number.format(readout.hour.left)} − {number.format(readout.hour.right)})
                  person-s ÷ 3,600 = <strong>{decimal.format(readout.peopleHours)}</strong> h
                </span>
              </li>
            </ul>
            <p className="metric-calculation-note">
              Negative means B added delay. Simulation result.
            </p>
          </Calculation>
        </div>
      )}
      <dl className="comparison-metrics">
        {metricDefinitions.map((definition, index) => {
          const { key, label, unit, precision, benefit } = definition;
          const left = readout.values[0][key];
          const right = readout.values[1][key];
          const delta =
            left !== null && left > 0 && right !== null ? ((right - left) / left) * 100 : null;
          const change = delta !== null && Math.abs(delta) < 0.05 ? 0 : delta;
          const outcome = !change ? "even" : change * benefit > 0 ? "better" : "worse";
          const format = precision ? decimal : number;
          return (
            <div className="comparison-metric" key={key} data-anchor={index < 2 ? "start" : "end"}>
              <dt className="comparison-metric-label">
                <span>{label}</span>
                <InfoButton
                  explained={key}
                  label={label.toLowerCase()}
                  help={help}
                  onHelp={setHelp}
                />
                <MetricCalculation
                  metric={definition}
                  readout={readout}
                  single={single}
                  open={help === key}
                  onClose={() => setHelp(undefined)}
                  clock={clock}
                />
              </dt>
              <dd className="comparison-metric-values">
                {!single && (
                  <span className="metric-left">
                    <span className="sr-only">Left </span>
                    <span className="metric-side" aria-hidden="true">
                      A
                    </span>
                    {left === null ? unavailable : format.format(left)}
                  </span>
                )}
                <span className="metric-right">
                  <span className="sr-only">Right </span>
                  {!single && (
                    <span className="metric-side" aria-hidden="true">
                      B
                    </span>
                  )}
                  {right === null ? unavailable : format.format(right)}
                </span>
                {unit && <small>{unit}</small>}
              </dd>
              <dd className="comparison-metric-trend">
                <Series readout={readout} metric={key} single={single} />
                {!single && (
                  <span className={`metric-change metric-change-${outcome}`}>
                    <span className="sr-only">Right versus left: </span>
                    {change === null ? (
                      unavailable
                    ) : (
                      <>
                        <span aria-hidden="true">{change > 0 ? "↑ " : change < 0 ? "↓ " : ""}</span>
                        {relative.format(change)}%
                      </>
                    )}
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
