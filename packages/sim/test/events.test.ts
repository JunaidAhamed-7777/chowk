import { describe, expect, it } from "vitest";
import type { Route, Scenario } from "../src";
import { corridor, createSim, DT, VEHICLE_CLASSES } from "../src";

const seed = 500_000;
const junction = corridor.junctions[0];
const activeApproach = junction.approaches[0];
const route = corridor.routes.find(({ links }) => links[0] === activeApproach) as Route;
const road = corridor.links[route.links[0]];
const scenario: Scenario = {
  duration: 90,
  sources: [
    {
      source: route.source,
      rates: [{ t: 0, rate: 0.5 }],
      routes: [{ route: route.id, weight: 1 }],
    },
  ],
};

function oneCar(front: number, speed: number) {
  const sim = createSim({ network: corridor, seed, scenario, demand: [] });
  const car = VEHICLE_CLASSES[2];
  const slot = sim.vehicles.add({
    link: road.id,
    cls: 2,
    route: route.id,
    s: front,
    strip: 0,
    lat: 0,
    v: speed,
    v0: car.desiredSpeed,
    occ: car.occupancy,
    tEnter: 0,
  });
  return { sim, slot };
}

describe("simulator events", () => {
  it("adds the same timed surge to two runs even with different controller requests", () => {
    const baseline = createSim({ network: corridor, seed, scenario });
    const first = baseline.clone();
    const second = baseline.clone();
    const surge = { type: "surge", source: route.source, multiplier: 3, duration: 20 } as const;
    for (const sim of [baseline, first, second]) sim.step(20);
    first.inject(surge);
    second.inject(surge);
    expect(first.metrics().generated).toBe(baseline.metrics().generated);
    const copy = first.clone();
    for (let tick = 0; tick < 300; tick++) {
      second.requestPhase(0, 1);
      for (const sim of [baseline, first, second, copy]) sim.step();
      expect(first.metrics().generated).toBe(second.metrics().generated);
      if (tick % 50 === 0) expect(first.hash()).toBe(copy.hash());
    }
    expect(first.metrics().generated).toBeGreaterThan(baseline.metrics().generated);
  });

  it("holds a vehicle behind a block until its scheduled expiry", () => {
    const { sim, slot } = oneCar(22, 6);
    sim.inject({
      type: "block",
      link: road.id,
      start: 35,
      end: 47,
      strip: 0,
      strips: road.strips,
      duration: 18,
    });
    for (let tick = 0; tick < 18 / DT; tick++) {
      sim.step();
      expect(sim.vehicles.s[slot]).toBeLessThanOrEqual(35);
    }
    expect(sim.vehicles.v[slot]).toBeLessThan(0.5);
    sim.step(50);
    expect(sim.vehicles.s[slot]).toBeGreaterThan(47);
  });

  it("queues an ambulance on its route at the next tick and accounts for backlog delay", () => {
    const sim = createSim({ network: corridor, seed, scenario, demand: [] });
    sim.inject({
      type: "block",
      link: road.id,
      start: 0,
      end: 12,
      strip: 0,
      strips: road.strips,
      duration: 1,
    });
    sim.inject({ type: "ambulance", source: route.source, route: route.id });
    expect(sim.metrics().generated).toBe(0);
    sim.step(4);
    expect(sim.metrics()).toMatchObject({
      generated: 1,
      backlog: 1,
      ambulanceDelay: 1,
      personDelay: 0,
    });
    sim.step();
    expect(sim.metrics()).toMatchObject({ generated: 1, backlog: 0, inNetwork: 1 });
    expect(sim.vehicles.cls[0]).toBe(5);
    expect(sim.vehicles.route[0]).toBe(route.id);
  });

  it("freezes only the targeted detector readings and preserves live signal state", () => {
    const { sim, slot } = oneCar(100, 4);
    const initial = sim.sense(junction.id).approaches;
    sim.inject({ type: "sensorFreeze", junction: junction.id, duration: 1 });
    sim.vehicles.s[slot] = road.length - 8;
    sim.step(4);
    expect(sim.sense(junction.id).approaches).toEqual(initial);
    expect(sim.sense(junction.id).elapsed).toBe(1);
    expect(sim.clone().hash()).toBe(sim.hash());
    sim.step();
    expect(sim.sense(junction.id).approaches).not.toEqual(initial);
  });

  it("flashes all red, serves a stopped approach, and resumes the signal cycle", () => {
    const { sim, slot } = oneCar(road.length - 1.5, 0);
    sim.inject({ type: "outage", junction: junction.id, duration: 18 });
    sim.step(7);
    expect(sim.sense(junction.id).state).toBe("allRed");
    expect(sim.vehicles.link[slot]).toBe(road.id);
    sim.step(36);
    expect(sim.sense(junction.id).state).toBe("allRed");
    expect(sim.vehicles.link[slot]).not.toBe(road.id);
    sim.step(75);
    expect(sim.sense(junction.id).state).toBe("green");
  });
});
