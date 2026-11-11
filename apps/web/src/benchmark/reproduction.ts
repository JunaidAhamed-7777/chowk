import type { BenchmarkRun, EpisodeOptions, RunIdentity } from "@chowk/bench";

export interface ReproductionRequest {
  index: number;
  identity: RunIdentity;
  options: EpisodeOptions;
}

export type ReproductionResponse =
  | { index: number; run: BenchmarkRun }
  | { index: number; error: string };
