import { describe, expect, it } from "vitest";
import { VEHICLE_CLASSES } from "../src/constants";
import { corridor } from "../src/corridor";
import { createSim } from "../src/sim";
import { SNAPSHOT_STRIDE } from "../src/snapshots";

const route = corridor.routes[0];
const network = corridor;
const seed = 500000;

describe("simulator state API", () => {
  it("writes bumper-centred position, world heading and identity into the snapshot", () => {
    const strip = 4;
    const sim = createSim({
      network,
      seed,
      scenario: { duration: 10, sources: [] },
      demand: [{ t: 0, source: route.source, cls: 2, route: route.id, v0Factor: 1, strip }],
    });
    sim.step();
    const out = new Float32Array(SNAPSHOT_STRIDE);
    expect(sim.writeSnapshot(out)).toBe(1);
    const { dir, left, origin } = corridor.links[route.links[0]];
    const vehicle = VEHICLE_CLASSES[2];
    const center = sim.vehicles.s[0] - vehicle.length / 2;
    const fromKerb = (strip + vehicle.strips / 2) * corridor.stripWidth;
    expect(out[0]).toBeCloseTo(origin[0] + center * dir[0] - fromKerb * left[0], 4);
    expect(out[1]).toBeCloseTo(origin[1] + center * dir[1] - fromKerb * left[1], 4);
    expect([...out.subarray(2, 4)]).toEqual(dir);
    expect(out[4]).toBeCloseTo(sim.vehicles.v[0], 4);
    expect([...out.subarray(5)]).toEqual([2, 1, 0]);
    expect(() => sim.writeSnapshot(new Float32Array(7))).toThrow(/buffer/);
    expect(sim.signals()).toHaveLength(corridor.junctions.length * 2);
  });

  it("continues from a clone with the same traffic, backlog, controller state and observations", () => {
    const sim = createSim({
      network,
      seed,
      maxVehicles: 8,
      scenario: {
        duration: 300,
        sensorNoise: 0.01,
        sources: [
          {
            source: route.source,
            rates: [{ t: 0, rate: 0.5 }],
            routes: [{ route: route.id, weight: 1 }],
          },
        ],
      },
    });
    sim.step(170);
    sim.requestPhase(0, 1);
    expect(sim.metrics().backlog).toBeGreaterThan(0);
    const copy = sim.clone();
    expect(copy.hash()).toBe(sim.hash());
    expect(copy.sense(0)).toEqual(sim.sense(0));
    copy.step(170);
    expect(copy.hash()).not.toBe(sim.hash());
    sim.step(170);
    expect(copy.hash()).toBe(sim.hash());
    expect(copy.metrics()).toEqual(sim.metrics());
    const originalSnapshot = new Float32Array(8 * SNAPSHOT_STRIDE);
    const cloneSnapshot = new Float32Array(8 * SNAPSHOT_STRIDE);
    expect(copy.writeSnapshot(cloneSnapshot)).toBe(sim.writeSnapshot(originalSnapshot));
    expect(cloneSnapshot).toEqual(originalSnapshot);
  });
});
