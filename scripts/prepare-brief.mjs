// Generates docs/CHOWK-brief.pdf, a one-page brief for judges. Every result comes from
// results/benchmark.json; nothing numeric is written by hand.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = fileURLToPath(new URL("../", import.meta.url));
const benchmark = JSON.parse(readFileSync(`${root}results/benchmark.json`, "utf8"));
const demo = process.argv.includes("--demo")
  ? process.argv[process.argv.indexOf("--demo") + 1]
  : "https://chowk-seven.vercel.app/";
const repository = "https://github.com/JunaidAhamed-7777/chowk";

const labels = {
  chowk: "CHOWK",
  "mp-area": "Area max-pressure",
  "mp-count": "Count max-pressure",
  actuated: "Actuated",
  webster: "Fixed-time (Webster)",
};
const metrics = [
  ["delayPerPerson", "Delay per person (s)", 1],
  ["stopsPerVehicle", "Stops per vehicle", 2],
  ["throughputPeoplePerHour", "Throughput (people/h)", 0],
];
const cell = (controller, metric) =>
  benchmark.summary.find(
    (row) =>
      row.suite === "B1" &&
      !row.variant &&
      row.scenario === "morning-peak" &&
      row.controller === controller &&
      row.metric === metric,
  );
const rows = Object.entries(labels)
  .map(([id, label]) => {
    const values = metrics.map(([metric, , digits]) => {
      const row = cell(id, metric);
      return row
        ? `${row.mean.toFixed(digits)} <small>[${row.ciLow.toFixed(digits)}, ${row.ciHigh.toFixed(digits)}]</small>`
        : "—";
    });
    return `<tr${id === "chowk" ? ' class="ours"' : ""}><th>${label}</th>${values.map((value) => `<td>${value}</td>`).join("")}</tr>`;
  })
  .join("");
const scenarios = [
  ...new Set(
    benchmark.summary
      .filter((row) => row.suite === "B1" && !row.variant)
      .map((row) => row.scenario),
  ),
];
const lowest = scenarios.filter((scenario) => {
  const delays = benchmark.summary.filter(
    (row) =>
      row.suite === "B1" &&
      !row.variant &&
      row.scenario === scenario &&
      row.metric === "delayPerPerson",
  );
  const best = delays.reduce((a, b) => (a.mean <= b.mean ? a : b));
  return best.controller === "chowk";
}).length;
const engineering = benchmark.engineering;
const hashes = engineering?.determinism ? Object.keys(engineering.determinism) : [];

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: A4; margin: 14mm 15mm; }
body { font: 10.4pt/1.42 "Segoe UI", Inter, system-ui, sans-serif; color: #111827; margin: 0; }
h1 { font-size: 22pt; margin: 0; letter-spacing: -0.5px; }
h1 span { color: #059669; }
.lede { font-size: 12pt; margin: 2px 0 10px; color: #374151; }
h2 { font-size: 11.5pt; margin: 12px 0 4px; color: #065f46; text-transform: uppercase; letter-spacing: .6px; }
p { margin: 0 0 6px; }
ul { margin: 0 0 6px; padding-left: 16px; }
li { margin: 0 0 3px; }
.headline { padding: 8px 10px; border-left: 4px solid #059669; background: #ecfdf5; margin: 6px 0; }
table { width: 100%; border-collapse: collapse; font-size: 9.6pt; margin: 4px 0; }
th, td { padding: 3px 6px; border-bottom: 1px solid #e5e7eb; text-align: right; }
th:first-child { text-align: left; }
thead th { color: #6b7280; font-weight: 600; }
tr.ours th, tr.ours td { font-weight: 700; background: #f0fdf4; }
small { color: #6b7280; font-weight: 400; }
.links { margin-top: 10px; font-size: 9.6pt; }
a { color: #047857; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 0 18px; }
.foot { color: #6b7280; font-size: 8.6pt; margin-top: 8px; }
</style></head><body>
<h1>CHOWK<span>.</span> Traffic signals that learned lane-free Indian traffic</h1>
<p class="lede">A learned signal controller and a live 3D simulation in the browser, with a benchmark any visitor can re-run. INNOVEX 2026 · PS04 Smart Cities &amp; Sustainability.</p>
<p><strong>Live demo:</strong> <a href="${demo}">${demo}</a> &nbsp;·&nbsp; <strong>Code:</strong> <a href="${repository}">${repository}</a></p>
<h2>Result (simulation)</h2>
<p class="headline">${benchmark.headline}</p>
<table><thead><tr><th>Morning peak, ${cell("chowk", "delayPerPerson")?.seedCount ?? ""} held-out seeds</th>${metrics.map(([, label]) => `<th>${label}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>
<p>CHOWK had the lowest mean delay per person in ${lowest} of ${scenarios.length} scenarios. Means with 95% bootstrap intervals; every number is regenerated from the published runs.</p>
<div class="cols"><div>
<h2>The problem</h2>
<p>On Indian roads two-wheelers filter through gaps and buses share road width with autos, so counting vehicles misreads a queue, and a bus with forty people counts the same as a car with one.</p>
<h2>The approach</h2>
<ul>
<li><strong>Lane-free simulator</strong> in TypeScript: one deterministic package for training, benchmark and the live demo.</li>
<li><strong>Area perception, person objective:</strong> the controller sees occupied road area and minimises delay to people.</li>
<li><strong>Residual on max-pressure:</strong> a small network learns a correction to area max-pressure, trained with evolution strategies; checkpoints chosen on validation seeds only.</li>
</ul>
</div><div>
<h2>Proof you can check</h2>
<ul>
<li>Pre-registered primary endpoint, held-out seeds never used for training or tuning.</li>
<li>The Results page replays published episodes in your browser and compares every metric and final state hash${hashes.length ? `; ${hashes.join(", ")} reach the same state hash` : ""}.</li>
<li>Any comparison can be checked seed by seed; ablations, generalisation and robustness suites are published.</li>
</ul>
<h2>Honest limits</h2>
<ul>
<li>All results are simulation results on an authored corridor, not field data.</li>
<li>The turning model is conservative; driving parameters are documented assumptions.</li>
<li>A field trial would need local calibration, shadow mode and an authority-approved pilot.</li>
</ul>
</div></div>
<p class="links">Prior work: Nandakumar, Banerjee and Vanajakshi, arXiv 2509.21745; C-DAC CoSiCoSt. Method and limits: ${demo}method · ${demo}limits</p>
<p class="foot">Generated from results/benchmark.json (source commit ${benchmark.meta.gitCommit.slice(0, 7)}) by scripts/prepare-brief.mjs.</p>
</body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
  writeFileSync(`${root}docs/CHOWK-brief.pdf`, pdf);
  const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  process.stdout.write(`Wrote docs/CHOWK-brief.pdf (${pages} page${pages === 1 ? "" : "s"})\n`);
} finally {
  await browser.close();
}
