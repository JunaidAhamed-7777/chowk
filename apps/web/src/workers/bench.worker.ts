import { runEpisode } from "@chowk/bench";
import type { ReproductionRequest, ReproductionResponse } from "../benchmark/reproduction";

self.addEventListener("message", ({ data }: MessageEvent<ReproductionRequest>) => {
  try {
    const run = runEpisode(data.identity, data.options);
    self.postMessage({ index: data.index, run } satisfies ReproductionResponse);
  } catch (error) {
    self.postMessage({
      index: data.index,
      error: error instanceof Error ? error.message : String(error),
    } satisfies ReproductionResponse);
  }
});
