import {
  type BenchmarkFile,
  type BenchmarkRun,
  compareRuns,
  controllerLabel,
  formatMetric,
  metricLabels,
  runKey,
  signedPercent,
} from "@chowk/bench";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { loadPolicy } from "./BenchmarkReproduction";
import type { ReproductionRequest, ReproductionResponse } from "./reproduction";

// Every number here is computed in the page from the published raw runs.
const higherIsBetter = new Set(["throughputPeoplePerHour", "completionRate", "ambulanceCompleted"]);
const replayable = new Set(["webster", "actuated", "mp-count", "mp-area", "mp-area+preempt"]);
const learned = new Set(["chowk", "chowk+preempt"]);
const RESAMPLES = 4_000;

interface Cell {
  key: string;
  suite: string;
  scenario: string;
  variant?: string;
  network: string;
  label: string;
}

function cellKey(run: BenchmarkRun) {
  return JSON.stringify([run.suite, run.scenario, run.network, run.variant ?? ""]);
}

/** Deterministic bootstrap of the mean paired relative difference. */
function bootstrap(values: readonly number[]) {
  let state = 0x9e3779b9;
  const next = () => {
    state = (Math.imul(state ^ (state >>> 15), 0x2c1b3c6d) + 0x297a2d39) >>> 0;
    return state / 0x1_0000_0000;
  };
  const means = new Float64Array(RESAMPLES);
  for (let sample = 0; sample < RESAMPLES; sample++) {
    let sum = 0;
    for (let index = 0; index < values.length; index++)
      sum += values[Math.floor(next() * values.length)];
    means[sample] = sum / values.length;
  }
  means.sort();
  return [means[Math.floor(RESAMPLES * 0.025)], means[Math.ceil(RESAMPLES * 0.975) - 1]] as const;
}

export function SkepticExplorer({ benchmark }: { benchmark: BenchmarkFile }) {
  const id = useId();
  const cells = useMemo(() => {
    const seen = new Map<string, Cell>();
    for (const run of benchmark.runs) {
      const key = cellKey(run);
      if (seen.has(key)) continue;
      seen.set(key, {
        key,
        suite: run.suite,
        scenario: run.scenario,
        variant: run.variant,
        network: run.network,
        label: [run.suite, run.scenario, run.variant, run.network === "corridor" ? "" : run.network]
          .filter(Boolean)
          .join(" · "),
      });
    }
    return [...seen.values()];
  }, [benchmark]);
  const [cell, setCell] = useState(
    () => cells.find(({ suite, scenario }) => suite === "B1" && scenario === "morning-peak")?.key,
  );
  const runs = useMemo(
    () => benchmark.runs.filter((run) => cellKey(run) === cell),
    [benchmark, cell],
  );
  const controllers = useMemo(() => [...new Set(runs.map((run) => run.controller))], [runs]);
  const metrics = useMemo(
    () =>
      Object.keys(metricLabels).filter((metric) =>
        runs.some((run) => Number.isFinite(run.metrics[metric])),
      ),
    [runs],
  );
  const [a, setA] = useState("chowk");
  const [b, setB] = useState("mp-area");
  const [metric, setMetric] = useState("delayPerPerson");
  const left = controllers.includes(a) ? a : controllers[0];
  const right = controllers.includes(b) && b !== left ? b : controllers.find((c) => c !== left);
  const activeMetric = metrics.includes(metric) ? metric : metrics[0];

  const pairs = useMemo(() => {
    const bySeed = new Map(
      runs.filter((run) => run.controller === right).map((run) => [run.seed, run]),
    );
    return runs
      .filter((run) => run.controller === left)
      .flatMap((run) => {
        const other = bySeed.get(run.seed);
        const x = run.metrics[activeMetric];
        const y = other?.metrics[activeMetric];
        if (!other || !Number.isFinite(x) || !Number.isFinite(y) || y === 0) return [];
        return [
          { seed: run.seed, a: run, b: other, relative: (x - (y as number)) / (y as number) },
        ];
      })
      .sort((p, q) => p.seed - q.seed);
  }, [runs, left, right, activeMetric]);

  const summary = useMemo(() => {
    if (pairs.length === 0) return undefined;
    const values = pairs.map(({ relative }) => relative);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const better = higherIsBetter.has(activeMetric)
      ? values.filter((value) => value > 0).length
      : values.filter((value) => value < 0).length;
    const [low, high] = bootstrap(values);
    return { mean, low, high, better };
  }, [pairs, activeMetric]);

  const raw = Math.max(
    0.005,
    ...pairs.map(({ relative }) => Math.abs(relative)),
    Math.abs(summary?.low ?? 0),
    Math.abs(summary?.high ?? 0),
  );
  const step =
    [0.005, 0.01, 0.02, 0.025, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5].find(
      (candidate) => raw / candidate <= 3,
    ) ?? Math.ceil(raw / 3);
  const extent = Math.ceil(raw / step - 1e-9) * step;
  const ticks = Array.from(
    { length: Math.round((2 * extent) / step) + 1 },
    (_, index) => -extent + index * step,
  );
  const plotLeft = 150;
  const plotRight = 806;
  const rowHeight = 15;
  const plotTop = 34;
  const plotBottom = plotTop + pairs.length * rowHeight + 6;
  const chartHeight = plotBottom + 50;
  const x = (value: number) =>
    plotLeft + ((value + extent) / (2 * extent)) * (plotRight - plotLeft);
  const lowerIsBetter = !higherIsBetter.has(activeMetric);
  const aBetter = (relative: number) => (lowerIsBetter ? relative < 0 : relative > 0);

  const [replay, setReplay] = useState<{ seed: number; status: string }>();
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);
  const canReplay = (controller: string | undefined) =>
    controller !== undefined &&
    (replayable.has(controller) ||
      (learned.has(controller) && benchmark.meta.policyHash === __CHOWK_POLICY_HASH__)) &&
    benchmark.meta.simVersion === __CHOWK_SIM_VERSION__;

  async function replaySeed(pair: (typeof pairs)[number]) {
    worker.current?.terminate();
    setReplay({ seed: pair.seed, status: "Replaying both runs in your browser…" });
    try {
      const policy =
        learned.has(pair.a.controller) || learned.has(pair.b.controller)
          ? await loadPolicy(new AbortController().signal, benchmark.meta.policyHash)
          : undefined;
      const instance = new Worker(new URL("../workers/bench.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.current = instance;
      const results: (BenchmarkRun | undefined)[] = [];
      const expected = [pair.a, pair.b];
      instance.onmessage = ({ data }: MessageEvent<ReproductionResponse>) => {
        if ("error" in data) {
          setReplay({ seed: pair.seed, status: `Replay failed: ${data.error}` });
          instance.terminate();
          return;
        }
        results[data.index] = data.run;
        if (results.filter(Boolean).length < 2) return;
        instance.terminate();
        const mismatches = results.flatMap((run, index) =>
          run ? compareRuns(run, expected[index]) : ["missing"],
        );
        setReplay({
          seed: pair.seed,
          status:
            mismatches.length === 0
              ? `Seed ${pair.seed}: both runs matched the published metrics and final state hashes.`
              : `Seed ${pair.seed}: ${mismatches.join("; ")}`,
        });
      };
      expected.forEach((run, index) => {
        const { metrics: _metrics, finalHash: _hash, ...identity } = run;
        const message: ReproductionRequest = {
          index,
          identity,
          options: { policy: learned.has(run.controller) ? policy : undefined },
        };
        instance.postMessage(message);
      });
    } catch (error) {
      setReplay({
        seed: pair.seed,
        status: error instanceof Error ? error.message : "Replay failed.",
      });
    }
  }

  const label = metricLabels[activeMetric]?.label ?? activeMetric;
  return (
    <div className="skeptic">
      <div className="skeptic-controls">
        <label>
          Cell
          <select value={cell} onChange={(event) => setCell(event.target.value)}>
            {cells.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          A
          <select value={left} onChange={(event) => setA(event.target.value)}>
            {controllers.map((controller) => (
              <option key={controller} value={controller}>
                {controllerLabel(controller)}
              </option>
            ))}
          </select>
        </label>
        <label>
          B
          <select value={right} onChange={(event) => setB(event.target.value)}>
            {controllers
              .filter((controller) => controller !== left)
              .map((controller) => (
                <option key={controller} value={controller}>
                  {controllerLabel(controller)}
                </option>
              ))}
          </select>
        </label>
        <label>
          Metric
          <select value={activeMetric} onChange={(event) => setMetric(event.target.value)}>
            {metrics.map((item) => (
              <option key={item} value={item}>
                {metricLabels[item].label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {summary && right ? (
        <>
          <p className="skeptic-summary" aria-live="polite">
            {controllerLabel(left)} versus {controllerLabel(right)}, {label.toLowerCase()}: mean
            paired difference {signedPercent(summary.mean)} (95% bootstrap CI{" "}
            {signedPercent(summary.low)} to {signedPercent(summary.high)}). {controllerLabel(left)}{" "}
            was better on {summary.better} of {pairs.length} held-out seeds.
            {summary.low <= 0 && summary.high >= 0 && " The interval includes zero."}
          </p>
          <figure className="results-chart skeptic-chart">
            <figcaption>
              {label}: {controllerLabel(left)} relative to {controllerLabel(right)}, seed by seed
            </figcaption>
            <p>
              Each dot is one held-out seed: the same traffic run under both controllers. Left of
              zero, {controllerLabel(left)} had a lower {label.toLowerCase()} than{" "}
              {controllerLabel(right)} on that seed, which is {lowerIsBetter ? "better" : "worse"}.
            </p>
            <ul className="chart-legend">
              <li>
                <span className="skeptic-key-better" />
                {controllerLabel(left)} better
              </li>
              <li>
                <span className="skeptic-key-worse" />
                {controllerLabel(left)} worse
              </li>
              <li>
                <span className="skeptic-key-mean" />
                Mean difference
              </li>
              <li>
                <span className="skeptic-key-ci" />
                95% bootstrap interval of the mean
              </li>
            </ul>
            <div className="results-chart-scroll">
              <svg viewBox={`0 0 830 ${chartHeight}`} role="img" aria-labelledby={`${id}-plot`}>
                <title id={`${id}-plot`}>
                  Paired difference per seed for {label}, {controllerLabel(left)} relative to{" "}
                  {controllerLabel(right)}
                </title>
                <rect
                  x={x(summary.low)}
                  y={plotTop}
                  width={Math.max(1.5, x(summary.high) - x(summary.low))}
                  height={plotBottom - plotTop}
                  className="skeptic-ci"
                />
                {pairs.map((pair, index) => (
                  <line
                    key={`row-${pair.seed}`}
                    className="skeptic-row"
                    x1={plotLeft}
                    x2={plotRight}
                    y1={plotTop + index * rowHeight + rowHeight / 2 + 3}
                    y2={plotTop + index * rowHeight + rowHeight / 2 + 3}
                  />
                ))}
                {ticks.map((tick) => (
                  <g key={tick}>
                    <line
                      className={Math.abs(tick) < 1e-9 ? "chart-axis skeptic-zero" : "chart-grid"}
                      x1={x(tick)}
                      x2={x(tick)}
                      y1={plotTop}
                      y2={plotBottom}
                    />
                    <text x={x(tick)} y={plotBottom + 16} textAnchor="middle">
                      {Math.abs(tick) < 1e-9 ? "0%" : signedPercent(tick)}
                    </text>
                  </g>
                ))}
                <line
                  className="skeptic-mean"
                  x1={x(summary.mean)}
                  x2={x(summary.mean)}
                  y1={plotTop - 4}
                  y2={plotBottom}
                />
                <text
                  className="skeptic-mean-label"
                  x={x(summary.mean)}
                  y={plotTop - 8}
                  textAnchor={
                    x(summary.mean) > plotRight - 60
                      ? "end"
                      : x(summary.mean) < plotLeft + 60
                        ? "start"
                        : "middle"
                  }
                >
                  mean {signedPercent(summary.mean)}
                </text>
                <text className="skeptic-direction" x={plotLeft} y="12">
                  ←{" "}
                  {lowerIsBetter
                    ? `${controllerLabel(left)} lower (better)`
                    : `${controllerLabel(left)} lower (worse)`}
                </text>
                <text className="skeptic-direction" x={plotRight} y="12" textAnchor="end">
                  {lowerIsBetter
                    ? `${controllerLabel(left)} higher (worse)`
                    : `${controllerLabel(left)} higher (better)`}{" "}
                  →
                </text>
                {pairs.map((pair, index) => {
                  const y = plotTop + index * rowHeight + rowHeight / 2 + 3;
                  return (
                    <g key={pair.seed}>
                      <text x={plotLeft - 10} y={y + 4} textAnchor="end">
                        {pair.seed}
                      </text>
                      <circle
                        cx={x(pair.relative)}
                        cy={y}
                        r={4.2}
                        className={
                          pair.relative === 0
                            ? "skeptic-dot"
                            : aBetter(pair.relative)
                              ? "skeptic-dot skeptic-dot-better"
                              : "skeptic-dot skeptic-dot-worse"
                        }
                      >
                        <title>
                          Seed {pair.seed}:{" "}
                          {formatMetric(activeMetric, pair.a.metrics[activeMetric])} vs{" "}
                          {formatMetric(activeMetric, pair.b.metrics[activeMetric])} (
                          {signedPercent(pair.relative)})
                        </title>
                      </circle>
                    </g>
                  );
                })}
                <text
                  className="chart-axis-title"
                  transform={`translate(16 ${(plotTop + plotBottom) / 2}) rotate(-90)`}
                  textAnchor="middle"
                >
                  Held-out seed
                </text>
                <text
                  className="chart-axis-title"
                  x={(plotLeft + plotRight) / 2}
                  y={chartHeight - 6}
                  textAnchor="middle"
                >
                  Difference in {label.toLowerCase()}, {controllerLabel(left)} vs{" "}
                  {controllerLabel(right)} (%)
                </text>
              </svg>
            </div>
          </figure>
          <details className="skeptic-seeds">
            <summary>Every seed</summary>
            <table>
              <thead>
                <tr>
                  <th scope="col">Seed</th>
                  <th scope="col">{controllerLabel(left)}</th>
                  <th scope="col">{controllerLabel(right)}</th>
                  <th scope="col">Difference</th>
                  <th scope="col">
                    <span className="sr-only">Replay</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pairs.map((pair) => (
                  <tr key={runKey(pair.a)}>
                    <td>{pair.seed}</td>
                    <td>{formatMetric(activeMetric, pair.a.metrics[activeMetric])}</td>
                    <td>{formatMetric(activeMetric, pair.b.metrics[activeMetric])}</td>
                    <td>{signedPercent(pair.relative)}</td>
                    <td>
                      {canReplay(pair.a.controller) && canReplay(pair.b.controller) && (
                        <button
                          type="button"
                          className="control-button"
                          onClick={() => void replaySeed(pair)}
                        >
                          Replay
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          {replay && (
            <p className="skeptic-replay" role="status">
              {replay.status}
            </p>
          )}
        </>
      ) : (
        <p>No paired runs for this choice.</p>
      )}
    </div>
  );
}
