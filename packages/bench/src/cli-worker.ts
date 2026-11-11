import { parentPort } from "node:worker_threads";
import { type EpisodeOptions, runEpisode } from "./episode";
import type { BenchmarkRun, RunIdentity } from "./types";

export interface WorkerJob {
  index: number;
  identity: RunIdentity;
  options: EpisodeOptions;
}

export type WorkerReply = { index: number; run: BenchmarkRun } | { index: number; error: string };

const port = parentPort;
if (!port) throw new Error("Benchmark episode worker requires a parent thread");
port.on("message", ({ index, identity, options }: WorkerJob) => {
  try {
    port.postMessage({ index, run: runEpisode(identity, options) } satisfies WorkerReply);
  } catch (error) {
    port.postMessage({
      index,
      error: error instanceof Error ? error.message : String(error),
    } satisfies WorkerReply);
  }
});
