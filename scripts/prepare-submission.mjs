import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { demo: { type: "string" }, video: { type: "string" } } });
const repository = "https://github.com/JunaidAhamed-7777/chowk";
const benchmark = JSON.parse(readFileSync("results/benchmark.json", "utf8"));
if (!benchmark.headline || !benchmark.runs?.some(({ suite }) => suite === "B1")) {
  throw new Error("Publish the held-out B1 benchmark before generating the submission text");
}

function httpsUrl(value, field) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(`${field} must be a public HTTPS URL`);
  }
  return url.href;
}

const demo = values.demo && httpsUrl(values.demo, "Demo");
const video = values.video
  ? httpsUrl(values.video, "Video")
  : `${repository}/raw/refs/heads/main/assets/demo/chowk-demo.mp4`;
const content = `# INNOVEX 2026 submission

## Title

CHOWK — Traffic signals that learned lane-free Indian traffic

## Description

${demo ? `Open the live demo at ${demo}.` : "The public demo link is pending deployment."}

On an Indian arterial, two-wheelers filter through queues, auto-rickshaws share road width with buses, and a vehicle count misses both road occupancy and the number of people waiting. CHOWK is a learned traffic-signal controller and a live simulation built around those differences.

Drag the divider to compare two controllers over the same demand. Block a lane, trigger a surge, or send an ambulance through both sides. The pressure overlay shows what the controller sees. CHOWK learns an adjustment to area-based max-pressure control using occupancy-weighted delay.

${benchmark.headline}

The Results view reruns a published subset in browser workers and compares every metric and final state hash. All results are simulation results. The Method page documents the assumptions and validation. CHOWK builds on prior work on lane-free signal control. [Nandakumar, Banerjee and Vanajakshi](https://arxiv.org/abs/2509.21745) · [C-DAC CoSiCoSt-EnV](https://cdac.in/index.aspx?id=product_details&productId=CoSiCoStEnV%28CompositeSignalControlStrategyEnhancedVersion%29)

## Technologies

TypeScript, React, three.js, React Three Fiber, WebGL 2, Web Workers, Node.js, evolution strategies, Blender, Vite, Vitest, Playwright, GitHub Actions

## Links

- [Source repository](${repository})
${demo ? `- [Live demo](${demo})\n` : ""}- [Captioned demo video](${video})
`;

mkdirSync("docs", { recursive: true });
writeFileSync("docs/SUBMISSION.md", content);
