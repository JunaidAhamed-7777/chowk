import { parentPort } from "node:worker_threads";
import { DemandCache, type EpisodeOutcome, type Evaluation, evaluateEpisode } from "./episode";

export interface WorkRequest {
  id: number;
  evaluation: Evaluation;
}
export type WorkResponse =
  | { id: number; outcomes: EpisodeOutcome[] }
  | { id: number; error: string };

const cache = new DemandCache();
if (!parentPort) throw new Error("Training evaluation requires a worker thread");
const port = parentPort;
port.on("message", ({ id, evaluation }: WorkRequest) => {
  try {
    const { episodes, ...setup } = evaluation;
    const outcomes = episodes.map((episode) =>
      evaluateEpisode(episode, setup, cache.forEpisode(episode)),
    );
    port.postMessage({ id, outcomes } satisfies WorkResponse);
  } catch (error) {
    port.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    } satisfies WorkResponse);
  }
});
