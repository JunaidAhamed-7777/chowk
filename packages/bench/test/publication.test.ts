import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, it } from "vitest";
import { primaryPolicyPath, sha256, simulatorVersion, verifyBenchmark } from "../src/provenance";
import { writeReports } from "../src/report";
import { summariseRuns } from "../src/statistics";
import type { BenchmarkFile, BenchmarkRun } from "../src/types";

function withFixture(test: (root: string) => void): void {
  const temporary = realpathSync(tmpdir());
  const root = mkdtempSync(join(temporary, "chowk-publication-"));
  try {
    test(root);
  } finally {
    if (dirname(realpathSync(root)) === temporary) rmSync(root, { recursive: true, force: true });
  }
}

function write(root: string, path: string, source: string): void {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, source);
}

function fixture(root: string): BenchmarkFile {
  const weights = "fixture weights";
  write(root, primaryPolicyPath, weights);
  write(root, "packages/sim/src/core.ts", "export const state = 1;\n");
  const runs: BenchmarkRun[] = [
    {
      suite: "B1",
      scenario: "morning-peak",
      network: "corridor",
      controller: "chowk",
      seed: 500_000,
      metrics: { delayPerPerson: 43.21 },
      finalHash: 10,
    },
  ];
  const { summary, comparisons } = summariseRuns(runs);
  return {
    meta: {
      gitCommit: "fixture",
      simVersion: simulatorVersion(root),
      policyHash: sha256(Buffer.from(weights)),
      policyHashes: {},
      createdAt: "2026-11-12T00:00:00.000Z",
      runtime: "fixture runtime",
      wallSeconds: 1,
      simulatedSeconds: 1,
      warmupSeconds: 0,
      measurementSeconds: 1,
      seeds: [500_000],
    },
    runs,
    summary,
    comparisons,
    headline: "Fixture simulation result.",
  };
}

it("detects changed simulator sources and modified exported weights", () => {
  withFixture((root) => {
    const benchmark = fixture(root);
    expect(verifyBenchmark(root, benchmark)).toEqual([]);
    write(root, "packages/sim/src/core.ts", "export const state = 2;\n");
    expect(verifyBenchmark(root, benchmark)).toEqual([
      "Simulator source or calibrated scenario data changed",
    ]);
    write(root, primaryPolicyPath, "modified weights");
    expect(verifyBenchmark(root, benchmark)).toHaveLength(2);
  });
});

it("generates the benchmark report and replaces only the README results block", () => {
  withFixture((root) => {
    const benchmark = fixture(root);
    const readme = "# CHOWK\n\n<!-- results:start -->\nOld\n<!-- results:end -->\n\nAppendix\n";
    write(root, "README.md", readme);
    writeReports(root, benchmark);
    const rendered = readFileSync(join(root, "README.md"), "utf8");
    expect(rendered).toContain("Fixture simulation result.");
    expect(rendered).toContain("43.2 [43.2, 43.2]");
    expect(rendered).not.toContain("Old");
    expect(rendered.startsWith("# CHOWK\n\n<!-- results:start -->")).toBe(true);
    expect(rendered.endsWith("<!-- results:end -->\n\nAppendix\n")).toBe(true);
    writeReports(root, benchmark);
    expect(readFileSync(join(root, "README.md"), "utf8")).toBe(rendered);
    expect(readFileSync(join(root, "results/benchmark.md"), "utf8")).toContain("Provenance");
  });
});
