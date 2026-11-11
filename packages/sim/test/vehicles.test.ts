import { describe, expect, it } from "vitest";
import { type VehicleSpawn, VehicleStore } from "../src/vehicles";

const vehicle: VehicleSpawn = {
  link: 0,
  s: 4.2,
  strip: 2,
  lat: 1,
  v: 3,
  cls: 2,
  route: 0,
  v0: 13.5,
  occ: 1.6,
  tEnter: 0,
};

function order(vehicles: VehicleStore, link: number): number[] {
  return [...vehicles.byLink[link].subarray(0, vehicles.counts[link])];
}

describe("vehicle storage", () => {
  it("sorts front to back and breaks ties using the vehicle identity", () => {
    const vehicles = new VehicleStore(2, 3);
    const first = vehicles.add(vehicle);
    const second = vehicles.add({ ...vehicle, s: 12 });
    const third = vehicles.add(vehicle);
    expect(order(vehicles, 0)).toEqual([second, first, third]);
    vehicles.s[third] = 15;
    vehicles.sort(0);
    expect(order(vehicles, 0)).toEqual([third, second, first]);
    vehicles.move(second, 1, 0.5);
    expect(order(vehicles, 0)).toEqual([third, first]);
    expect(order(vehicles, 1)).toEqual([second]);
    expect(vehicles.s[second]).toBe(0.5);
  });

  it("recycles storage with a fresh identity and resets all mutable fields", () => {
    const vehicles = new VehicleStore(1, 2);
    const first = vehicles.add(vehicle);
    const second = vehicles.add(vehicle);
    const oldId = vehicles.id[first];
    vehicles.a[first] = -3;
    vehicles.routeIdx[first] = 4;
    vehicles.delay[first] = 10;
    vehicles.stops[first] = 2;
    vehicles.lastShift[first] = 3;
    expect(vehicles.add(vehicle)).toBe(-1);
    vehicles.remove(first);
    expect(vehicles.count).toBe(1);
    expect(() => vehicles.remove(first)).toThrow(/Inactive vehicle/);
    expect(vehicles.add({ ...vehicle, v: 0 })).toBe(first);
    expect(vehicles.id[first]).toBeGreaterThan(oldId);
    expect(order(vehicles, 0)).toEqual([second, first]);
    expect(vehicles.count).toBe(2);
    expect(vehicles.moving[first]).toBe(0);
    expect([
      vehicles.a[first],
      vehicles.routeIdx[first],
      vehicles.delay[first],
      vehicles.stops[first],
      vehicles.lastShift[first],
    ]).toEqual([0, 0, 0, 0, -2]);
  });
});
