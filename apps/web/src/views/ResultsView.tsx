import {
  type BenchmarkFile,
  compareControllers,
  controllerLabel,
  type EngineeringReport,
  formatMetric,
  mainMetricKeys,
  metricLabels,
  primaryMetric,
  primaryScenario,
  rendererName,
  scenarioLabel,
  signedPercent,
  type SummaryCell,
} from "@chowk/bench";
import { useEffect, useState } from "react";
import { DelayChart, LaneChart, LoadSweepChart } from "../benchmark/BenchmarkCharts";
import { BenchmarkReproduction } from "../benchmark/BenchmarkReproduction";
import { TrainingCurveChart } from "../benchmark/TrainingCurveChart";
import "../benchmark/results.css";

const [publishedFile] = Object.values(
  import.meta.glob<string>("../../../../results/benchmark.json", {
    query: "?url&no-inline",
    import: "default",
  }),
);
const repository = "https://github.com/JunaidAhamed-7777/chowk";
const dateFormat = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "long",
  timeZone: "Asia/Kolkata",
});

function ResultsTable({
  rows,
  metrics = mainMetricKeys,
  title,
}: {
  rows: readonly SummaryCell[];
  metrics?: readonly string[];
  title: string;
}) {
  const controllers = [...new Set(rows.map(({ controller }) => controller))].sort(
    compareControllers,
  );
  if (controllers.length === 0) return <p>No runs are published for this scenario.</p>;
  const best = metrics.map((metric) => {
    const values = rows.filter((row) => row.metric === metric).map(({ mean }) => mean);
    return metric === "throughputPeoplePerHour" ||
      metric === "completionRate" ||
      metric === "ambulanceCompleted"
      ? Math.max(...values)
      : Math.min(...values);
  });
  return (
    <div className="results-table-scroll">
      <table className="results-table">
        <caption>{title} · mean and 95% bootstrap interval</caption>
        <thead>
          <tr>
            <th scope="col">Controller</th>
            {metrics.map((metric) => (
              <th key={metric} scope="col">
                {metricLabels[metric].label}
                {metricLabels[metric].unit && <small>{metricLabels[metric].unit}</small>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {controllers.map((controller) => (
            <tr key={controller}>
              <th scope="row">{controllerLabel(controller)}</th>
              {metrics.map((metric, index) => {
                const row = rows.find(
                  (cell) => cell.controller === controller && cell.metric === metric,
                );
                if (!row)
                  return (
                    <td key={metric} title="This run had no value for this measurement">
                      —
                    </td>
                  );
                const leading = row.mean === best[index] && controllers.length > 1;
                return (
                  <td key={metric} className={leading ? "results-best" : undefined}>
                    <strong>{formatMetric(metric, row.mean)}</strong>
                    <small>
                      {formatMetric(metric, row.ciLow)} – {formatMetric(metric, row.ciHigh)}
                    </small>
                    {row.scenario === "oversaturated" && (
                      <small>Median {formatMetric(metric, row.median)}</small>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Engineering({ measurements }: { measurements: EngineeringReport }) {
  const { hardware, simulator, policyMicroseconds, determinism, rendering, load, tests } =
    measurements;
  return (
    <section className="results-panel" aria-labelledby="engineering-heading">
      <div className="results-section-heading">
        <div>
          <h2 id="engineering-heading">Engineering measurements</h2>
          <p>
            {[hardware.cpu, hardware.gpu, hardware.os, hardware.runtime]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
      <dl className="engineering-grid">
        {simulator?.map(({ vehicles, realtime, meanActive }) => (
          <div key={vehicles}>
            <dt>
              Simulation · ~{Math.round(meanActive ?? vehicles).toLocaleString("en-IN")} vehicles
            </dt>
            <dd>{realtime.toFixed(1)}× real time</dd>
          </div>
        ))}
        {policyMicroseconds !== undefined && (
          <div>
            <dt>Policy inference</dt>
            <dd>{policyMicroseconds.toFixed(2)} µs per decision</dd>
          </div>
        )}
        {determinism &&
          Object.entries(determinism).map(([engine, hash]) => (
            <div key={engine}>
              <dt>{engine} · 10,000 ticks</dt>
              <dd>
                <code>{hash.toString(16).padStart(8, "0")}</code>
              </dd>
            </div>
          ))}
        {rendering?.map(({ tier, medianFps, onePercentLowFps, gpu }) => (
          <div key={tier}>
            <dt>
              {tier} quality{gpu ? ` · ${rendererName(gpu)}` : ""}
            </dt>
            <dd>
              {medianFps.toFixed(1)} fps median · {onePercentLowFps.toFixed(1)} fps 1% low
            </dd>
          </div>
        ))}
        {load && (
          <div>
            <dt>Cold localhost load</dt>
            <dd>
              {(load.transferBytes / 1_024).toFixed(1)} KiB ·{" "}
              {(load.interactiveMs / 1_000).toFixed(2)} s to interactive
            </dd>
          </div>
        )}
        {load?.initialJavaScriptGzipBytes !== undefined && (
          <div>
            <dt>Initial JavaScript</dt>
            <dd>{(load.initialJavaScriptGzipBytes / 1_000).toFixed(1)} kB compressed</dd>
          </div>
        )}
        {tests && (
          <div>
            <dt>Tests</dt>
            <dd>
              {tests.passed} passed · {tests.failed} failed
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

const extraSuites = [
  {
    suite: "B3",
    title: "Policy ablations",
    metrics: ["delayPerPerson", "busPassengerDelay", "carPassengerDelay"],
  },
  { suite: "B4", title: "Generalisation", metrics: mainMetricKeys },
  { suite: "B5", title: "Robustness", metrics: mainMetricKeys },
  {
    suite: "B7",
    title: "Fairness",
    metrics: ["maximumApproachWait", "p95ApproachWait", "starvationShare"],
  },
] as const;

function AdditionalResults({ benchmark }: { benchmark: BenchmarkFile }) {
  const { summary: rows, comparisons } = benchmark;
  return extraSuites.map(({ suite, title, metrics }) => {
    const groups = new Map<string, SummaryCell[]>();
    for (const row of rows.filter((entry) => entry.suite === suite)) {
      const key = [scenarioLabel(row.scenario), row.variant?.replaceAll("-", " ")]
        .filter(Boolean)
        .join(" · ");
      const group = groups.get(key);
      if (group) group.push(row);
      else groups.set(key, [row]);
    }
    if (groups.size === 0) return null;
    return (
      <details key={suite} className="results-panel results-extra">
        <summary>{title}</summary>
        {suite === "B4" && <LoadSweepChart rows={rows.filter(({ suite: id }) => id === "B4")} />}
        {[...groups].map(([key, entries]) => (
          <div key={key}>
            <ResultsTable rows={entries} metrics={metrics} title={key} />
            {suite === "B5" && entries[0]?.variant !== "clean" && (
              <ul
                className="robustness-gaps"
                aria-label="Delay per person compared to the clean run"
              >
                {comparisons
                  .filter(
                    (row) =>
                      row.suite === "B5" &&
                      row.variant === entries[0]?.variant &&
                      row.b === "clean" &&
                      row.metric === primaryMetric,
                  )
                  .map((row) => (
                    <li key={row.a}>
                      <strong>{controllerLabel(row.a)}</strong> {signedPercent(row.relDiff)} vs
                      clean ({signedPercent(row.ciLow)} to {signedPercent(row.ciHigh)})
                    </li>
                  ))}
              </ul>
            )}
          </div>
        ))}
      </details>
    );
  });
}

export function ResultsView() {
  const [benchmark, setBenchmark] = useState<BenchmarkFile>();
  const [scenario, setScenario] = useState<string>(primaryScenario);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!publishedFile) return;
    const abort = new AbortController();
    publishedFile()
      .then(async (url) => {
        const response = await fetch(url, {
          signal: abort.signal,
          cache: attempt === 0 ? "default" : "reload",
        });
        if (!response.ok) throw new Error("Published benchmark could not be loaded");
        const data = (await response.json()) as BenchmarkFile;
        if (!abort.signal.aborted) setBenchmark(data);
      })
      .catch(() => {
        if (!abort.signal.aborted) setError("Published benchmark could not be loaded. Try again.");
      });
    return () => abort.abort();
  }, [attempt]);

  if (!publishedFile)
    return (
      <div className="information-empty">
        <h2>Publication pending</h2>
        <p>
          The benchmark will appear here after the final policy is evaluated on held-out demand
          seeds.
        </p>
      </div>
    );
  if (error)
    return (
      <div className="information-empty">
        <p role="alert">{error}</p>
        <button
          type="button"
          className="control-button"
          onClick={() => {
            setError("");
            setAttempt(attempt + 1);
          }}
        >
          Retry
        </button>
      </div>
    );
  if (!benchmark)
    return (
      <div className="information-empty" role="status" aria-busy="true">
        Loading published benchmark…
      </div>
    );

  const { meta, headline, summary, engineering } = benchmark;
  const main = summary.filter(({ suite, variant }) => suite === "B1" && !variant);
  const scenarios = [...new Set(main.map((row) => row.scenario))];
  const activeScenario = scenarios.includes(scenario) ? scenario : scenarios[0];
  const emergency = summary.filter(({ suite }) => suite === "B6");
  return (
    <div className="results-content">
      <p className="results-headline">{headline}</p>
      <section className="results-panel" aria-labelledby="benchmark-comparison-heading">
        <div className="results-section-heading">
          <div>
            <h2 id="benchmark-comparison-heading">Controller comparison</h2>
            <p>Every controller sees the same demand for each held-out seed.</p>
          </div>
          {scenarios.length > 0 && (
            <label className="results-select">
              <span>Scenario</span>
              <select value={activeScenario} onChange={(event) => setScenario(event.target.value)}>
                {scenarios.map((id) => (
                  <option key={id} value={id}>
                    {scenarioLabel(id)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <ResultsTable
          rows={main.filter(({ scenario: id }) => id === activeScenario)}
          title={activeScenario ? scenarioLabel(activeScenario) : "Main benchmark"}
        />
      </section>
      {main.length > 0 && (
        <section className="results-panel" aria-label="Scenario comparison chart">
          <DelayChart rows={main} />
        </section>
      )}
      {summary.some(({ suite }) => suite === "B2") && (
        <section className="results-panel" aria-label="Lane-free effect">
          <LaneChart benchmark={benchmark} />
        </section>
      )}
      {emergency.length > 0 && (
        <section className="results-panel" aria-labelledby="emergency-heading">
          <div className="results-section-heading">
            <div>
              <h2 id="emergency-heading">Emergency response</h2>
              <p>
                Travel time is measured on completed ambulance trips. The completion count and delay
                for everyone else show the trade-off.
              </p>
            </div>
          </div>
          <ResultsTable
            rows={emergency}
            metrics={["ambulanceTravelTime", "ambulanceCompleted", "delayPerPerson"]}
            title="Morning peak with ambulances"
          />
        </section>
      )}
      <BenchmarkReproduction benchmark={benchmark} />
      <AdditionalResults benchmark={benchmark} />
      <TrainingCurveChart />
      {engineering && <Engineering measurements={engineering} />}
      <section className="results-panel" aria-labelledby="provenance-heading">
        <div className="results-section-heading">
          <div>
            <h2 id="provenance-heading">Provenance</h2>
          </div>
        </div>
        <dl className="results-provenance">
          <div>
            <dt>Source commit</dt>
            <dd>
              <a href={`${repository}/commit/${meta.gitCommit}`}>{meta.gitCommit.slice(0, 12)}</a>
            </dd>
          </div>
          <div>
            <dt>Generated</dt>
            <dd>
              {dateFormat.format(new Date(meta.createdAt))} · {meta.runtime}
            </dd>
          </div>
          <div>
            <dt>Simulated time</dt>
            <dd>{(meta.simulatedSeconds / 3_600).toFixed(1)} hours</dd>
          </div>
          <div>
            <dt>Episode</dt>
            <dd>
              {meta.warmupSeconds} s warm-up · {meta.measurementSeconds} s measured
            </dd>
          </div>
          <div className="results-seed-list">
            <dt>Held-out seeds</dt>
            <dd>{meta.seeds.join(", ")}</dd>
          </div>
          <div className="results-seed-list">
            <dt>Policy SHA-256</dt>
            <dd>
              <code>{meta.policyHash}</code>
            </dd>
          </div>
        </dl>
        <a className="information-link" href={`${repository}/blob/main/results/benchmark.json`}>
          View published benchmark JSON
        </a>
      </section>
    </div>
  );
}
