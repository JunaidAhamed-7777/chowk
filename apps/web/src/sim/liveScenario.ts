import { makeScenario, type ScenarioId } from "@chowk/scenarios";

export const liveSeed = 1042;
// A first trip needs time to cross the outer junctions before it reaches the
// central arterial. Warm up past that travel time so the opening shows both.
export const warmupSeconds = 240;
export const liveDuration = 3600;

export function makeLiveScenario(id: ScenarioId = "morning-peak", demandScale = 1) {
  const scenario = makeScenario(id, { duration: liveDuration });
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
