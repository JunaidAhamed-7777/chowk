import { type ControllerId, ControllerDriver, createController } from "@chowk/controllers";
import { corridor, createSim, DT, generateDemand, type Arrival, type Scenario } from "@chowk/sim";
import { requireTrainingSeed, type SeedSplit } from "./seed";

export interface Episode {
  seed: number;
  split: SeedSplit;
  scenario: Scenario;
  warmup: number;
  measured: number;
}

export interface EpisodeOutcome {
  person: number;
  vehicle: number;
  personDelay: number;
  completed: number;
  backlog: number;
  hash: number;
}

export interface Evaluation {
  episodes: readonly Episode[];
  controller: ControllerId;
  parameters?: Float32Array;
  hysteresis?: number;
  saturation?: number[];
}

export function evaluateEpisode(
  episode: Episode,
  setup: Omit<Evaluation, "episodes">,
  demand?: readonly Arrival[],
): EpisodeOutcome {
  requireTrainingSeed(episode.seed, episode.split);
  const { scenario, warmup, measured, seed } = episode;
  const startTick = Math.round(warmup / DT);
  const endTick = startTick + Math.round(measured / DT);
  const simulator = createSim({ network: corridor, scenario, seed, demand });
  const saturation = setup.saturation;
  const controller = createController(setup.controller, {
    parameters: setup.parameters,
    hysteresis: setup.hysteresis,
    saturation: saturation ? (id) => saturation[id] : undefined,
  });
  const driver = new ControllerDriver(simulator, corridor, scenario, controller);
  driver.advanceTo(startTick);
  const start = simulator.metrics();
  driver.advanceTo(endTick);
  const end = simulator.metrics();
  const emergency = end.ambulanceDelay - start.ambulanceDelay;
  const starvation = end.starvationSeconds - start.starvationSeconds;
  const people = Math.max(1, end.generatedPeople - start.generatedPeople);
  const generated = Math.max(1, end.generated - start.generated);
  const delay = end.personDelay - start.personDelay;
  return {
    person: (delay + 200 * emergency + starvation) / people,
    vehicle: (end.vehicleDelay - start.vehicleDelay + starvation) / generated,
    personDelay: delay / people,
    completed: end.completed - start.completed,
    backlog: end.backlog,
    hash: simulator.hash(),
  };
}

export class DemandCache {
  private readonly cache = new Map<string, Arrival[]>();

  forEpisode(episode: Episode): readonly Arrival[] {
    requireTrainingSeed(episode.seed, episode.split);
    const key = `${episode.seed}:${JSON.stringify(episode.scenario)}`;
    let demand = this.cache.get(key);
    if (!demand) {
      demand = generateDemand(corridor, episode.scenario, episode.seed);
      if (this.cache.size >= 32) {
        const oldest = this.cache.keys().next().value;
        if (oldest !== undefined) this.cache.delete(oldest);
      }
      this.cache.set(key, demand);
    }
    return demand;
  }
}

export function pairedFitness(
  candidate: readonly EpisodeOutcome[],
  baseline: readonly EpisodeOutcome[],
  objective: "person" | "vehicle",
): number {
  if (!candidate.length || candidate.length !== baseline.length)
    throw new RangeError("Fitness needs paired candidate and baseline episodes");
  let ratio = 0;
  for (let index = 0; index < candidate.length; index++) {
    ratio += (candidate[index][objective] + 1e-9) / (baseline[index][objective] + 1e-9);
  }
  return ratio / candidate.length;
}
