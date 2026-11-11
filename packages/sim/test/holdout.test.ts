import { describe, expect, it } from "vitest";
import { DT } from "../src/constants";
import type { Arrival } from "../src/demand";
import { holdoutNetwork } from "../src/holdout";
import { createSim } from "../src/sim";

describe("held-out grid network", () => {
  it("has four four-arm junctions and routes between different terminal arms", () => {
    const { junctions, routes, sources } = holdoutNetwork;
    expect(junctions.map(({ phases }) => phases.length)).toEqual([4, 4, 4, 4]);
    for (const source of sources) {
      const destinations = routes.filter((route) => route.source === source.id);
      expect(new Set(destinations.map(({ sink }) => sink)).size).toBe(sources.length - 1);
      expect(destinations.every(({ sink }) => sink !== source.node + 1)).toBe(true);
    }
  });

  it("completes trips between boundary arms under fixed-time signals", () => {
    const { junctions, routes, sources } = holdoutNetwork;
    const demand: Arrival[] = sources.map((source, index) => {
      const route = routes.find((entry) => entry.source === source.id && entry.links.length >= 4);
      if (!route) throw new Error(`Missing cross-grid route for ${source.name}`);
      return {
        t: index * 5,
        source: source.id,
        cls: index % 5,
        route: route.id,
        v0Factor: 1,
        strip: 0,
      };
    });
    const sim = createSim({
      network: holdoutNetwork,
      scenario: { duration: 900, sources: [] },
      seed: 500_000,
      demand,
    });
    const slot = 25 / DT;
    for (let tick = 0; tick < 900 / DT; tick += slot) {
      for (const junction of junctions) {
        sim.requestPhase(junction.id, (tick / slot + junction.id) % junction.phases.length);
      }
      sim.step(slot);
    }
    expect(sim.metrics()).toMatchObject({
      generated: demand.length,
      completed: demand.length,
      inNetwork: 0,
      backlog: 0,
    });
  });
});
