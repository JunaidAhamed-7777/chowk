import { describe, expect, it } from "vitest";
import { corridor } from "../src/corridor";
import { MetricAccumulator } from "../src/metrics";
import { type VehicleSpawn, VehicleStore } from "../src/vehicles";

const approach = corridor.links[corridor.junctions[0].approaches[0]];
const base: VehicleSpawn = {
  link: approach.id,
  s: 5,
  strip: 0,
  lat: 0,
  v: 5,
  cls: 2,
  route: 0,
  v0: 10,
  occ: 2,
  tEnter: 0,
};

describe("MetricAccumulator", () => {
  it("charges both waiting arrivals and active vehicles, and clips stopped area at the sensing boundary", () => {
    const vehicles = new VehicleStore(corridor.links.length, 3);
    const car = vehicles.add(base);
    vehicles.a[car] = 2;
    const bus = vehicles.add({ ...base, cls: 4, occ: 40, v: 0, s: approach.length - 145 });
    const metrics = new MetricAccumulator(corridor);

    metrics.recordTick(vehicles, {
      generated: 3,
      generatedPeople: 43.5,
      backlog: 1,
      backlogPeople: 1.5,
    });

    const totals = metrics.read();
    expect(totals).toMatchObject({
      elapsed: 0.25,
      generated: 3,
      generatedPeople: 43.5,
      completed: 0,
      inNetwork: 2,
      backlog: 1,
      maxBacklog: 1,
      backlogVehicleSeconds: 0.25,
      personDelay: 10.625,
      vehicleDelay: 0.625,
      fuelJoules: 16_625,
    });
    expect(totals.completed + totals.inNetwork + totals.backlog).toBe(totals.generated);
    expect(totals.queueAreaSeconds).toBeCloseTo(
      (0.25 * 5 * 2.5) / (150 * approach.strips * corridor.stripWidth),
      10,
    );
    expect(totals.co2Kg).toBeCloseTo((10_875 * 76.11 + 5_750 * 74.14) / 1_055_055_852.62, 10);
    expect(vehicles.delay[car]).toBe(0.125);
    expect(vehicles.delay[bus]).toBe(0.25);
  });

  it("counts full stops only after moving and includes a vehicle's final tick once", () => {
    const vehicles = new VehicleStore(corridor.links.length, 1);
    const car = vehicles.add(base);
    const metrics = new MetricAccumulator(corridor);
    const demand = { generated: 1, generatedPeople: 2, backlog: 0, backlogPeople: 0 };

    for (const speed of [0.5, 0.4, 0.1, 2, 2.5]) {
      vehicles.v[car] = speed;
      metrics.recordTick(vehicles, demand);
    }
    expect(metrics.read().stops).toBe(1);

    vehicles.v[car] = 0;
    metrics.recordExit(vehicles, car, 1.5);
    vehicles.remove(car);
    metrics.recordTick(vehicles, demand);

    expect(metrics.read()).toMatchObject({
      elapsed: 1.5,
      completed: 1,
      completedPeople: 2,
      inNetwork: 0,
      travelTime: 1.5,
      stops: 2,
    });
    expect(metrics.read().vehicleDelay).toBeCloseTo(1.3625, 10);
    expect(metrics.read().personDelay).toBeCloseTo(2.725, 10);
  });

  it("copies totals without sharing mutation and records emergency travel from network entry", () => {
    const vehicles = new VehicleStore(corridor.links.length, 1);
    const ambulance = vehicles.add({ ...base, cls: 5, occ: 0, tEnter: 0.25 });
    const metrics = new MetricAccumulator(corridor);
    const demand = { generated: 1, generatedPeople: 0, backlog: 0, backlogPeople: 0 };
    metrics.recordTick(vehicles, demand);
    const copy = metrics.copy();
    expect(copy.read()).toEqual(metrics.read());

    metrics.recordExit(vehicles, ambulance, 0.5);
    vehicles.remove(ambulance);
    metrics.recordTick(vehicles, demand);

    expect(metrics.read()).toMatchObject({
      ambulanceCompleted: 1,
      ambulanceTravelTime: 0.25,
      lastAmbulanceTravelTime: 0.25,
      personDelay: 0,
    });
    expect(copy.read()).toMatchObject({ ambulanceCompleted: 0, lastAmbulanceTravelTime: null });
  });
});
