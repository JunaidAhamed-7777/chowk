export type SuiteId = "B1" | "B2" | "B3" | "B4" | "B5" | "B6" | "B7";

export interface RunIdentity {
  suite: SuiteId;
  scenario: string;
  network: string;
  controller: string;
  seed: number;
  variant?: string;
}

export interface BenchmarkRun extends RunIdentity {
  metrics: Record<string, number>;
  finalHash: number;
}

interface Cell {
  suite: SuiteId;
  scenario: string;
  network: string;
  variant?: string;
  metric: string;
  seedCount: number;
}

export interface SummaryCell extends Cell {
  controller: string;
  mean: number;
  ciLow: number;
  ciHigh: number;
  median: number;
}

export interface PairedComparison extends Cell {
  a: string;
  b: string;
  relDiff: number;
  ciLow: number;
  ciHigh: number;
  winRate: number;
  clear: boolean;
}

export interface EngineeringReport {
  hardware: { cpu: string; gpu?: string; os: string; runtime: string };
  simulator?: { vehicles: number; realtime: number }[];
  policyMicroseconds?: number;
  determinism?: Record<string, number>;
  rendering?: { tier: string; medianFps: number; onePercentLowFps: number }[];
  load?: { transferBytes: number; interactiveMs: number };
  tests?: { passed: number; failed: number };
}

export interface BenchmarkMeta {
  gitCommit: string;
  simVersion: string;
  policyHash: string;
  policyHashes: Record<string, string>;
  createdAt: string;
  runtime: string;
  wallSeconds: number;
  simulatedSeconds: number;
  warmupSeconds: number;
  measurementSeconds: number;
  seeds: number[];
}

export interface BenchmarkFile {
  meta: BenchmarkMeta;
  runs: BenchmarkRun[];
  summary: SummaryCell[];
  comparisons: PairedComparison[];
  headline: string;
  engineering?: EngineeringReport;
}

export function runKey(run: RunIdentity): string {
  return JSON.stringify([
    run.suite,
    run.scenario,
    run.network,
    run.variant ?? "",
    run.controller,
    run.seed,
  ]);
}

export function compareRuns(a: BenchmarkRun, b: BenchmarkRun): string[] {
  const differences: string[] = [];
  if (runKey(a) !== runKey(b)) differences.push("Run identity differs");
  if (a.finalHash !== b.finalHash) {
    differences.push(
      `State hash ${a.finalHash.toString(16)} differs from ${b.finalHash.toString(16)}`,
    );
  }
  const keys = [...new Set([...Object.keys(a.metrics), ...Object.keys(b.metrics)])].sort();
  for (const metric of keys) {
    if (a.metrics[metric] !== b.metrics[metric]) {
      differences.push(
        `${metric}: ${a.metrics[metric] ?? "missing"} vs ${b.metrics[metric] ?? "missing"}`,
      );
    }
  }
  return differences;
}
