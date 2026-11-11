import { corridor, type Scenario } from "@chowk/sim";

export const liveSeed = 1042;
// A first trip needs time to cross the outer junctions before it reaches the
// central arterial. Warm up past that travel time so the opening shows both.
export const warmupSeconds = 240;
export const liveDuration = 3600;

// Provisional development demand for the uncalibrated, fixed-cycle Live run.
// The benchmark will load calibrated scenarios from @chowk/scenarios.
export function makeLiveScenario(): Scenario {
  return {
    duration: liveDuration,
    sources: corridor.sources.map((source) => {
      const entry = corridor.links[source.link];
      const arterial = Math.abs(entry.dir[0]) > 0.9;
      const rate = arterial ? 0.89 : entry.strips >= 14 ? 0.54 : 0.26;
      const routes = corridor.routes
        .filter((route) => route.source === source.id)
        .map((route) => {
          const exit = corridor.links[route.links[route.links.length - 1]];
          const through = arterial && Math.abs(exit.dir[0]) > 0.9 && exit.dir[0] === entry.dir[0];
          return { route: route.id, weight: through ? 10 : 1 };
        });
      return { source: source.id, rates: [{ t: 0, rate }], routes };
    }),
  };
}
