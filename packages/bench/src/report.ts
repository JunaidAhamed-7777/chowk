import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { rendererName } from "./engineering";
import { primaryMetric, primaryScenario, signedPercent } from "./headline";
import { controllerLabel, formatMetric, mainMetricKeys, metricLabels } from "./metrics";
import { compareControllers } from "./statistics";
import { equivalentIdentity, scenarioLabel, scenarioLabels } from "./suites";
import type {
  BenchmarkFile,
  BenchmarkRun,
  EngineeringReport,
  PairedComparison,
  SummaryCell,
} from "./types";

const startMarker = "<!-- results:start -->";
const endMarker = "<!-- results:end -->";

const suiteNames: Record<string, { title: string; tests: string }> = {
  B1: { title: "Main comparison", tests: "Seven traffic scenarios, five controllers" },
  B2: { title: "Lane-free effect", tests: "Mixed traffic against lane-disciplined cars" },
  B3: { title: "Policy ablations", tests: "CHOWK against variants with one design choice removed" },
  B4: {
    title: "Generalisation",
    tests: "Demand from 50% to 120%, unseen vehicle mixes, a held-out grid",
  },
  B5: {
    title: "Robustness",
    tests: "Sensor noise, frozen sensors, a blocked lane, a demand surge",
  },
  B6: { title: "Emergency response", tests: "Ambulances, with and without signal pre-emption" },
  B7: { title: "Fairness", tests: "Longest and 95th-percentile waits, starved approaches" },
};
const baselines = ["mp-area", "mp-count", "actuated", "webster"] as const;
const higherIsBetter = new Set([
  "throughputPeoplePerHour",
  "completionRate",
  "ambulanceCompleted",
  "completed",
]);
const scoreboardMetrics = [
  "delayPerPerson",
  "busPassengerDelay",
  "stopsPerVehicle",
  "throughputPeoplePerHour",
  "co2Kg",
  "meanTravelTime",
  "completionRate",
  "maximumApproachWait",
  "p95ApproachWait",
  "starvationShare",
];
const variantLabels: Record<string, string> = {
  clean: "Clean sensors",
  "noise-10": "10% sensor noise",
  "noise-20": "20% sensor noise",
  "noise-30": "30% sensor noise",
  "sensor-freeze": "Frozen sensors",
  block: "Blocked lane",
  surge: "Demand surge",
  "two-wheelers-70": "70% two-wheelers",
  "buses-15": "15% buses",
  "held-out-grid": "Held-out grid (never trained on)",
};
// International digit grouping: the README is read well beyond India, and by parsers.
const count = new Intl.NumberFormat("en-GB");

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
  const {
    hardware,
    simulator,
    policyMicroseconds,
    determinism,
    rendering,
    load,
    models,
    shapedLoads,
    memory,
    reproduction,
    tests,
  } = report;
  const lines = [
    `Measured on ${[hardware.cpu, hardware.os, hardware.runtime].filter(Boolean).join(" · ")}.`,
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
      `- Rendering measurements were ${rendering.map(({ tier, medianFps, onePercentLowFps, gpu }) => `${medianFps.toFixed(1)} fps median and ${onePercentLowFps.toFixed(1)} fps 1% low on ${tier}${gpu ? ` (${rendererName(gpu)})` : ""}`).join(", ")}.`,
    );
  if (load)
    lines.push(
      `- A cold localhost load transferred ${(load.transferBytes / 1_024).toFixed(1)} KiB and became interactive in ${(load.interactiveMs / 1_000).toFixed(2)} s.`,
    );
  if (load?.initialJavaScriptGzipBytes !== undefined)
    lines.push(
      `- Initial JavaScript was ${(load.initialJavaScriptGzipBytes / 1_000).toFixed(1)} kB compressed.`,
    );
  if (models)
    lines.push(
      `- The ${models.count} delivered GLB models totalled ${(models.bytes / 1_024).toFixed(1)} KiB.`,
    );
  for (const {
    label,
    downloadMbps,
    latencyMs,
    posterMs,
    interactiveMs,
    samples,
    transferBytes,
  } of shapedLoads ?? []) {
    const transfer =
      transferBytes === undefined
        ? ""
        : ` and transferred ${(transferBytes / 1_024).toFixed(1)} KiB`;
    lines.push(
      `- On ${label} (${downloadMbps} Mbps down, ${latencyMs} ms latency), the poster painted in ${(posterMs / 1_000).toFixed(2)} s and Live became interactive in ${(interactiveMs / 1_000).toFixed(2)} s${transfer}. Medians from ${samples} fresh Chrome contexts.`,
    );
  }
  if (memory)
    lines.push(
      `- During a ${memory.minutes}-minute Live soak, sampled post-GC renderer V8 heap went from ${(memory.firstBytes / 1_048_576).toFixed(2)} to ${(memory.lastBytes / 1_048_576).toFixed(2)} MiB, with ${(memory.plateauRangeBytes / 1_048_576).toFixed(2)} MiB spread on the plateau and ${memory.workers} dedicated workers.`,
    );
  for (const { engine, environment, wallSeconds, episodes } of reproduction ?? []) {
    lines.push(
      `- ${engine}${environment ? ` (${environment})` : ""} reproduced all ${episodes} benchmark episodes exactly in ${wallSeconds.toFixed(2)} s.`,
    );
  }
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

/** Conditions in the order the suites define them: the demand sweep rising, then the rest. */
function variantOrder(variants: Iterable<string>): string[] {
  const named = Object.keys(variantLabels);
  const rank = (variant: string) => {
    const load = /^load-([\d.]+)$/.exec(variant);
    if (load) return Number(load[1]);
    const index = named.indexOf(variant);
    return 100 + (index < 0 ? named.length : index);
  };
  return [...new Set(variants)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

function variantLabel(variant: string): string {
  const load = /^load-([\d.]+)$/.exec(variant);
  if (load) return `Demand at ${Math.round(Number(load[1]) * 100)}%`;
  return variantLabels[variant] ?? variant.replaceAll("-", " ");
}

type Outcome = "better" | "even" | "worse";
const marks: Record<Outcome, string> = { better: "✅", even: "➖", worse: "❌" };

function outcome(row: PairedComparison): Outcome {
  if (!row.clear) return "even";
  return higherIsBetter.has(row.metric) === row.relDiff > 0 ? "better" : "worse";
}

function comparisonCell(row: PairedComparison | undefined): string {
  if (!row) return "—";
  return `${signedPercent(row.relDiff)} [${signedPercent(row.ciLow)}, ${signedPercent(row.ciHigh)}] ${marks[outcome(row)]}`;
}

function tally(rows: readonly PairedComparison[]): string {
  if (rows.length === 0) return "—";
  const totals: Record<Outcome, number> = { better: 0, even: 0, worse: 0 };
  for (const row of rows) totals[outcome(row)]++;
  return `✅ ${totals.better} · ➖ ${totals.even} · ❌ ${totals.worse}`;
}

/**
 * A traffic condition is a distinct demand, event plan and network. Suites that reuse B1's runs
 * (B2, B7 and the clean B5 case) add no new conditions, so nothing is counted twice.
 */
function conditionKey(row: {
  suite: string;
  scenario: string;
  variant?: string;
  network: string;
}): string {
  const events = row.suite === "B6" ? "ambulances" : "";
  return [
    row.scenario,
    row.variant === "clean" ? "" : (row.variant ?? ""),
    row.network,
    events,
  ].join("|");
}

function distinctComparisons(rows: readonly PairedComparison[]): PairedComparison[] {
  const seen = new Map<string, PairedComparison>();
  for (const row of rows) {
    const key = `${conditionKey(row)}|${row.a}|${row.b}|${row.metric}`;
    if (!seen.has(key)) seen.set(key, row);
  }
  return [...seen.values()];
}

/** Runs that the CLI shares between suites were simulated once; count them once. */
function distinctEpisodes(runs: readonly BenchmarkRun[]): BenchmarkRun[] {
  const seen = new Map<string, BenchmarkRun>();
  for (const run of runs) {
    const { suite, scenario, network, controller, seed, variant } = equivalentIdentity(run);
    const key = [suite, scenario, network, controller, seed, variant ?? ""].join("|");
    if (!seen.has(key)) seen.set(key, run);
  }
  return [...seen.values()];
}

function glance(benchmark: BenchmarkFile): string | undefined {
  const { runs, comparisons, meta } = benchmark;
  if (runs.length === 0) return undefined;
  const episodes = distinctEpisodes(runs);
  const vehicles = episodes.reduce((sum, run) => sum + (run.metrics.generated ?? 0), 0);
  const people = episodes.reduce((sum, run) => sum + (run.metrics.generatedPeople ?? 0), 0);
  const suites = [...new Set(runs.map(({ suite }) => suite))].sort();
  const seeds = [...new Set(runs.map(({ seed }) => seed))].sort((a, b) => a - b);
  const rows: [string, string][] = [
    ["Simulated episodes", count.format(episodes.length)],
    ["Simulated traffic", `${count.format(Math.round(meta.simulatedSeconds / 3_600))} hours`],
  ];
  if (vehicles > 0) rows.push(["Vehicles entering the measured windows", count.format(vehicles)]);
  if (people > 0) rows.push(["People in those vehicles", count.format(Math.round(people))]);
  rows.push(
    ["Benchmark suites", `${suites.length} (${suites.join(", ")})`],
    ["Distinct traffic conditions", count.format(new Set(runs.map(conditionKey)).size)],
    ["Controllers compared", count.format(new Set(runs.map(({ controller }) => controller)).size)],
    [
      "Held-out test seeds per condition",
      `${seeds.length} (${count.format(seeds[0])}–${count.format(seeds[seeds.length - 1])}, never used in training or checkpoint choice)`,
    ],
    [
      "Paired comparisons, each with a 95% bootstrap interval",
      count.format(distinctComparisons(comparisons).length),
    ],
  );
  const engines = Object.entries(benchmark.engineering?.determinism ?? {});
  if (engines.length > 1 && new Set(engines.map(([, hash]) => hash)).size === 1)
    rows.push([
      "Engines reaching the identical simulation state",
      `${engines.length} (${engines.map(([engine]) => engine).join(", ")})`,
    ]);
  return [
    "| Benchmark scale | |",
    "|---|---:|",
    ...rows.map(([label, value]) => `| ${label} | ${value} |`),
  ].join("\n");
}

function versusTable(
  rows: readonly PairedComparison[],
  keys: readonly string[],
  label: (key: string) => string,
  pick: (row: PairedComparison) => string,
  opponents: readonly string[],
  heading: string,
): string {
  return [
    `| ${heading} | ${opponents.map((id) => `vs ${controllerLabel(id)}`).join(" | ")} |`,
    `|---|${opponents.map(() => "---:").join("|")}|`,
    ...keys.map(
      (key) =>
        `| ${label(key)} | ${opponents
          .map((id) => comparisonCell(rows.find((row) => pick(row) === key && row.b === id)))
          .join(" | ")} |`,
    ),
  ].join("\n");
}

const scenarioRank = Object.keys(scenarioLabels);

/** Scenarios in the order the app lists them, morning peak first; unknown ones last. */
function scenarioOrder(scenarios: Iterable<string>): string[] {
  const rank = (id: string) => {
    const index = scenarioRank.indexOf(id);
    return index < 0 ? scenarioRank.length : index;
  };
  return [...new Set(scenarios)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

function scenarioMatrix(benchmark: BenchmarkFile): string | undefined {
  const rows = benchmark.comparisons.filter(
    ({ suite, a, metric, variant }) =>
      suite === "B1" && a === "chowk" && metric === primaryMetric && !variant,
  );
  if (rows.length === 0) return undefined;
  return versusTable(
    rows,
    scenarioOrder(rows.map(({ scenario }) => scenario)),
    scenarioLabel,
    (row) => row.scenario,
    baselines,
    "Scenario",
  );
}

function scoreboard(benchmark: BenchmarkFile): string | undefined {
  const rows = distinctComparisons(
    benchmark.comparisons.filter(
      ({ a, b }) => a === "chowk" && (baselines as readonly string[]).includes(b),
    ),
  );
  const metrics = scoreboardMetrics.filter((metric) => rows.some((row) => row.metric === metric));
  if (metrics.length === 0) return undefined;
  return [
    `| Metric | ${baselines.map((id) => `vs ${controllerLabel(id)}`).join(" | ")} |`,
    `|---|${baselines.map(() => ":---:").join("|")}|`,
    ...metrics.map((metric) => {
      const name = metricLabels[metric]?.label ?? metric;
      const direction = higherIsBetter.has(metric) ? "higher is better" : "lower is better";
      return `| ${name} (${direction}) | ${baselines
        .map((id) => tally(rows.filter((row) => row.metric === metric && row.b === id)))
        .join(" | ")} |`;
    }),
  ].join("\n");
}

function suiteIndex(benchmark: BenchmarkFile): string | undefined {
  const suites = [...new Set(benchmark.runs.map(({ suite }) => suite))].sort();
  if (suites.length === 0) return undefined;
  return [
    "| Suite | Name | What it tests | Conditions | Controllers | Episodes | CHOWK vs area max-pressure, delay per person |",
    "|---|---|---|---:|---:|---:|:---:|",
    ...suites.map((suite) => {
      const runs = benchmark.runs.filter((run) => run.suite === suite);
      const versusArea = benchmark.comparisons.filter(
        (row) =>
          row.suite === suite &&
          row.a === "chowk" &&
          row.b === "mp-area" &&
          row.metric === primaryMetric,
      );
      const name = suiteNames[suite];
      return `| ${suite} | ${name?.title ?? suite} | ${name?.tests ?? ""} | ${new Set(runs.map((run) => `${run.scenario}|${run.variant ?? ""}|${run.network}`)).size} | ${new Set(runs.map(({ controller }) => controller)).size} | ${count.format(runs.length)} | ${tally(versusArea)} |`;
    }),
  ].join("\n");
}

function suiteDetails(benchmark: BenchmarkFile): string[] {
  const { comparisons, summary } = benchmark;
  const sections: string[] = [];
  const details = (suite: string, body: string[]) => {
    const name = suiteNames[suite];
    sections.push(
      `<details>\n<summary><strong>${suite} · ${name?.title ?? suite}</strong>: ${name?.tests ?? ""}</summary>\n\n${body.join("\n\n")}\n\n</details>`,
    );
  };
  const chowk = (suite: string, metric: string = primaryMetric) =>
    comparisons.filter((row) => row.suite === suite && row.a === "chowk" && row.metric === metric);

  const lane = chowk("B2");
  if (lane.length > 0)
    details("B2", [
      "Delay per person, CHOWK against each baseline. The same demand runs once as Indian mixed traffic and once as lane-disciplined cars.",
      versusTable(
        lane,
        scenarioOrder(lane.map(({ scenario }) => scenario)),
        scenarioLabel,
        (row) => row.scenario,
        baselines,
        "Traffic",
      ),
    ]);

  const ablations = chowk("B3");
  if (ablations.length > 0)
    details("B3", [
      "Delay per person, CHOWK against variants that each remove one design choice. The variants come from separate, shorter training runs; every policy sees the same held-out demand and seeds.",
      versusTable(
        ablations,
        scenarioOrder(ablations.map(({ scenario }) => scenario)),
        scenarioLabel,
        (row) => row.scenario,
        [...new Set(ablations.map(({ b }) => b))],
        "Scenario",
      ),
    ]);

  for (const suite of ["B4", "B5"]) {
    const rows = chowk(suite).filter(({ b }) => (baselines as readonly string[]).includes(b));
    if (rows.length === 0) continue;
    details(suite, [
      "Delay per person, CHOWK against each baseline under each condition.",
      versusTable(
        rows,
        variantOrder(rows.map(({ variant }) => variant ?? "")),
        variantLabel,
        (row) => row.variant ?? "",
        baselines,
        "Condition",
      ),
    ]);
  }

  const emergency = summary.filter(({ suite }) => suite === "B6");
  if (emergency.length > 0) {
    const pairs = chowk("B6", "ambulanceTravelTime");
    details("B6", [
      "Ambulance travel time is measured on completed trips; the completion count and everyone else's delay show the trade-off.",
      measurementTable(emergency, ["ambulanceTravelTime", "ambulanceCompleted", "delayPerPerson"]),
      ...(pairs.length > 0
        ? [
            "Ambulance travel time, CHOWK (without pre-emption) against each alternative:",
            versusTable(
              pairs,
              scenarioOrder(pairs.map(({ scenario }) => scenario)),
              scenarioLabel,
              (row) => row.scenario,
              [...new Set(pairs.map(({ b }) => b))],
              "Scenario",
            ),
          ]
        : []),
    ]);
  }

  const fairness = chowk("B7", "p95ApproachWait");
  if (fairness.length > 0)
    details("B7", [
      "95th-percentile wait on an approach, CHOWK against each baseline. The scoreboard also counts the longest wait and the share of time with an approach waiting over 120 s.",
      versusTable(
        fairness,
        scenarioOrder(fairness.map(({ scenario }) => scenario)),
        scenarioLabel,
        (row) => row.scenario,
        baselines,
        "Scenario",
      ),
    ]);
  return sections;
}

const winMetrics = [...scoreboardMetrics, "ambulanceTravelTime"];

function conditionLabel(row: PairedComparison): string {
  const parts = [scenarioLabel(row.scenario)];
  if (row.variant && row.variant !== "clean") parts.push(variantLabel(row.variant));
  if (row.suite === "B6") parts.push("with ambulances");
  return parts.join(" · ");
}

/** How much better CHOWK did, as a positive fraction, whichever way the metric improves. */
function improvement(row: PairedComparison): number {
  return higherIsBetter.has(row.metric) ? row.relDiff : -row.relDiff;
}

/** CHOWK's clear wins over the baselines, one per condition and metric, largest first. */
function clearWins(
  benchmark: BenchmarkFile,
  opponents: readonly string[] = baselines,
): PairedComparison[] {
  return distinctComparisons(
    benchmark.comparisons.filter(
      (row) => row.a === "chowk" && opponents.includes(row.b) && winMetrics.includes(row.metric),
    ),
  )
    .filter((row) => outcome(row) === "better")
    .sort((a, b) => improvement(b) - improvement(a));
}

/** The largest win for each opponent and metric, keeping the ranking by size. */
function bestPerPair(wins: readonly PairedComparison[]): PairedComparison[] {
  const seen = new Set<string>();
  return wins.filter((row) => {
    const key = `${row.b}|${row.metric}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function winsTable(rows: readonly PairedComparison[], limit: number): string {
  return [
    "| # | Metric | Against | Condition | CHOWK's change [95% interval] |",
    "|---:|---|---|---|---:|",
    ...rows
      .slice(0, limit)
      .map(
        (row, index) =>
          `| ${index + 1} | ${metricLabels[row.metric]?.label ?? row.metric} | ${controllerLabel(row.b)} | ${conditionLabel(row)} | ${signedPercent(row.relDiff)} [${signedPercent(row.ciLow)}, ${signedPercent(row.ciHigh)}] |`,
      ),
  ].join("\n");
}

function winCounts(wins: readonly PairedComparison[]): string | undefined {
  const rows = baselines
    .map((id) => ({ id, wins: wins.filter((row) => row.b === id) }))
    .filter(({ wins }) => wins.length > 0)
    .sort((a, b) => b.wins.length - a.wins.length);
  if (rows.length === 0) return undefined;
  return [
    "| Against | Clear wins (metric × condition) | Largest |",
    "|---|---:|---|",
    ...rows.map(
      ({ id, wins }) =>
        `| ${controllerLabel(id)} | ${count.format(wins.length)} | ${signedPercent(wins[0].relDiff)} ${(metricLabels[wins[0].metric]?.label ?? wins[0].metric).toLowerCase()}, ${conditionLabel(wins[0])} |`,
    ),
  ].join("\n");
}

function engineeringTable(report?: EngineeringReport): string | undefined {
  if (!report) return undefined;
  const rows: [string, string][] = [];
  const kib = (bytes: number) => `${(bytes / 1_024).toFixed(1)} KiB`;
  if (report.simulator?.length)
    rows.push([
      "Simulator speed",
      report.simulator
        .map(
          ({ vehicles, realtime, meanActive }) =>
            `${realtime.toFixed(1)}× real time with ~${count.format(Math.round(meanActive ?? vehicles))} vehicles`,
        )
        .join("<br>"),
    ]);
  if (typeof report.policyMicroseconds === "number")
    rows.push(["Policy inference", `${report.policyMicroseconds.toFixed(2)} µs per decision`]);
  const engines = Object.entries(report.determinism ?? {});
  if (engines.length > 0) {
    const format = (hash: number) => hash.toString(16).padStart(8, "0");
    rows.push([
      "Cross-engine determinism",
      new Set(engines.map(([, hash]) => hash)).size === 1
        ? `${engines.map(([engine]) => engine).join(", ")}: identical state hash \`${format(engines[0][1])}\` after 10,000 ticks`
        : engines.map(([engine, hash]) => `${engine} \`${format(hash)}\``).join(", "),
    ]);
  }
  if (report.reproduction?.length)
    rows.push([
      "Benchmark replay in the browser",
      report.reproduction
        .map(
          ({ engine, wallSeconds, episodes }) =>
            `${engine}: ${episodes} of ${episodes} episodes exact in ${wallSeconds.toFixed(2)} s`,
        )
        .join("<br>"),
    ]);
  if (report.rendering?.length)
    rows.push([
      "Rendering",
      report.rendering
        .map(
          ({ tier, medianFps, onePercentLowFps }) =>
            `${tier}: ${medianFps.toFixed(1)} fps median, ${onePercentLowFps.toFixed(1)} fps 1% low`,
        )
        .join("<br>"),
    ]);
  if (report.load)
    rows.push([
      "Cold load on localhost",
      `${kib(report.load.transferBytes)}, interactive in ${(report.load.interactiveMs / 1_000).toFixed(2)} s`,
    ]);
  if (report.load?.initialJavaScriptGzipBytes !== undefined)
    rows.push([
      "Initial JavaScript",
      `${(report.load.initialJavaScriptGzipBytes / 1_000).toFixed(1)} kB compressed`,
    ]);
  for (const {
    label,
    downloadMbps,
    latencyMs,
    posterMs,
    interactiveMs,
    samples,
  } of report.shapedLoads ?? [])
    rows.push([
      `${label} (${downloadMbps} Mbps, ${latencyMs} ms)`,
      `poster in ${(posterMs / 1_000).toFixed(2)} s, interactive in ${(interactiveMs / 1_000).toFixed(2)} s (median of ${samples})`,
    ]);
  if (report.models)
    rows.push([
      "3D models",
      `${report.models.count} GLB files, ${kib(report.models.bytes)} in total`,
    ]);
  if (report.memory)
    rows.push([
      `${report.memory.minutes}-minute memory soak`,
      `V8 heap ${(report.memory.firstBytes / 1_048_576).toFixed(2)} → ${(report.memory.lastBytes / 1_048_576).toFixed(2)} MiB, ${report.memory.workers} workers`,
    ]);
  if (report.tests)
    rows.push([
      "Tests when measured",
      `${report.tests.passed} passed, ${report.tests.failed} failed`,
    ]);
  if (rows.length === 0) return undefined;
  const { hardware } = report;
  return [
    "| Measurement | Result |",
    "|---|---|",
    ...rows.map(([label, value]) => `| ${label} | ${value} |`),
    "",
    `Measured on ${[hardware.cpu, hardware.gpu ? rendererName(hardware.gpu) : "", hardware.os, hardware.runtime].filter(Boolean).join(" · ")}.`,
  ].join("\n");
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
    const title = suiteNames[rows[0].suite]?.title;
    report.push(
      `## ${title ? `${key} · ${title}` : key}`,
      measurementTable(rows, [...mainMetricKeys, ...extras]),
    );
  }
  const engineering = engineeringLines(benchmark.engineering);
  if (engineering.length > 0) report.push("## Engineering measurements", engineering.join("\n\n"));
  report.push(
    "## Provenance",
    `Source commit ${benchmark.meta.gitCommit}. Simulator ${benchmark.meta.simVersion}. Policy ${benchmark.meta.policyHash}.`,
    `The recorded episodes cover ${(benchmark.meta.simulatedSeconds / 3_600).toFixed(1)} simulated hours and took ${(benchmark.meta.wallSeconds / 60).toFixed(1)} minutes of benchmark wall time across runs. Raw runs and configuration are in [benchmark.json](benchmark.json).`,
  );
  writeFileSync(resolve(reportDirectory, "benchmark.md"), `${report.join("\n\n")}\n`);

  const chart = laneChart(benchmark);
  if (chart) writeFileSync(resolve(reportDirectory, "lane-free.svg"), chart);
  const mainRows = benchmark.summary.filter(
    ({ suite, scenario, variant }) => suite === "B1" && scenario === primaryScenario && !variant,
  );
  const results = [startMarker, "## Benchmark results", `> **${benchmark.headline}**`];
  const scale = glance(benchmark);
  if (scale) results.push(scale);
  const wins = clearWins(benchmark);
  if (wins.length > 0)
    results.push(
      "### Biggest wins",
      "CHOWK's largest improvement on each metric against each baseline, on held-out seeds, largest first. Each is a paired comparison whose 95% bootstrap interval lies entirely in CHOWK's favour.",
      winsTable(bestPerPair(wins), 15),
    );
  const areaWins = clearWins(benchmark, ["mp-area"]);
  if (areaWins.length > 0)
    results.push(
      `### Biggest wins against ${controllerLabel("mp-area").toLowerCase()}, the strongest baseline`,
      `The largest win on each metric, from ${count.format(areaWins.length)} clear wins in all, largest first.`,
      winsTable(bestPerPair(areaWins), 12),
    );
  const counts = winCounts(wins);
  if (counts)
    results.push(
      "### Clear wins against each baseline",
      "Each traffic condition and metric counts once across suites.",
      counts,
    );
  const measured = engineeringTable(benchmark.engineering);
  if (measured) results.push("### Engineering measurements", measured);

  const complete: string[] = [];
  const matrix = scenarioMatrix(benchmark);
  if (matrix)
    complete.push(
      "#### Delay per person: CHOWK against every baseline, in every scenario",
      "Each cell pairs the two controllers on the same held-out seeds: the mean relative difference in delay per person and its 95% paired bootstrap interval. ✅ CHOWK clearly lower (the interval excludes zero) · ➖ no clear difference · ❌ CHOWK clearly higher.",
      matrix,
    );
  const board = scoreboard(benchmark);
  if (board)
    complete.push(
      "#### Scoreboard: every metric, every distinct traffic condition",
      "The number of traffic conditions in which CHOWK came out clearly better, with no clear difference, or clearly worse than each baseline. Each condition counts once across suites. Intervals are per comparison and not adjusted for multiple comparisons.",
      board,
    );
  if (mainRows.length > 0)
    complete.push(
      `#### ${scenarioLabel(primaryScenario)}, every controller`,
      "Mean [95% bootstrap interval] over the held-out seeds.",
      measurementTable(mainRows, mainMetricKeys),
    );
  if (chart)
    complete.push(
      "![Paired delay differences for mixed traffic and lane-disciplined cars](results/lane-free.svg)",
    );
  const index = suiteIndex(benchmark);
  if (index) complete.push("#### Every suite", index, ...suiteDetails(benchmark));
  if (complete.length > 0)
    results.push(
      `<details>\n<summary><strong>Complete results</strong>: every scenario, metric and suite, including ties and the conditions where a baseline does better</summary>\n\n${complete.join("\n\n")}\n\n</details>`,
    );
  results.push(
    "All values are simulation results. [Full benchmark and provenance](results/benchmark.md) · [Raw runs, summaries and comparisons as JSON](results/benchmark.json)",
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
