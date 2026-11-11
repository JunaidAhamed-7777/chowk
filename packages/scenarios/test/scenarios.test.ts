import { corridor, generateDemand, holdoutNetwork } from "@chowk/sim";
import { describe, expect, it } from "vitest";
import calibration from "../../../results/calibration.json";
import { makeScenario, saturationFor, scenarioCatalog } from "../src";

describe("calibrated traffic scenarios", () => {
  it.each(scenarioCatalog)("loads $label at its documented critical-approach ratio", ({ id }) => {
    const scenario = makeScenario(id);
    const inflow = new Float64Array(corridor.links.length);
    const junction = corridor.junctions[scenario.criticalJunction];
    for (const source of scenario.sources) {
      const nominal = Math.max(...source.rates.map(({ rate }) => rate));
      const routeWeight = source.routes.reduce((sum, { weight }) => sum + weight, 0);
      for (const { route, weight } of source.routes) {
        for (const link of corridor.routes[route].links)
          inflow[link] += (nominal * weight) / routeWeight;
      }
    }
    const phaseRatio = junction.approaches.reduce(
      (sum, link) => sum + inflow[link] / saturationFor(corridor, scenario, link),
      0,
    );
    const lost = junction.phases.length * (junction.yellow + junction.allRed);
    expect(phaseRatio / (1 - lost / 150)).toBeCloseTo(scenario.load, 12);
    expect(generateDemand(corridor, scenario, 500_000).length).toBeGreaterThan(0);
  });

  it("preserves entry splits and dry capacity for monsoon", () => {
    const morning = makeScenario("morning-peak");
    const monsoon = makeScenario("monsoon");
    expect(monsoon.monsoon).toBe(true);
    expect(monsoon.sources).toEqual(morning.sources);
    const weights = morning.sources.map(({ source, rates }) => ({
      dir: corridor.links[corridor.sources[source].link].dir[0],
      rate: rates[0].rate,
    }));
    const east = weights.filter(({ dir }) => dir > 0).reduce((sum, { rate }) => sum + rate, 0);
    const west = weights.filter(({ dir }) => dir < 0).reduce((sum, { rate }) => sum + rate, 0);
    const cross = weights.filter(({ dir }) => dir === 0).reduce((sum, { rate }) => sum + rate, 0);
    expect(east / (east + west)).toBeCloseTo(0.65, 12);
    expect(cross / (east + west + cross)).toBeCloseTo(0.3, 12);
  });

  it("builds valid demand for the held-out network without training on it", () => {
    const scenario = makeScenario("morning-peak", { network: holdoutNetwork });
    expect(generateDemand(holdoutNetwork, scenario, 500_000).length).toBeGreaterThan(0);
  });

  it("records positive discharge and area measurements across all validation seeds", () => {
    expect(calibration.rows.length).toBe(15);
    for (const row of calibration.rows) {
      expect(row.samples.map(({ seed }) => seed)).toEqual(
        Array.from({ length: 20 }, (_, i) => 500_000 + i),
      );
      expect(row.samples.every(({ vehicles, area }) => vehicles > 0 && area > 0)).toBe(true);
      const observed =
        row.samples.reduce((sum, sample) => sum + sample.vehicles, 0) /
        (row.samples.length * calibration.windowSeconds);
      expect(row.vehiclesPerSecond).toBe(observed);
    }
  });
});
