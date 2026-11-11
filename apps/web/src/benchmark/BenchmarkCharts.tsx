import {
  type BenchmarkFile,
  compareControllers,
  controllerLabel,
  formatMetric,
  primaryMetric,
  primaryScenario,
  type SummaryCell,
  scenarioLabel,
  signedPercent,
} from "@chowk/bench";
import { useId } from "react";

const colours: Record<string, string> = {
  chowk: "#3df2b4",
  "mp-area": "#92bdff",
  "mp-count": "#d5a9f4",
  actuated: "#f4b170",
  webster: "#bac5d9",
  "chowk-vehicle": "#92bdff",
  "chowk-count": "#d5a9f4",
  "chowk-pure": "#f4b170",
  "chowk-solo": "#bac5d9",
};

function IntervalMark({
  x,
  low,
  high,
  y,
  colour,
  label,
}: {
  x: number;
  low: number;
  high: number;
  y: number;
  colour: string;
  label: string;
}) {
  return (
    <g>
      <title>{label}</title>
      <path
        d={`M${low} ${y - 3}v6M${low} ${y}H${high}m0 -3v6`}
        fill="none"
        stroke={colour}
        strokeWidth="1.5"
      />
      <circle cx={x} cy={y} r="3.6" fill={colour} />
    </g>
  );
}

interface GroupedInterval {
  group: string;
  controller: string;
  mean: number;
  ciLow: number;
  ciHigh: number;
}

function GroupedIntervals({
  points,
  caption,
  description,
  extent,
  symmetric = false,
  format,
}: {
  points: readonly GroupedInterval[];
  caption: string;
  description: string;
  extent: number;
  symmetric?: boolean;
  format: (value: number) => string;
}) {
  const titleId = useId();
  const controllers = [...new Set(points.map(({ controller }) => controller))].sort(
    compareControllers,
  );
  const groups = [...new Set(points.map(({ group }) => group))];
  if (points.length === 0) return null;
  const start = symmetric ? -extent : 0;
  const plot = (value: number) => 166 + (632 * (value - start)) / (extent - start);
  const groupHeight = controllers.length * 15 + 21;
  const height = groups.length * groupHeight + 24;
  return (
    <figure className="results-chart">
      <figcaption>{caption}</figcaption>
      <ul className="chart-legend">
        {controllers.map((controller) => (
          <li key={controller}>
            <span style={{ backgroundColor: colours[controller] ?? "#bac5d9" }} />
            {controllerLabel(controller)}
          </li>
        ))}
      </ul>
      <div className="results-chart-scroll">
        <svg viewBox={`0 0 830 ${height}`} role="img" aria-labelledby={titleId}>
          <title id={titleId}>
            {description} Whiskers show 95% bootstrap confidence intervals.
          </title>
          {[0, 0.25, 0.5, 0.75, 1].map((step) => {
            const value = start + step * (extent - start);
            return (
              <g key={step}>
                <line
                  className={symmetric && value === 0 ? "chart-axis" : "chart-grid"}
                  x1={plot(value)}
                  x2={plot(value)}
                  y1="2"
                  y2={height - 23}
                />
                <text x={plot(value)} y={height - 5} textAnchor="middle">
                  {format(value)}
                </text>
              </g>
            );
          })}
          {groups.map((group, row) => (
            <g key={group}>
              <text className="chart-scenario" x="4" y={row * groupHeight + 19}>
                {group}
              </text>
              {controllers.map((controller, index) => {
                const point = points.find(
                  (point) => point.group === group && point.controller === controller,
                );
                if (!point) return null;
                return (
                  <IntervalMark
                    key={controller}
                    x={plot(point.mean)}
                    low={plot(point.ciLow)}
                    high={plot(point.ciHigh)}
                    y={row * groupHeight + 11 + index * 15}
                    colour={colours[controller] ?? "#bac5d9"}
                    label={`${group}, ${controllerLabel(controller)}: ${format(point.mean)} (${format(point.ciLow)} to ${format(point.ciHigh)})`}
                  />
                );
              })}
            </g>
          ))}
        </svg>
      </div>
    </figure>
  );
}

export function DelayChart({
  rows,
  caption = "Delay per person by scenario",
  groupBy = (row) => scenarioLabel(row.scenario),
}: {
  rows: readonly SummaryCell[];
  caption?: string;
  groupBy?: (row: SummaryCell) => string;
}) {
  const points = rows
    .filter(({ metric }) => metric === primaryMetric)
    .map((row) => ({ ...row, group: groupBy(row) }));
  const high = Math.max(1, ...points.map(({ ciHigh }) => ciHigh));
  return (
    <GroupedIntervals
      points={points}
      caption={caption}
      description={`${caption}. Dots show simulated means.`}
      extent={Math.ceil(high / 10) * 10}
      format={(value) => `${formatMetric(primaryMetric, value)} s`}
    />
  );
}

export function SensorNoiseChart({ benchmark }: { benchmark: BenchmarkFile }) {
  const points = benchmark.comparisons
    .filter(
      ({ suite, variant, b, metric }) =>
        suite === "B5" &&
        variant?.startsWith("noise-") &&
        b === "clean" &&
        metric === primaryMetric,
    )
    .map((point) => ({
      ...point,
      group: `${point.variant?.slice(6)}% sensor noise`,
      controller: point.a,
      mean: point.relDiff,
    }));
  const high = Math.max(
    0.01,
    ...points.flatMap(({ ciLow, ciHigh }) => [Math.abs(ciLow), Math.abs(ciHigh)]),
  );
  return (
    <GroupedIntervals
      points={points}
      caption="Change in delay per person under sensor noise"
      description="Relative change in simulated delay per person against the same controller on clean sensors. Positive values indicate more delay."
      extent={Math.ceil(high * 100) / 100}
      format={signedPercent}
      symmetric
    />
  );
}

export function LaneChart({ benchmark }: { benchmark: BenchmarkFile }) {
  const titleId = useId();
  const cases = [
    { a: "chowk", b: "mp-area" },
    { a: "chowk", b: "mp-count" },
    { a: "chowk", b: "actuated" },
    { a: "chowk", b: "webster" },
    { a: "mp-area", b: "mp-count" },
  ];
  const rows = cases
    .map(({ a, b }) => ({
      a,
      b,
      data: [primaryScenario, "cars-only"].map((scenario) =>
        benchmark.comparisons.find(
          (row) =>
            row.suite === "B2" &&
            row.scenario === scenario &&
            row.a === a &&
            row.b === b &&
            row.metric === primaryMetric,
        ),
      ),
    }))
    .filter(({ data }) => data.some(Boolean));
  if (rows.length === 0) return null;
  const range = Math.max(
    0.05,
    ...rows.flatMap(({ data }) =>
      data.flatMap((row) => (row ? [Math.abs(row.ciLow), Math.abs(row.ciHigh)] : [])),
    ),
  );
  const plot = (value: number) => 568 + (220 * value) / range;
  const height = rows.length * 45 + 30;
  return (
    <figure className="results-chart">
      <figcaption>How lane discipline changes the gap</figcaption>
      <p>
        Paired relative difference in delay per person. Values below zero mean lower delay for the
        first controller.
      </p>
      <ul className="chart-legend">
        <li>
          <span style={{ backgroundColor: "#3df2b4" }} />
          Mixed traffic
        </li>
        <li>
          <span style={{ backgroundColor: "#ffc27a" }} />
          Lane-disciplined cars
        </li>
      </ul>
      <div className="results-chart-scroll">
        <svg viewBox={`0 0 830 ${height}`} role="img" aria-labelledby={titleId}>
          <title id={titleId}>
            Paired relative delay differences and 95% intervals for mixed traffic and
            lane-disciplined cars
          </title>
          <line className="chart-axis" x1={plot(0)} x2={plot(0)} y1="5" y2={height - 26} />
          {[-range, 0, range].map((value) => (
            <text key={value} x={plot(value)} y={height - 6} textAnchor="middle">
              {signedPercent(value)}
            </text>
          ))}
          {rows.map(({ a, b, data }, rowIndex) => (
            <g key={`${a}-${b}`}>
              <text className="chart-scenario" x="4" y={rowIndex * 45 + 24}>
                {controllerLabel(a)} vs {controllerLabel(b)}
              </text>
              {data.map(
                (point, seriesIndex) =>
                  point && (
                    <IntervalMark
                      key={point.scenario}
                      x={plot(point.relDiff)}
                      low={plot(point.ciLow)}
                      high={plot(point.ciHigh)}
                      y={rowIndex * 45 + 15 + seriesIndex * 15}
                      colour={seriesIndex === 0 ? "#3df2b4" : "#ffc27a"}
                      label={`${scenarioLabel(point.scenario)}: ${signedPercent(point.relDiff)} (${signedPercent(point.ciLow)} to ${signedPercent(point.ciHigh)})`}
                    />
                  ),
              )}
            </g>
          ))}
        </svg>
      </div>
    </figure>
  );
}

export function LoadSweepChart({ rows }: { rows: readonly SummaryCell[] }) {
  const titleId = useId();
  const points = rows
    .filter(({ metric, variant }) => metric === primaryMetric && variant?.startsWith("load-"))
    .map((row) => ({ ...row, load: Number(row.variant?.slice(5)) }));
  if (points.length === 0) return null;
  const loads = [...new Set(points.map(({ load }) => load))].sort((a, b) => a - b);
  const controllers = [...new Set(points.map(({ controller }) => controller))].sort(
    compareControllers,
  );
  const yMaximum = Math.max(
    10,
    Math.ceil(Math.max(...points.map(({ ciHigh }) => ciHigh)) / 10) * 10,
  );
  const xMinimum = loads[0];
  const xMaximum = loads[loads.length - 1];
  const x = (load: number) => 56 + (739 * (load - xMinimum)) / (xMaximum - xMinimum || 1);
  const y = (delay: number) => 222 - (205 * delay) / yMaximum;
  return (
    <figure className="results-chart">
      <figcaption>Delay as demand approaches capacity</figcaption>
      <ul className="chart-legend">
        {controllers.map((controller) => (
          <li key={controller}>
            <span style={{ backgroundColor: colours[controller] ?? "#bac5d9" }} />
            {controllerLabel(controller)}
          </li>
        ))}
      </ul>
      <div className="results-chart-scroll">
        <svg viewBox="0 0 830 258" role="img" aria-labelledby={titleId}>
          <title id={titleId}>
            Mean simulated delay per person over calibrated demand loads. Vertical bars show 95%
            intervals.
          </title>
          {[0, 0.25, 0.5, 0.75, 1].map((step) => (
            <g key={step}>
              <line
                className="chart-grid"
                x1="56"
                x2="795"
                y1={y(step * yMaximum)}
                y2={y(step * yMaximum)}
              />
              <text x="49" y={y(step * yMaximum) + 4} textAnchor="end">
                {(step * yMaximum).toFixed(0)} s
              </text>
            </g>
          ))}
          {loads.map((load) => (
            <text key={load} x={x(load)} y="246" textAnchor="middle">
              {load.toFixed(1)}×
            </text>
          ))}
          {controllers.map((controller) => {
            const series = points
              .filter((point) => point.controller === controller)
              .sort((a, b) => a.load - b.load);
            const colour = colours[controller] ?? "#bac5d9";
            return (
              <g key={controller}>
                <polyline
                  points={series.map((point) => `${x(point.load)},${y(point.mean)}`).join(" ")}
                  fill="none"
                  stroke={colour}
                  strokeWidth="1.5"
                />
                {series.map((point) => (
                  <g key={point.load}>
                    <title>
                      {controllerLabel(controller)} at load {point.load}:{" "}
                      {formatMetric(primaryMetric, point.mean)} s (
                      {formatMetric(primaryMetric, point.ciLow)} to{" "}
                      {formatMetric(primaryMetric, point.ciHigh)} s)
                    </title>
                    <line
                      x1={x(point.load)}
                      x2={x(point.load)}
                      y1={y(point.ciLow)}
                      y2={y(point.ciHigh)}
                      stroke={colour}
                    />
                    <circle cx={x(point.load)} cy={y(point.mean)} r="3" fill={colour} />
                  </g>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </figure>
  );
}
