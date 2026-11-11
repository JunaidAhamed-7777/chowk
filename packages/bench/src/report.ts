import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { primaryMetric, primaryScenario, signedPercent } from "./headline";
import { controllerLabel, formatMetric, mainMetricKeys, metricLabels } from "./metrics";
import { compareControllers } from "./statistics";
import type { BenchmarkFile, EngineeringReport, SummaryCell } from "./types";

const startMarker = "<!-- results:start -->";
const endMarker = "<!-- results:end -->";

function metricCell(row: SummaryCell | undefined): string {
  if (!row) return "—";
  const median =
    row.scenario === "oversaturated" ? ` · median ${formatMetric(row.metric, row.median)}` : "";
  return `${formatMetric(row.metric, row.mean)} [${formatMetric(row.metric, row.ciLow)}, ${formatMetric(row.metric, row.ciHigh)}]${median}`;
}

function measurementTable(rows: readonly SummaryCell[], metrics: readonly string[]): string {
  const columns = metrics.map((metric) => {
    const definition = metricLabels[metric];
    return `${definition?.label ?? metric}${definition?.unit ? ` (${definition.unit})` : ""}`;
  });
  const controllers = [...new Set(rows.map(({ controller }) => controller))].sort(
    compareControllers,
  );
  return [
    `| Controller | ${columns.join(" | ")} |`,
    `|---|${columns.map(() => "---:").join("|")}|`,
    ...controllers.map((controller) => {
      const values = metrics.map((metric) =>
        metricCell(rows.find((row) => row.controller === controller && row.metric === metric)),
      );
      return `| ${controllerLabel(controller)} | ${values.join(" | ")} |`;
    }),
  ].join("\n");
}

function engineeringLines(report?: EngineeringReport): string[] {
  if (!report) return [];
  const { hardware, simulator, policyMicroseconds, determinism, rendering, load, tests } = report;
  const lines = [
    `Measured on ${[hardware.cpu, hardware.gpu, hardware.os, hardware.runtime].filter(Boolean).join(" · ")}.`,
  ];
  if (simulator?.length)
    lines.push(
      `- The simulator ran at ${simulator.map(({ vehicles, realtime, meanActive }) => `${realtime.toFixed(1)}× real time with about ${Math.round(meanActive ?? vehicles).toLocaleString("en-IN")} vehicles`).join(", ")}.`,
    );
  if (typeof policyMicroseconds === "number")
    lines.push(`- Policy inference took ${policyMicroseconds.toFixed(2)} µs per decision.`);
  if (determinism) {
    const engines = Object.entries(determinism);
    const format = (hash: number) => hash.toString(16).padStart(8, "0");
    if (engines.length > 1 && new Set(engines.map(([, hash]) => hash)).size === 1)
      lines.push(
        `- ${engines.map(([engine]) => engine).join(", ")} all reached state hash ${format(engines[0][1])} after 10,000 ticks.`,
      );
    else if (engines.length > 0)
      lines.push(
        `- State hashes after 10,000 ticks were ${engines.map(([engine, hash]) => `${engine} ${format(hash)}`).join(", ")}.`,
      );
  }
  if (rendering?.length)
    lines.push(
      `- Rendering measurements were ${rendering.map(({ tier, medianFps, onePercentLowFps }) => `${medianFps.toFixed(1)} fps median and ${onePercentLowFps.toFixed(1)} fps 1% low on ${tier}`).join(", ")}.`,
    );
  if (load)
    lines.push(
      `- A cold localhost load transferred ${(load.transferBytes / 1_024).toFixed(1)} KiB and became interactive in ${(load.interactiveMs / 1_000).toFixed(2)} s.`,
    );
  if (load?.initialJavaScriptGzipBytes !== undefined)
    lines.push(
      `- Initial JavaScript was ${(load.initialJavaScriptGzipBytes / 1_000).toFixed(1)} kB compressed.`,
    );
  if (tests) lines.push(`- ${tests.passed} tests passed and ${tests.failed} failed.`);
  return lines;
}

function laneChart(benchmark: BenchmarkFile): string | undefined {
  const cases = [
    { a: "chowk", b: "mp-area", label: "CHOWK vs area max-pressure" },
    { a: "chowk", b: "webster", label: "CHOWK vs Webster fixed-time" },
    { a: "mp-area", b: "mp-count", label: "Area vs count max-pressure" },
  ];
  const points = cases.map(({ a, b, label }) => ({
    label,
    mixed: benchmark.comparisons.find(
      (row) =>
        row.suite === "B2" &&
        row.scenario === primaryScenario &&
        row.a === a &&
        row.b === b &&
        row.metric === primaryMetric,
    ),
    lanes: benchmark.comparisons.find(
      (row) =>
        row.suite === "B2" &&
        row.scenario === "cars-only" &&
        row.a === a &&
        row.b === b &&
        row.metric === primaryMetric,
    ),
  }));
  if (!points.some(({ mixed, lanes }) => mixed && lanes)) return undefined;
  const max = Math.max(
    0.1,
    ...points.flatMap(({ mixed, lanes }) =>
      [mixed, lanes].flatMap((row) => (row ? [Math.abs(row.ciLow), Math.abs(row.ciHigh)] : [])),
    ),
  );
  const scale = (value: number) => 510 + (value / max) * 215;
  const draw = points
    .map(({ label, mixed, lanes }, index) => {
      const y = 83 + index * 59;
      const bars = [mixed, lanes].map((row, mark) => {
        if (!row) return "";
        const cy = y + mark * 17;
        const color = mark === 0 ? "#3df2b4" : "#ffc27a";
        return `<line x1="${scale(row.ciLow)}" x2="${scale(row.ciHigh)}" y1="${cy}" y2="${cy}" stroke="${color}" stroke-width="2"/><circle cx="${scale(row.relDiff)}" cy="${cy}" r="4" fill="${color}"><title>${signedPercent(row.relDiff)}</title></circle>`;
      });
      return `<text x="25" y="${y + 12}" fill="#e8edf5">${label}</text>${bars.join("")}`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 265" role="img" aria-labelledby="title description">
<title id="title">Lane-free traffic comparison</title><desc id="description">Paired relative differences in simulated delay per person, with 95% bootstrap confidence intervals. Lower delay is better.</desc>
<rect width="760" height="265" rx="12" fill="#0a0f1a"/>
<g font-family="system-ui, sans-serif" font-size="14">
<text x="25" y="32" fill="#e8edf5" font-weight="650">Relative difference in delay per person</text>
<text x="330" y="58" fill="#3df2b4">Mixed traffic</text><text x="450" y="58" fill="#ffc27a">Cars only</text><text x="550" y="58" fill="#aab5c7">95% paired intervals</text>
<line x1="510" x2="510" y1="69" y2="229" stroke="#697688" stroke-dasharray="3 4"/>${draw}
<g fill="#aab5c7" text-anchor="middle"><text x="295" y="246">${signedPercent(-max)}</text><text x="510" y="246">0%</text><text x="725" y="246">${signedPercent(max)}</text></g>
</g></svg>\n`;
}

export function writeReports(root: string, benchmark: BenchmarkFile): void {
  const reportDirectory = resolve(root, "results");
  mkdirSync(reportDirectory, { recursive: true });
  const groups = new Map<string, SummaryCell[]>();
  for (const row of benchmark.summary) {
    const key = [row.suite, row.scenario, row.variant].filter(Boolean).join(" · ");
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  const report = [
    "# CHOWK benchmark",
    benchmark.headline,
    "Values are simulation results, shown as mean [95% bootstrap confidence interval].",
  ];
  for (const [key, rows] of groups) {
    const extras = key.startsWith("B6")
      ? ["ambulanceTravelTime", "ambulanceCompleted"]
      : key.startsWith("B7")
        ? ["maximumApproachWait", "p95ApproachWait", "starvationShare"]
        : key.startsWith("B3")
          ? ["busPassengerDelay", "carPassengerDelay"]
          : [];
    report.push(`## ${key}`, measurementTable(rows, [...mainMetricKeys, ...extras]));
  }
  const engineering = engineeringLines(benchmark.engineering);
  if (engineering.length > 0) report.push("## Engineering measurements", engineering.join("\n\n"));
  report.push(
    "## Provenance",
    `Source commit ${benchmark.meta.gitCommit}. Simulator ${benchmark.meta.simVersion}. Policy ${benchmark.meta.policyHash}. Raw runs and configuration are in [benchmark.json](benchmark.json).`,
  );
  writeFileSync(resolve(reportDirectory, "benchmark.md"), `${report.join("\n\n")}\n`);

  const chart = laneChart(benchmark);
  if (chart) writeFileSync(resolve(reportDirectory, "lane-free.svg"), chart);
  const mainRows = benchmark.summary.filter(
    ({ suite, scenario, variant }) => suite === "B1" && scenario === primaryScenario && !variant,
  );
  const results = [startMarker, "## Simulation results", benchmark.headline];
  if (mainRows.length > 0) results.push(measurementTable(mainRows, mainMetricKeys));
  if (chart)
    results.push(
      "![Paired delay differences for mixed traffic and lane-disciplined cars](results/lane-free.svg)",
    );
  if (engineering.length > 0)
    results.push("### Engineering measurements", engineering.join("\n\n"));
  results.push(
    "[Full benchmark and provenance](results/benchmark.md) · [Raw runs](results/benchmark.json)",
    endMarker,
  );

  const readmePath = resolve(root, "README.md");
  const readme = readFileSync(readmePath, "utf8");
  const start = readme.indexOf(startMarker);
  const end = readme.indexOf(endMarker);
  if (start < 0 !== end < 0 || (start >= 0 && end < start))
    throw new Error("README has unpaired benchmark markers");
  const block = results.join("\n\n");
  writeFileSync(
    readmePath,
    start < 0
      ? `${readme.trimEnd()}\n\n${block}\n`
      : `${readme.slice(0, start)}${block}${readme.slice(end + endMarker.length)}`,
  );
}
