import { describe, expect, it } from "vitest";
import { DT, LANE_STRIPS, VEHICLE_CLASSES } from "../src/constants";
import { corridor } from "../src/corridor";
import type { SourceDemand } from "../src/demand";
import { createSim } from "../src/sim";
import { PhysicalOverlapCheck } from "../tools/physical-overlap";

function moderateLoad(rate: number): SourceDemand[] {
  return corridor.sources.map(({ id }) => ({
    source: id,
    rates: [{ t: 0, rate }],
    routes: corridor.routes
      .filter(({ source }) => source === id)
      .map(({ id: route }) => ({
        route,
        weight: 1,
      })),
  }));
}

function rotatePhases(sim: ReturnType<typeof createSim>, tick: number): void {
  for (const junction of corridor.junctions) {
    if ((tick - 7 * junction.id) % 80 !== 0) continue;
    sim.requestPhase(junction.id, (sim.signalBank.phase[junction.id] + 1) % junction.phases.length);
  }
}

describe("lateral traffic", () => {
  it("detects a physical rectangle overlap in the spatial checker", () => {
    const sim = createSim({
      network: corridor,
      scenario: { duration: 20, sources: [] },
      seed: 500000,
      demand: [],
    });
    const route = corridor.routes[0];
    const spec = VEHICLE_CLASSES[2];
    const pose = {
      link: route.links[0],
      cls: 2,
      s: 40,
      v: 0,
      v0: spec.desiredSpeed,
      route: route.id,
      occ: spec.occupancy,
      tEnter: 0,
    };
    sim.vehicles.add({ ...pose, strip: 0, lat: 0 });
    const second = sim.vehicles.add({ ...pose, strip: 4, lat: 2 });
    const check = new PhysicalOverlapCheck(corridor, sim);
    expect(check.firstOverlap()).toBeUndefined();
    sim.vehicles.strip[second] = 1;
    expect(check.firstOverlap()).toBeDefined();
  });

  it("lets a two-wheeler advance past a car held by a red signal", () => {
    const sim = createSim({
      network: corridor,
      scenario: { duration: 20, sources: [] },
      seed: 500000,
      demand: [],
    });
    const route = corridor.routes.find(({ source, links }) => source === 0 && links.length === 6);
    if (!route) throw new Error("Missing arterial route");
    const road = corridor.links[route.links[0]];
    const base = { link: road.id, v: 0, route: route.id, tEnter: 0 };
    const car = sim.vehicles.add({
      ...base,
      cls: 2,
      s: road.length - 1.5,
      strip: 0,
      lat: 0,
      v0: VEHICLE_CLASSES[2].desiredSpeed,
      occ: VEHICLE_CLASSES[2].occupancy,
    });
    const bike = sim.vehicles.add({
      ...base,
      cls: 0,
      s: road.length - 18,
      strip: 3,
      lat: 1.5,
      v0: VEHICLE_CLASSES[0].desiredSpeed,
      occ: VEHICLE_CLASSES[0].occupancy,
    });
    sim.step(48);
    expect(sim.vehicles.strip[bike]).toBeGreaterThanOrEqual(4);
    expect(sim.vehicles.s[bike]).toBeGreaterThan(sim.vehicles.s[car]);
  });

  it.each([500000, 500001])(
    "keeps mixed-traffic rectangles separate and drains the corridor (seed %i)",
    (seed) => {
      const duration = 450;
      const sim = createSim({
        network: corridor,
        scenario: { duration, sources: moderateLoad(0.085) },
        seed,
      });
      const overlap = new PhysicalOverlapCheck(corridor, sim);
      for (let tick = 0; tick < (duration + 3_000) / DT; tick++) {
        rotatePhases(sim, tick);
        sim.step();
        const pair = overlap.firstOverlap();
        if (pair) throw new Error(overlap.describe(pair));
        if (sim.time > duration && sim.vehicles.count === 0) break;
      }
      expect(sim.metrics().generated).toBeGreaterThan(300);
      expect(sim.completed).toBe(sim.metrics().generated);
    },
  );

  it("restricts the lane-disciplined scenario to cars and whole-lane positions", () => {
    const duration = 240;
    const sim = createSim({
      network: corridor,
      scenario: { duration, sources: moderateLoad(0.12), laneDisciplined: true },
      seed: 500000,
    });
    for (let tick = 0; tick < duration / DT; tick++) {
      rotatePhases(sim, tick);
      sim.step();
      for (let slot = 0; slot < sim.vehicles.capacity; slot++) {
        if (sim.vehicles.link[slot] === -1) continue;
        if (sim.vehicles.cls[slot] !== 2 || sim.vehicles.strip[slot] % LANE_STRIPS !== 0) {
          throw new Error("Lane-disciplined traffic left its lane grid");
        }
      }
    }
    expect(sim.completed).toBeGreaterThan(0);
  });

  it("runs monsoon traffic with the configured reduction in desired speed", () => {
    const route = corridor.routes[0];
    const scenario = { duration: 100, sources: [] };
    const demand = [{ t: 0, source: route.source, cls: 2, route: route.id, v0Factor: 1, strip: 0 }];
    const config = { network: corridor, seed: 500000, demand };
    const dry = createSim({ ...config, scenario });
    const wet = createSim({ ...config, scenario: { ...scenario, monsoon: true } });
    dry.step(16);
    wet.step(16);
    expect(wet.vehicles.v0[0]).toBeCloseTo(0.8 * dry.vehicles.v0[0]);
    expect(wet.vehicles.s[0]).toBeLessThan(dry.vehicles.s[0]);
  });
});
