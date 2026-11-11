import { type LiveReadout, metricDefinitions } from "../sim/LiveMetrics";
import "./metricHud.css";

const number = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});
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

function Series({
  readout,
  metric,
  single,
}: {
  readout: LiveReadout;
  metric: (typeof metricDefinitions)[number]["key"];
  single: boolean;
}) {
  let min = Infinity;
  let max = -Infinity;
  for (const { values } of readout.history) {
    for (const side of [0, 1] as const) {
      if (single && side === 0) continue;
      const value = values[side][metric];
      if (value === null) continue;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }
  const last = Math.max(readout.elapsed, 1);
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

export function MetricHud({ readout, single }: { readout: LiveReadout; single: boolean }) {
  const [help, setHelp] = useState<(typeof metricDefinitions)[number]["key"]>();
  const headline =
    readout.peopleHours < 0 ? "People-hours added this hour" : "People-hours saved this hour";
  return (
    <section className="comparison-hud" aria-label="Live simulation results">
      {!single && (
        <div className="comparison-headline">
          <span>{headline}</span>
          <strong>{decimal.format(Math.abs(readout.peopleHours))}</strong>
        </div>
      )}
      <dl className="comparison-metrics">
        {metricDefinitions.map(({ key, label, unit, precision, benefit, description }) => {
          const left = readout.values[0][key];
          const right = readout.values[1][key];
          const delta =
            left !== null && left > 0 && right !== null ? ((right - left) / left) * 100 : null;
          const change = delta !== null && Math.abs(delta) < 0.05 ? 0 : delta;
          const outcome = !change ? "even" : change * benefit > 0 ? "better" : "worse";
          const format = precision ? decimal : number;
          return (
            <div className="comparison-metric" key={key}>
              <dt className="comparison-metric-label">
                <span>{label}</span>
                <button
                  className="metric-info"
                  type="button"
                  aria-label={`About ${label.toLowerCase()}`}
                  aria-describedby={`metric-${key}-description`}
                  aria-expanded={help === key}
                  onClick={() => setHelp(help === key ? undefined : key)}
                  onBlur={() => setHelp(undefined)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setHelp(undefined);
                  }}
                >
                  ?
                </button>
                <span className="metric-tooltip" id={`metric-${key}-description`} role="tooltip">
                  {description} Simulation result.
                </span>
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
import { useState } from "react";
