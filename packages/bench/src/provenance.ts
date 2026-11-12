import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { BenchmarkFile } from "./types";

export const benchmarkPath = "results/benchmark.json";
export const policyDirectory = "apps/web/public/policies";
export const primaryPolicyPath = `${policyDirectory}/chowk.json`;

export const versionPaths = [
  "packages/sim/src",
  "packages/sim/networks",
  "packages/controllers/src",
  "packages/scenarios/src",
  "packages/bench/src/episode.ts",
  "packages/bench/src/metrics.ts",
  "packages/bench/src/suites.ts",
  "results/calibration.json",
];

function sources(root: string, directory: string): string[] {
  return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return sources(root, path);
    return entry.isFile() && /\.(?:ts|json)$/.test(path) ? [path] : [];
  });
}

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function simulatorVersion(root: string): string {
  const paths = versionPaths
    .flatMap((path) => {
      if (!existsSync(resolve(root, path))) return [];
      return /\.(?:ts|json)$/.test(path) ? [path] : sources(root, path);
    })
    .sort();
  const hash = createHash("sha256");
  for (const path of paths) {
    const bytes = readFileSync(resolve(root, path));
    hash.update(`${path}\0${bytes.length}\0`).update(bytes);
  }
  return hash.digest("hex");
}

export function readBenchmark(root: string): BenchmarkFile | undefined {
  const path = resolve(root, benchmarkPath);
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as BenchmarkFile) : undefined;
}

export function verifyBenchmark(root: string, benchmark: BenchmarkFile): string[] {
  const problems: string[] = [];
  if (benchmark.meta.simVersion !== simulatorVersion(root))
    problems.push("Simulator source or calibrated scenario data changed");
  if (!/^[a-f0-9]{64}$/.test(benchmark.meta.policyHash))
    problems.push("Primary policy hash is missing or invalid");
  const expected = { ...benchmark.meta.policyHashes, chowk: benchmark.meta.policyHash };
  for (const [policy, hash] of Object.entries(expected)) {
    if (!/^chowk(?:-vehicle|-count|-pure|-solo)?$/.test(policy)) {
      problems.push(`Unknown benchmark policy ${policy}`);
      continue;
    }
    const path = resolve(root, policyDirectory, `${policy}.json`);
    if (!existsSync(path) || sha256(readFileSync(path)) !== hash)
      problems.push(`Exported policy ${policy} changed or is missing`);
  }
  return problems;
}
