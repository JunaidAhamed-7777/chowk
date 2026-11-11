import { makeScenario, type ScenarioId, trafficMixes } from "@chowk/scenarios";

export const liveSeed = 1042;
// A first trip needs time to cross the outer junctions before it reaches the
// central arterial. Warm up past that travel time so the opening shows both.
export const warmupSeconds = 240;
export const liveDuration = 3600;
export type LiveScenarioId = ScenarioId | "custom";

export interface CustomDemandValues {
  load: number;
  weights: readonly number[];
}

export const initialCustomDemand: CustomDemandValues = {
  load: 0.95,
  weights: trafficMixes.mixed.slice(0, 5).map((share) => Math.round(share * 100)),
};

export function parseCustomDemand(load: string | null, weights: string | null) {
  if (load === null || weights === null) return undefined;
  const level = Number(load);
  const mix = weights.split(",").map(Number);
  return Number.isFinite(level) &&
    level >= 0.4 &&
    level <= 1.4 &&
    mix.length === initialCustomDemand.weights.length &&
    mix.every((weight) => Number.isSafeInteger(weight) && weight >= 0 && weight <= 100) &&
    mix.some((weight) => weight > 0)
    ? { load: level, weights: mix }
    : undefined;
}

export function makeLiveScenario(
  id: LiveScenarioId = "morning-peak",
  demandScale = 1,
  custom: CustomDemandValues = initialCustomDemand,
) {
  const scenario =
    id === "custom"
      ? makeScenario("morning-peak", {
          duration: liveDuration,
          load: custom.load,
          mix: [...custom.weights, 0],
        })
      : makeScenario(id, { duration: liveDuration });
  if (demandScale === 1) return scenario;
  return {
    ...scenario,
    load: scenario.load * demandScale,
    sources: scenario.sources.map((source) => ({
      ...source,
      rates: source.rates.map(({ t, rate }) => ({ t, rate: rate * demandScale })),
    })),
  };
}
