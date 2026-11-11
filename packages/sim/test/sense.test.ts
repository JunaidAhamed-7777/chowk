import { describe, expect, it } from "vitest";
import { corridor } from "../src/corridor";
import { Sensing } from "../src/sense";
import { SignalBank } from "../src/signals";
import { type VehicleSpawn, VehicleStore } from "../src/vehicles";

const junction = corridor.junctions[0];
const approach = corridor.links[junction.approaches[0]];
const base: VehicleSpawn = {
  link: approach.id,
  s: 242,
  strip: 0,
  lat: 0,
  v: 0.5,
  cls: 2,
  route: 0,
  v0: 10,
  occ: 1.6,
  tEnter: 0,
};

function fixture(): { vehicles: VehicleStore; signals: SignalBank } {
  const vehicles = new VehicleStore(corridor.links.length + corridor.connectors.length, 8);
  const signals = new SignalBank(corridor.junctions);
  const car = vehicles.add(base);
  const bus = vehicles.add({ ...base, cls: 4, v: 0, occ: 40, s: 160 });
  vehicles.wait[car] = 2;
  vehicles.wait[bus] = 8;
  vehicles.add({ ...base, cls: 0, v: 3, occ: 1.3, s: 200 });
  vehicles.add({ ...base, cls: 5, v: 4, occ: 0, s: 45 });
  vehicles.add({ ...base, link: 1, s: 61, v: 3 });
  vehicles.add({ ...base, cls: 4, occ: 40, link: 4, s: 50, v: 4 });
  return { vehicles, signals };
}

describe("Sensing", () => {
  it("matches hand-counted occupancy, wait, and downstream spillback", () => {
    const { vehicles, signals } = fixture();
    const sensing = new Sensing(corridor, vehicles, signals);
    const reading = sensing.read(junction.id, 0);
    expect(reading).toMatchObject({ phase: 0, state: "green", elapsed: 0 });
    const result = reading.approaches[0];
    const width = approach.strips * corridor.stripWidth;
    expect(result.areaNear).toBeCloseTo((2 * 1.7) / (60 * width), 10);
    expect(result.areaMid).toBeCloseTo((2.2 * 1.7 + 10 * 2.5 + 1.9 * 0.7) / (90 * width), 10);
    expect(result.areaFar).toBeCloseTo((2.5 + 5.5 * 2) / (150 * width), 10);
    expect(result.stoppedArea).toBeCloseTo((4.2 * 1.7 + 10 * 2.5) / (150 * width), 10);
    expect(result).toMatchObject({
      count: 3,
      countNear: 1,
      countMid: 2,
      countFar: 1,
      stoppedCount: 2,
      waitMax: 8,
      emergency: 1,
    });
    expect(result.people).toBeCloseTo(42.9, 10);

    const firstArea = (3.2 * 1.7) / (60 * corridor.links[1].strips * corridor.stripWidth);
    const secondArea = (11 * 2.5) / (60 * corridor.links[4].strips * corridor.stripWidth);
    expect(result.exits.map(({ link, count }) => [link, count])).toEqual([
      [1, 0],
      [4, 1],
      [15, 0],
    ]);
    expect(result.exits[0].area).toBeCloseTo(firstArea, 10);
    expect(result.exits[1].area).toBeCloseTo(secondArea, 10);
    expect(result.outArea).toBeCloseTo((firstArea + secondArea) / 3, 10);
  });

  it("normalizes truncated zones to the road area actually present", () => {
    const signals = new SignalBank(corridor.junctions);
    const links = corridor.links.slice();
    links[approach.id] = { ...approach, length: 40 };
    const shortRoad = new VehicleStore(corridor.links.length, 1);
    shortRoad.add({ ...base, s: 2 });
    const reading = new Sensing({ ...corridor, links }, shortRoad, signals).read(junction.id, 0);
    expect(reading.approaches[0]).toMatchObject({ count: 1, areaMid: 0, areaFar: 0 });
    const width = approach.strips * corridor.stripWidth;
    expect(reading.approaches[0].areaNear).toBeCloseTo((2 * 1.7) / (40 * width), 10);
  });

  it("keeps noisy readings reproducible across read orders and fully drops a missing feed", () => {
    const { vehicles, signals } = fixture();
    const sensing = new Sensing(corridor, vehicles, signals, { seed: 500_000, noise: 0.2 });
    const reading = sensing.read(0, 40);
    sensing.read(1, 40);
    expect(sensing.read(0, 40)).toEqual(reading);
    expect(sensing.copy(vehicles, signals).read(0, 40)).toEqual(reading);
    expect(sensing.read(0, 41)).not.toEqual(reading);
    expect(reading.approaches[0].emergency).toBe(1);

    const dropout = new Sensing(corridor, vehicles, signals, { seed: 500_000, dropout: 1 });
    const unavailable = dropout.read(0, 40);
    expect(unavailable).toMatchObject({ phase: 0, state: "green", elapsed: 0 });
    expect(unavailable.approaches[0]).toEqual({
      areaNear: 0,
      areaMid: 0,
      areaFar: 0,
      stoppedArea: 0,
      count: 0,
      countNear: 0,
      countMid: 0,
      countFar: 0,
      stoppedCount: 0,
      people: 0,
      waitMax: 0,
      emergency: 0,
      outArea: 0,
      exits: [
        { link: 1, area: 0, count: 0 },
        { link: 4, area: 0, count: 0 },
        { link: 15, area: 0, count: 0 },
      ],
    });
  });
});
