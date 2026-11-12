import { describe, expect, it } from "vitest";
import { DT, VEHICLE_CLASSES } from "../src/constants";
import { corridor } from "../src/corridor";
import type { Arrival } from "../src/demand";
import { mapStrip } from "../src/junction-traffic";
import type { Route } from "../src/network";
import { createSim } from "../src/sim";

function arrival(route: Route, t: number, cls = 2, strip = 0): Arrival {
  return { t, source: route.source, cls, route: route.id, v0Factor: 1, strip };
}

function fixedTime(demand: readonly Arrival[], duration: number) {
  const sim = createSim({
    network: corridor,
    scenario: { duration, sources: [] },
    seed: 500000,
    demand,
  });
  for (let tick = 0; tick < duration / DT; tick++) {
    if (tick % 80 === 0) {
      for (const junction of corridor.junctions) {
        const next = (sim.signalBank.phase[junction.id] + 1) % junction.phases.length;
        sim.requestPhase(junction.id, next);
      }
    }
    sim.step();
    for (const junction of corridor.junctions) {
      // Movements from one approach may share the box; two approaches never may.
      const approaches = new Set<number>();
      for (const connector of corridor.connectors) {
        if (connector.junction === junction.id && sim.vehicles.counts[connector.id] > 0)
          approaches.add(connector.fromLink);
      }
      if (approaches.size > 1)
        throw new Error(`Conflicting occupancy at J${junction.id + 1}, tick ${tick}`);
    }
  }
  return sim;
}

describe("junction traversal", () => {
  it("maps the usable strip interval proportionally at a change in road width", () => {
    expect([0, 8, 16].map((strip) => mapStrip(strip, 5, 21, 11))).toEqual([0, 3, 6]);
    expect(mapStrip(0, 5, 5, 11)).toBe(3);
  });

  it("runs an arterial vehicle through all five junctions to the opposite sink", () => {
    const route = corridor.routes.find(({ source, links }) => source === 0 && links.length === 6);
    if (!route) throw new Error("Missing route through the arterial");
    const sim = fixedTime([arrival(route, 0)], 450);
    expect(sim.completed).toBe(1);
    expect(sim.vehicles.count).toBe(0);
  });

  it("serves every approach under fixed-time signals without conflicting occupancy", () => {
    const demand = corridor.sources
      .flatMap((source) => {
        const routes = corridor.routes.filter((route) => route.source === source.id);
        return routes.slice(0, 3).map((route, index) => arrival(route, 8 * index, index, index));
      })
      .sort((a, b) => a.t - b.t || a.source - b.source);
    const sim = fixedTime(demand, 550);
    expect(sim.completed).toBe(demand.length);
  });

  it("holds the stop line when a vehicle cannot clear the box into the exit strips", () => {
    const junction = corridor.junctions[0];
    const connector = corridor.connectors.find(
      (entry) => entry.fromLink === junction.approaches[0] && entry.movement === "through",
    );
    if (!connector) throw new Error("Missing north approach through movement");
    const route = corridor.routes.find(
      ({ links }) => links[0] === connector.fromLink && links[1] === connector.toLink,
    );
    if (!route) throw new Error("Missing through route");
    const sim = createSim({
      network: corridor,
      scenario: { duration: 20, sources: [] },
      seed: 500000,
      demand: [],
    });
    const car = VEHICLE_CLASSES[2];
    const placement = {
      lat: 0,
      cls: 2,
      route: route.id,
      strip: 0,
      v: 0,
      v0: car.desiredSpeed,
      occ: car.occupancy,
      tEnter: 0,
    };
    const exit = sim.vehicles.add({ ...placement, link: connector.toLink, s: car.length });
    const road = corridor.links[connector.fromLink];
    const incoming = sim.vehicles.add({ ...placement, link: road.id, s: road.length - 1.5 });
    sim.junctionTraffic.prepareAdmissions();
    const leader = { rear: Infinity, speed: 0 };
    sim.junctionTraffic.obstacle(road.id, incoming, 0, leader);
    expect(leader.rear).toBe(road.length);
    sim.vehicles.s[exit] += 30;
    sim.junctionTraffic.prepareAdmissions();
    leader.rear = Infinity;
    sim.junctionTraffic.obstacle(road.id, incoming, 0, leader);
    expect(leader.rear).toBe(Infinity);
  });
});
