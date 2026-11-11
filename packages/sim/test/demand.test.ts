import { describe, expect, test } from "vitest";
import { VEHICLE_CLASSES } from "../src/constants";
import { corridor } from "../src/corridor";
import { type Arrival, DemandQueue, generateDemand } from "../src/demand";
import { StateHash } from "../src/hash";
import { VehicleStore } from "../src/vehicles";

const source = corridor.sources[0];
const link = corridor.links[source.link];
const route = corridor.routes.find((candidate) => candidate.source === source.id)?.id ?? -1;
const anotherRoute = corridor.routes.find((candidate) => candidate.source === 1)?.id ?? -1;
const sourceDemand = {
  source: source.id,
  rates: [
    { t: 0, rate: 0 },
    { t: 20, rate: 0 },
    { t: 40, rate: 2 },
    { t: 60, rate: 0 },
  ],
  routes: [{ route, weight: 1 }],
};

describe("Poisson demand", () => {
  test("seed and source ids determine ordered arrivals independently of profile order", () => {
    const otherDemand = {
      ...sourceDemand,
      source: 1,
      routes: [{ route: anotherRoute, weight: 1 }],
    };
    const scenario = { duration: 80, sources: [sourceDemand, otherDemand] };
    const first = generateDemand(corridor, scenario, 500_000);
    expect(first).toEqual(
      generateDemand(corridor, { ...scenario, sources: [otherDemand, sourceDemand] }, 500_000),
    );
    expect(first).not.toEqual(generateDemand(corridor, scenario, 500_001));
    expect(first.length).toBeGreaterThan(50);
    for (let index = 0; index < first.length; index++) {
      const arrival = first[index];
      const startLink = corridor.links[corridor.sources[arrival.source].link];
      expect(arrival.t).toBeGreaterThanOrEqual(first[index - 1]?.t ?? 20);
      expect(arrival.t).toBeLessThan(60);
      expect(arrival.v0Factor).toBeGreaterThanOrEqual(0.9);
      expect(arrival.v0Factor).toBeLessThan(1.1);
      expect(arrival.strip + VEHICLE_CLASSES[arrival.cls].strips).toBeLessThanOrEqual(
        startLink.strips,
      );
    }
  });

  test("integrated rates control the mean over validation seeds", () => {
    let count = 0;
    let beforePeak = 0;
    for (let seed = 500_000; seed < 500_020; seed++) {
      const arrivals = generateDemand(corridor, { duration: 80, sources: [sourceDemand] }, seed);
      count += arrivals.length;
      beforePeak += arrivals.filter(({ t }) => t < 40).length;
    }
    // Each triangle under the profile has area 20 vehicles; sample variation is expected.
    expect(Math.abs(count / 20 - 40)).toBeLessThan(5);
    expect(Math.abs(beforePeak / 20 - 20)).toBeLessThan(4);
  });

  test("rejects invalid rates and routes from a different source", () => {
    expect(() =>
      generateDemand(
        corridor,
        { duration: 80, sources: [{ ...sourceDemand, rates: [{ t: 0, rate: -1 }] }] },
        500_000,
      ),
    ).toThrow("finite and non-negative");
    expect(() =>
      generateDemand(
        corridor,
        {
          duration: 80,
          sources: [{ ...sourceDemand, routes: [{ route: anotherRoute, weight: 1 }] }],
        },
        500_000,
      ),
    ).toThrow("does not originate");
  });

  test("uses cars and lane-spaced entry strips for the lane-disciplined scenario", () => {
    const arrivals = generateDemand(
      corridor,
      { duration: 80, laneDisciplined: true, sources: [sourceDemand] },
      500_000,
    );
    expect(arrivals.length).toBeGreaterThan(0);
    for (const arrival of arrivals) {
      expect(arrival.cls).toBe(2);
      expect(arrival.strip % 7).toBe(0);
    }
  });
});

describe("demand queue", () => {
  const cls = 2;
  const arrival: Arrival = { t: 0.1, source: source.id, cls, route, v0Factor: 1, strip: 0 };
  const classSpec = VEHICLE_CLASSES[cls];
  const segmentCount = corridor.links.length + corridor.connectors.length;

  test("waits until the next tick, retries blocked entry, and conserves demand", () => {
    const queue = new DemandQueue(corridor, [arrival, arrival]);
    const vehicles = new VehicleStore(segmentCount, 1);
    queue.advance(0, vehicles);
    expect(queue.generated).toBe(0);
    queue.advance(1, vehicles);
    expect(queue.generated).toBe(2);
    expect(queue.generatedPeople).toBeCloseTo(classSpec.occupancy * 2);
    expect(queue.backlog).toBe(1);
    expect(queue.backlogPeople).toBeCloseTo(classSpec.occupancy);
    expect(vehicles.count).toBe(1);
    expect(vehicles.s[0]).toBe(classSpec.length);
    expect(vehicles.tEnter[0]).toBe(0.25);

    const clone = queue.clone();
    const originalHash = new StateHash();
    const cloneHash = new StateHash();
    queue.writeHash(originalHash);
    clone.writeHash(cloneHash);
    expect(cloneHash.digest()).toBe(originalHash.digest());

    vehicles.remove(0);
    queue.advance(2, vehicles);
    expect(queue.backlog).toBe(0);
    expect(queue.backlogPeople).toBe(0);
    expect(vehicles.count).toBe(1);
    expect(vehicles.tEnter[0]).toBe(0.5);
    expect(clone.backlog).toBe(1);
  });

  test("uses another strip if available and brakes for a close leader", () => {
    const vehicles = new VehicleStore(segmentCount);
    const queue = new DemandQueue(corridor, [arrival, arrival]);
    queue.advance(1, vehicles);
    expect(vehicles.strip[0]).toBe(0);
    expect(vehicles.strip[1]).toBe(classSpec.strips);
    vehicles.move(0, link.id, classSpec.length * 2 + classSpec.standstillGap + 0.1);
    vehicles.v[0] = 0;
    new DemandQueue(corridor, [arrival]).advance(1, vehicles);
    expect(vehicles.strip[2]).toBe(0);
    expect(vehicles.v[2]).toBeGreaterThan(0);
    expect(vehicles.v[2]).toBeLessThan(0.4);
  });
});
