import { useEffect, useId, useState } from "react";
import validation from "../../../../results/validation.json";

interface FilteringTrace {
  stripWidth: number;
  roadLength: number;
  roadStrips: number;
  carLength: number;
  carWidth: number;
  twoWheelerLength: number;
  twoWheelerWidth: number;
  frames: { time: number; carS: number; carStrip: number; bikeS: number; bikeStrip: number }[];
}

const filtering: typeof validation.filtering & { trace?: FilteringTrace } = validation.filtering;
const rawValidation =
  "https://github.com/JunaidAhamed-7777/chowk/blob/main/results/validation.json";

export function FilteringReplay() {
  const trace = filtering.trace;
  const titleId = useId();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const frames = trace?.frames.length ?? 0;
  const interval =
    trace && frames > 1 ? Math.round((trace.frames[1].time - trace.frames[0].time) * 1_000) : 500;
  useEffect(() => {
    if (!playing || index >= frames - 1) return;
    const timer = window.setTimeout(() => setIndex(index + 1), interval);
    return () => window.clearTimeout(timer);
  }, [playing, index, frames, interval]);

  const current = trace?.frames[index];
  if (!trace || !current || frames < 2) return null;
  const end = index === frames - 1;
  const minimum = Math.max(
    0,
    Math.min(...trace.frames.map(({ carS, bikeS }) => Math.min(carS, bikeS))) - 10,
  );
  const maximum = Math.min(
    trace.roadLength,
    Math.max(...trace.frames.map(({ carS, bikeS }) => Math.max(carS, bikeS))) + 8,
  );
  const x = (position: number) =>
    15 + (710 * (position - minimum)) / Math.max(1, maximum - minimum);
  const yScale = 122 / trace.roadStrips;
  const laneY = (strip: number, width: number) =>
    11 +
    (strip + Math.ceil(width / trace.stripWidth) / 2) * yScale -
    ((width / trace.stripWidth) * yScale) / 2;
  return (
    <figure className="method-figure">
      <svg viewBox="0 0 740 150" role="img" aria-labelledby={titleId}>
        <title id={titleId}>
          Replay of a two-wheeler using a free strip beside a stopped car in the simulator
        </title>
        <rect x="15" y="11" width="710" height="122" rx="7" fill="#121b2a" />
        {Array.from({ length: trace.roadStrips - 1 }, (_, strip) => 11 + (strip + 1) * yScale).map(
          (y) => (
            <line key={y} x1="16" x2="724" y1={y} y2={y} stroke="#314154" strokeDasharray="3 7" />
          ),
        )}
        <rect
          x={x(current.carS - trace.carLength)}
          y={laneY(current.carStrip, trace.carWidth)}
          width={x(trace.carLength) - x(0)}
          height={(trace.carWidth / trace.stripWidth) * yScale}
          rx="5"
          fill="#92bdff"
        >
          <title>Car</title>
        </rect>
        <rect
          x={x(current.bikeS - trace.twoWheelerLength)}
          y={laneY(current.bikeStrip, trace.twoWheelerWidth)}
          width={x(trace.twoWheelerLength) - x(0)}
          height={(trace.twoWheelerWidth / trace.stripWidth) * yScale}
          rx="3"
          fill="#3df2b4"
        >
          <title>Two-wheeler</title>
        </rect>
      </svg>
      <div className="filtering-controls">
        <button
          type="button"
          className="control-button"
          onClick={() => {
            if (end) setIndex(0);
            setPlaying(end || !playing);
          }}
        >
          {end ? "Replay" : playing ? "Pause" : "Play replay"}
        </button>
        <input
          type="range"
          min="0"
          max={frames - 1}
          value={index}
          aria-label="Filtering replay frame"
          aria-valuetext={`${current.time.toFixed(1)} seconds`}
          onChange={(event) => {
            setPlaying(false);
            setIndex(Number(event.target.value));
          }}
        />
        <output>{current.time.toFixed(1)} s</output>
      </div>
      <figcaption>
        Recorded simulator positions. The green two-wheeler filters alongside the blue car.
      </figcaption>
    </figure>
  );
}

function FundamentalDiagram() {
  const titleId = useId();
  const { points } = validation.fundamentalDiagram;
  const maxDensity = Math.max(...points.map(({ density }) => density));
  const maxFlow = Math.ceil(Math.max(...points.map(({ flow }) => flow)) / 500) * 500;
  const x = (density: number) => 69 + (628 * density) / maxDensity;
  const y = (flow: number) => 197 - (178 * flow) / maxFlow;
  return (
    <figure className="results-chart">
      <figcaption>Flow against traffic density</figcaption>
      <p>
        One lane with a periodic boundary and cars only. Dots show the flow and density measured
        after warm-up.
      </p>
      <div className="results-chart-scroll">
        <svg viewBox="0 0 740 235" role="img" aria-labelledby={titleId}>
          <title id={titleId}>
            Simulated flow in vehicles per hour against density in vehicles per kilometre
          </title>
          {[0, 0.25, 0.5, 0.75, 1].map((step) => (
            <g key={step}>
              <line
                className="chart-grid"
                x1="69"
                x2="697"
                y1={y(step * maxFlow)}
                y2={y(step * maxFlow)}
              />
              <text x="62" y={y(step * maxFlow) + 4} textAnchor="end">
                {(step * maxFlow).toFixed(0)}
              </text>
              <text x={x(step * maxDensity)} y="218" textAnchor="middle">
                {(step * maxDensity).toFixed(0)}
              </text>
            </g>
          ))}
          <text x="3" y="12">
            veh/h
          </text>
          <text x="730" y="233" textAnchor="end">
            vehicles/km
          </text>
          <polyline
            points={points.map(({ density, flow }) => `${x(density)},${y(flow)}`).join(" ")}
            fill="none"
            stroke="#3df2b4"
            strokeWidth="1.7"
          />
          {points.map(({ density, flow, initialDensity }) => (
            <circle key={initialDensity} cx={x(density)} cy={y(flow)} r="4" fill="#3df2b4">
              <title>
                {density.toFixed(1)} vehicles/km: {flow.toFixed(0)} vehicles/h
              </title>
            </circle>
          ))}
        </svg>
      </div>
    </figure>
  );
}

export function ValidationPlots() {
  const { invariants, twinDemand } = validation;
  const vehicleTicks = invariants.reduce((sum, row) => sum + row.vehicleTicks, 0);
  const overlaps = invariants.reduce((sum, row) => sum + row.overlapTicks, 0);
  const errors = invariants.reduce((sum, row) => sum + row.conservationViolations, 0);
  const backstops = invariants.reduce((sum, row) => sum + row.backstops, 0);
  return (
    <>
      <FundamentalDiagram />
      <dl className="validation-measurements">
        <div>
          <dt>Traffic invariants</dt>
          <dd>
            {overlaps.toLocaleString("en-IN")} overlapping ticks and{" "}
            {errors.toLocaleString("en-IN")} conservation violations across{" "}
            {vehicleTicks.toLocaleString("en-IN")} vehicle-ticks.
          </dd>
        </div>
        <div>
          <dt>Overlap backstop</dt>
          <dd>{backstops.toLocaleString("en-IN")} interventions across the measured runs.</dd>
        </div>
        <div>
          <dt>Filtering</dt>
          <dd>
            Two-wheelers were {(filtering.queueShare * 100).toFixed(1)}% of the queued mix and{" "}
            {(filtering.frontShare * 100).toFixed(1)}% within {filtering.zoneMetres} m of the front.
          </dd>
        </div>
        <div>
          <dt>Matched arrivals</dt>
          <dd>
            {twinDemand.arrivals.toLocaleString("en-IN")} arrivals were generated in the paired
            demand check.{" "}
            {twinDemand.passed
              ? "The arrival sequences matched."
              : "The arrival sequences differed."}
          </dd>
        </div>
      </dl>
      <p>
        <a href={rawValidation}>Download the simulator validation records</a>
      </p>
    </>
  );
}
