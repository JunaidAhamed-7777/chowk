import { existsSync, readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import {
  primaryPolicyPath,
  readBenchmark,
  sha256,
  simulatorVersion,
  verifyBenchmark,
} from "../../packages/bench/src/provenance.ts";

const root = fileURLToPath(new URL("../..", import.meta.url));

function verifyPublicationText() {
  const web = resolve(root, "apps/web");
  const files = [
    resolve(root, "README.md"),
    resolve(root, "docs/SUBMISSION.md"),
    resolve(web, "index.html"),
  ];
  for (const entry of readdirSync(resolve(web, "src"), { recursive: true, withFileTypes: true })) {
    if (entry.isFile() && /\.[cm]?tsx?$/.test(entry.name)) {
      files.push(resolve(entry.parentPath, entry.name));
    }
  }
  const placeholder = /\{\{[a-z][\w .,-]*\}\}/i;
  for (const file of files) {
    if (existsSync(file) && placeholder.test(readFileSync(file, "utf8"))) {
      throw new Error(`Unfilled publication placeholder in ${relative(root, file)}`);
    }
  }
}

export default defineConfig(({ command }) => {
  if (command === "build") verifyPublicationText();
  const published = readBenchmark(root);
  const problems = published ? verifyBenchmark(root, published) : [];
  if (command === "build" && problems.length > 0) {
    const message = `Published benchmark is stale. Rerun the benchmark before building.\n${problems.join("\n")}`;
    if (process.env.ALLOW_STALE_RESULTS !== "1") throw new Error(message);
    console.warn(message);
  }
  const weights = resolve(root, primaryPolicyPath);
  // The landing briefing needs one generated sentence and five rows, not the 7 MB results file.
  const briefing = published && {
    headline: published.headline,
    measurementMinutes: published.meta.measurementSeconds / 60,
    delay: published.summary
      .filter(
        (cell) =>
          cell.suite === "B1" &&
          cell.scenario === "morning-peak" &&
          cell.metric === "delayPerPerson" &&
          !cell.variant,
      )
      .map(({ controller, mean, ciLow, ciHigh, seedCount }) => ({
        controller,
        mean,
        ciLow,
        ciHigh,
        seedCount,
      })),

    comparisons: published.comparisons
      .filter(
        (cell) =>
          cell.suite === "B1" &&
          cell.scenario === "morning-peak" &&
          cell.metric === "delayPerPerson" &&
          cell.a === "chowk" &&
          !cell.variant,
      )
      .map(({ b, relDiff, clear }) => ({ baseline: b, relDiff, clear })),
  };
  return {
    plugins: [react(), tailwindcss()],
    worker: { format: "es" },
    define: {
      __CHOWK_SIM_VERSION__: JSON.stringify(simulatorVersion(root)),
      __CHOWK_BRIEFING__: JSON.stringify(briefing ?? null),
      __CHOWK_POLICY_HASH__: JSON.stringify(
        existsSync(weights) ? sha256(readFileSync(weights)) : null,
      ),
    },
  };
});
