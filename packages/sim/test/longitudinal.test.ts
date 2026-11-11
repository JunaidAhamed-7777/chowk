import { describe, expect, it } from "vitest";
import { VEHICLE_CLASSES } from "../src/constants";
import { constrain, findRoadLeader, LongitudinalDynamics } from "../src/longitudinal";
import { VehicleStore } from "../src/vehicles";

const car = VEHICLE_CLASSES[2];

function spawn(vehicles: VehicleStore, s: number, v: number, strip = 0, cls = 2): number {
  return vehicles.add({
    link: 0,
    s,
    strip,
    lat: strip / 2,
    v,
    cls,
    route: 0,
    v0: car.desiredSpeed,
    occ: 1.6,
    tEnter: 0,
  });
}

describe("longitudinal dynamics", () => {
  it("reaches free-flow speed with no leader and respects the link limit", () => {
    const vehicles = new VehicleStore(1, 1);
    const slot = spawn(vehicles, car.length, 0);
    const dynamics = new LongitudinalDynamics(vehicles, 8);
    for (let tick = 0; tick < 160; tick++) {
      dynamics.updateAccelerations(0, 12);
      dynamics.integrate(0, 8);
    }
    expect(vehicles.v[slot]).toBeCloseTo(12, 4);
    expect(dynamics.backstops).toBe(0);
  });

  it("queues behind a stopped obstacle without overlapping the platoon", () => {
    const vehicles = new VehicleStore(1, 8);
    for (let index = 0; index < 8; index++) spawn(vehicles, car.length + 11 * index, 8);
    const dynamics = new LongitudinalDynamics(vehicles, 8);
    const wall = 150;
    const obstacle: Parameters<typeof dynamics.integrate>[2] = (_link, _slot, _strip, leader) => {
      constrain(leader, wall, 0);
    };
    for (let tick = 0; tick < 200; tick++) {
      dynamics.updateAccelerations(0, car.desiredSpeed, obstacle);
      dynamics.integrate(0, 8, obstacle);
      let rear = wall;
      for (let index = 0; index < vehicles.counts[0]; index++) {
        const slot = vehicles.byLink[0][index];
        expect(vehicles.s[slot]).toBeLessThanOrEqual(rear);
        rear = vehicles.s[slot] - car.length;
      }
    }
    expect(vehicles.v[vehicles.byLink[0][0]]).toBeLessThan(0.01);
    expect(vehicles.s[vehicles.byLink[0][0]]).toBeCloseTo(wall - car.standstillGap, 2);
    expect(dynamics.backstops).toBe(0);
  });

  it("chooses the nearest rear overlapping any strip rather than the closest front", () => {
    const vehicles = new VehicleStore(1, 4);
    spawn(vehicles, 30, 4, 3, 4);
    spawn(vehicles, 23, 3, 0, 2);
    spawn(vehicles, 22, 0, 6, 0);
    spawn(vehicles, 11, 3, 1, 2);
    const leader = { rear: Infinity, speed: 0 };
    findRoadLeader(vehicles, 0, 3, 1, leader);
    expect(leader).toEqual({ rear: 18.8, speed: 3 });
  });

  it("counts a last-resort overlap correction during an unavoidable hard stop", () => {
    const vehicles = new VehicleStore(1, 1);
    const slot = spawn(vehicles, 10, 10);
    const dynamics = new LongitudinalDynamics(vehicles, 8);
    const obstacle: Parameters<typeof dynamics.integrate>[2] = (_link, _slot, _strip, leader) => {
      constrain(leader, 10.5, 0);
    };
    dynamics.updateAccelerations(0, car.desiredSpeed, obstacle);
    dynamics.integrate(0, 8, obstacle);
    expect(vehicles.s[slot]).toBe(10.5);
    expect(vehicles.v[slot]).toBe(0);
    expect(dynamics.backstops).toBe(1);
  });
});
