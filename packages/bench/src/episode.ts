import {
  type ControllerId,
  ControllerDriver,
  createController,
  type PolicyWeights,
} from "@chowk/controllers";
import { saturationFor } from "@chowk/scenarios";
import { createSim, DT } from "@chowk/sim";
import { windowMetrics } from "./metrics";
import { percentile } from "./statistics";
import { episodeCase, measurementSeconds, policyFor, warmupSeconds } from "./suites";
import type { BenchmarkRun, RunIdentity } from "./types";

export interface EpisodeOptions {
  warmup?: number;
  measurement?: number;
  policy?: PolicyWeights;
}

export function runEpisode(identity: RunIdentity, options: EpisodeOptions = {}): BenchmarkRun {
  const warmup = options.warmup ?? warmupSeconds;
  const measurement = options.measurement ?? measurementSeconds;
  const warmTicks = warmup / DT;
  const measurementTicks = measurement / DT;
  if (
    !Number.isSafeInteger(warmTicks) ||
    warmTicks < 0 ||
    !Number.isSafeInteger(measurementTicks) ||
    measurementTicks <= 0
  ) {
    throw new RangeError(
      "Benchmark windows must be whole simulator ticks and measurement must be positive",
    );
  }
  if (policyFor(identity.controller) && !options.policy)
    throw new Error(`Benchmark policy ${identity.controller} is missing`);
  const { network, scenario } = episodeCase(identity, warmup, measurement);
  const sim = createSim({ network, scenario, seed: identity.seed });
  const controller = createController(identity.controller as ControllerId, {
    policy: options.policy,
    saturation: (link) => saturationFor(network, scenario, link),
  });
  const driver = new ControllerDriver(sim, network, scenario, controller);
  driver.advanceTo(warmTicks);
  const before = sim.metrics();

  const approachIds = network.junctions.flatMap(({ approaches }) => approaches);
  const second = 1 / DT;
  const approachSamples = new Float64Array(
    Math.ceil(measurementTicks / second) * approachIds.length,
  );
  const { byLink, counts, wait } = sim.vehicles;
  let sampled = 0;
  let maximumApproachWait = 0;
  let maxBacklog = before.backlog;
  let after = before;
  for (let offset = 1; offset <= measurementTicks; offset++) {
    driver.advanceTo(warmTicks + offset);
    after = sim.metrics();
    maximumApproachWait = Math.max(maximumApproachWait, after.currentMaxWait);
    maxBacklog = Math.max(maxBacklog, after.backlog);
    if (offset % second !== 0 && offset !== measurementTicks) continue;
    for (const id of approachIds) {
      const list = byLink[id];
      let maximum = 0;
      for (let index = 0; index < counts[id]; index++)
        maximum = Math.max(maximum, wait[list[index]]);
      approachSamples[sampled++] = maximum;
    }
  }
  const metrics = windowMetrics(before, after);
  metrics.maxBacklog = maxBacklog;
  metrics.maximumApproachWait = maximumApproachWait;
  if (sampled > 0)
    metrics.p95ApproachWait = percentile(approachSamples.subarray(0, sampled).sort(), 0.95);
  metrics.starvationShare = (after.longWaitSeconds - before.longWaitSeconds) / measurement;
  return { ...identity, metrics, finalHash: sim.hash() };
}
