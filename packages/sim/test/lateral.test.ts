import { describe, expect, it } from "vitest";
import { DT, LANE_STRIPS, VEHICLE_CLASSES } from "../src/constants";
import { corridor } from "../src/corridor";
import type { SourceDemand } from "../src/demand";
import { SnapshotWriter } from "../src/snapshots";
import { createSim } from "../src/sim";

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

function separated(
  x: number,
  z: number,
  dx: number,
  dz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  first: (typeof VEHICLE_CLASSES)[number],
  second: (typeof VEHICLE_CLASSES)[number],
): boolean {
  const firstRadius =
    (Math.abs(x * ax + z * az) * first.length + Math.abs(x * az - z * ax) * first.width) / 2;
  const secondRadius =
    (Math.abs(x * bx + z * bz) * second.length + Math.abs(x * bz - z * bx) * second.width) / 2;
  return Math.abs(x * dx + z * dz) >= firstRadius + secondRadius - 1e-7;
}

function assertNoRectanglesOverlap(
  sim: ReturnType<typeof createSim>,
  writer: SnapshotWriter,
  positions: Float64Array,
  active: number[],
): void {
  const { vehicles } = sim;
  active.length = 0;
  for (let link = 0; link < vehicles.byLink.length; link++) {
    for (let index = 0; index < vehicles.counts[link]; index++) {
      const slot = vehicles.byLink[link][index];
      writer.position(slot, positions, 4 * slot, false);
      active.push(slot);
    }
  }
  active.sort((first, second) => positions[4 * first] - positions[4 * second]);
  for (let i = 0; i < active.length; i++) {
    const a = active[i];
    for (let j = i + 1; j < active.length; j++) {
      const b = active[j];
      const dx = positions[4 * b] - positions[4 * a];
      if (dx >= 12) break;
      const dz = positions[4 * b + 1] - positions[4 * a + 1];
      if (Math.abs(dz) >= 12) continue;
      const ax = positions[4 * a + 2];
      const az = positions[4 * a + 3];
      const bx = positions[4 * b + 2];
      const bz = positions[4 * b + 3];
      const first = VEHICLE_CLASSES[vehicles.cls[a]];
      const second = VEHICLE_CLASSES[vehicles.cls[b]];
      if (
        !separated(ax, az, dx, dz, ax, az, bx, bz, first, second) &&
        !separated(az, -ax, dx, dz, ax, az, bx, bz, first, second) &&
        !separated(bx, bz, dx, dz, ax, az, bx, bz, first, second) &&
        !separated(bz, -bx, dx, dz, ax, az, bx, bz, first, second)
      ) {
        throw new Error(
          `Overlap at ${sim.time}s: ${vehicles.id[a]}/${vehicles.link[a]}/${vehicles.cls[a]} s=${vehicles.s[a]} strip=${vehicles.strip[a]}, ${vehicles.id[b]}/${vehicles.link[b]}/${vehicles.cls[b]} s=${vehicles.s[b]} strip=${vehicles.strip[b]}`,
        );
      }
    }
  }
}

describe("lateral traffic", () => {
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
      const writer = new SnapshotWriter(corridor, sim.vehicles, sim.junctionTraffic);
      const positions = new Float64Array(sim.vehicles.capacity * 4);
      const active: number[] = [];
      for (let tick = 0; tick < (duration + 3_000) / DT; tick++) {
        rotatePhases(sim, tick);
        sim.step();
        assertNoRectanglesOverlap(sim, writer, positions, active);
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
