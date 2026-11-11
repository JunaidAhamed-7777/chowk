import { writeFileSync } from "node:fs";
import { ControllerDriver, createController, type ControllerId } from "@chowk/controllers";
import { makeScenario, saturationFor, type ScenarioId } from "@chowk/scenarios";
import calibration from "../../../results/calibration.json";
import {
  corridor,
  createSim,
  DT,
  generateDemand,
  type Network,
  Random,
  VEHICLE_CLASSES,
} from "../src";
import { PhysicalOverlapCheck } from "./physical-overlap";

const SEEDS = Array.from({ length: 20 }, (_, index) => 500_000 + index);
const roadLength = 6_000;
const detectorLength = 600;
const speedLimit = 50 / 3.6;
const oneLane: Network = {
  id: "single-lane-detector",
  stripWidth: 0.5,
  nodes: [
    { id: 0, kind: "source", x: 0, z: 0 },
    { id: 1, kind: "sink", x: roadLength, z: 0 },
  ],
  links: [
    {
      id: 0,
      from: 0,
      to: 1,
      length: roadLength,
      strips: 7,
      speedLimit,
      origin: [0, -1.75],
      dir: [1, 0],
      left: [0, -1],
    },
  ],
  connectors: [],
  junctions: [],
  routes: [{ id: 0, source: 0, sink: 1, links: [0] }],
  sources: [{ id: 0, node: 0, link: 0, name: "Detector entry" }],
};

function fundamentalDiagram() {
  const warmup = 120;
  const duration = 90;
  const low = (roadLength - detectorLength) / 2;
  const high = low + detectorLength;
  const points = [8, 15, 25, 35, 45, 60, 85, 110, 140, 170, 180].map((initialDensity) => {
    const sim = createSim({
      network: oneLane,
      scenario: { duration: warmup + duration, laneDisciplined: true, sources: [] },
      seed: SEEDS[0],
      demand: [],
      maxVehicles: 1_100,
    });
    const spacing = 1_000 / initialDensity;
    const spec = VEHICLE_CLASSES[2];
    for (let s = roadLength - 1; s >= spec.length; s -= spacing) {
      if (
        sim.vehicles.add({
          link: 0,
          s,
          strip: 0,
          lat: 0,
          v: 0,
          v0: speedLimit,
          cls: 2,
          route: 0,
          occ: spec.occupancy,
          tEnter: 0,
        }) < 0
      )
        throw new Error("Single-lane detector exhausted its vehicle slots");
    }
    sim.step(warmup / DT);
    let vehicleSeconds = 0;
    let distance = 0;
    for (let tick = 0; tick < duration / DT; tick++) {
      sim.step();
      for (let index = 0; index < sim.vehicles.counts[0]; index++) {
        const slot = sim.vehicles.byLink[0][index];
        const front = sim.vehicles.s[slot];
        if (front < low) break;
        if (front > high) continue;
        vehicleSeconds += DT;
        distance += DT * sim.vehicles.v[slot];
      }
    }
    const exposure = detectorLength * duration;
    return {
      initialDensity,
      density: (vehicleSeconds * 1_000) / exposure,
      flow: (distance * 3_600) / exposure,
      speed: (distance * 3.6) / vehicleSeconds,
    };
  });
  const peak = points.reduce((highest, point) => (point.flow > highest.flow ? point : highest));
  return {
    warmup,
    duration,
    laneMetres: roadLength,
    detectorMetres: detectorLength,
    points,
    peak,
    passed: peak.flow > points[0].flow && peak.flow > points[points.length - 1].flow,
  };
}

function filtering() {
  const route = corridor.routes.find(({ source, links }) => source === 0 && links.length === 6);
  if (!route) throw new Error("Missing arterial filtering route");
  const road = corridor.links[route.links[0]];
  const junction = corridor.junctions.find(({ approaches }) => approaches.includes(road.id));
  const redPhase = junction?.phases.findIndex(({ approaches }) => !approaches.includes(road.id));
  if (!junction || redPhase === undefined || redPhase < 0)
    throw new Error("Filtering queue needs a red phase");
  const duration = 18;
  const zoneMetres = 10;
  const frames: {
    time: number;
    carS: number;
    carStrip: number;
    bikeS: number;
    bikeStrip: number;
  }[] = [];
  const cases = SEEDS.map((seed, caseIndex) => {
    const random = new Random(seed);
    const sim = createSim({
      network: corridor,
      scenario: { duration, sources: [] },
      seed,
      demand: [],
      maxVehicles: 20,
    });
    sim.signalBank.phase[junction.id] = redPhase;
    sim.signalBank.targetPhase[junction.id] = redPhase;
    const spawn = (cls: number, distance: number, strip: number) =>
      sim.vehicles.add({
        link: road.id,
        s: road.length - distance,
        strip,
        lat: strip * corridor.stripWidth,
        v: 0,
        v0: VEHICLE_CLASSES[cls].desiredSpeed * (0.9 + random.next() * 0.2),
        cls,
        route: route.id,
        occ: VEHICLE_CLASSES[cls].occupancy,
        tEnter: 0,
      });
    const lead = spawn(2, 1.5, 0);
    for (let car = 1; car < 4; car++) spawn(2, 1.5 + car * 9, 0);
    const first = spawn(0, 18 + random.next() * 3, 3);
    const second = spawn(0, 25 + random.next() * 3, 3);
    if (caseIndex === 0) {
      const record = () =>
        frames.push({
          time: sim.time,
          carS: sim.vehicles.s[lead],
          carStrip: sim.vehicles.strip[lead],
          bikeS: sim.vehicles.s[first],
          bikeStrip: sim.vehicles.strip[first],
        });
      record();
      while (sim.time < duration) {
        sim.step(0.5 / DT);
        record();
      }
    } else sim.step(duration / DT);
    let twoWheelers = 0;
    let vehicles = 0;
    for (let index = 0; index < sim.vehicles.counts[road.id]; index++) {
      const slot = sim.vehicles.byLink[road.id][index];
      if (sim.vehicles.s[slot] < road.length - zoneMetres) break;
      vehicles++;
      if (sim.vehicles.cls[slot] === 0) twoWheelers++;
    }
    return {
      seed,
      twoWheelers,
      vehicles,
      passedLead:
        Number(sim.vehicles.s[first] > sim.vehicles.s[lead]) +
        Number(sim.vehicles.s[second] > sim.vehicles.s[lead]),
    };
  });
  const total = cases.reduce((sum, item) => sum + item.vehicles, 0);
  const frontShare = cases.reduce((sum, item) => sum + item.twoWheelers, 0) / total;
  return {
    duration,
    zoneMetres,
    queueShare: 2 / 6,
    frontShare,
    cases,
    trace: {
      stripWidth: corridor.stripWidth,
      roadLength: road.length,
      roadStrips: road.strips,
      carLength: VEHICLE_CLASSES[2].length,
      carWidth: VEHICLE_CLASSES[2].width,
      twoWheelerLength: VEHICLE_CLASSES[0].length,
      twoWheelerWidth: VEHICLE_CLASSES[0].width,
      frames,
    },
    passed: frontShare > 2 / 6 && cases.every(({ passedLead }) => passedLead > 0),
  };
}

function discharge() {
  const { rows, warmup, windowSeconds } = calibration;
  const mixComparison = rows
    .filter(({ mix }) => mix === "mixed")
    .map((mixed) => {
      const cars = rows.find(({ mix, strips }) => mix === "cars" && strips === mixed.strips);
      if (!cars) throw new Error(`Missing cars-only calibration on ${mixed.strips} strips`);
      return {
        widthMetres: mixed.strips * corridor.stripWidth,
        mixedToCarsVehicleRate: mixed.vehiclesPerSecond / cars.vehiclesPerSecond,
        mixedToCarsAreaRate: mixed.areaPerSecond / cars.areaPerSecond,
      };
    });
  return {
    warmup,
    windowSeconds,
    points: rows.map(({ mix, strips, vehiclesPerSecond, areaPerSecond, samples }) => {
      const middle = Math.floor(samples.length / 2);
      const rate = (subset: typeof samples) =>
        subset.reduce((sum, { vehicles }) => sum + vehicles, 0) / (subset.length * windowSeconds);
      return {
        mix,
        strips,
        widthMetres: strips * corridor.stripWidth,
        vehiclesPerSecond,
        areaPerSecond,
        seeds: samples.length,
        splitHalfSpread:
          Math.abs(rate(samples.slice(0, middle)) - rate(samples.slice(middle))) /
          vehiclesPerSecond,
      };
    }),
    mixComparison,
    passed:
      rows.every(
        ({ vehiclesPerSecond, areaPerSecond }) => vehiclesPerSecond > 0 && areaPerSecond > 0,
      ) &&
      mixComparison.every(
        ({ mixedToCarsVehicleRate, mixedToCarsAreaRate }) =>
          mixedToCarsVehicleRate > 1 && Math.abs(mixedToCarsAreaRate - 1) < 0.25,
      ),
  };
}

function invariants(id: ScenarioId, controller: ControllerId, seed: number) {
  const duration = 1_200;
  const scenario = makeScenario(id, { duration });
  const sim = createSim({ network: corridor, scenario, seed });
  const driver = new ControllerDriver(
    sim,
    corridor,
    scenario,
    createController(controller, {
      saturation: (linkId) => saturationFor(corridor, scenario, linkId),
    }),
  );
  const overlap = new PhysicalOverlapCheck(corridor, sim);
  let vehicleTicks = 0;
  let overlapTicks = 0;
  let conservationViolations = 0;
  let firstOverlap: string | undefined;
  for (let tick = 1; tick <= duration / DT; tick++) {
    driver.advanceTo(tick);
    const metrics = sim.metrics();
    vehicleTicks += metrics.inNetwork;
    if (metrics.generated !== metrics.completed + metrics.inNetwork + metrics.backlog)
      conservationViolations++;
    const pair = overlap.firstOverlap();
    if (pair) {
      firstOverlap ??= overlap.describe(pair);
      overlapTicks++;
    }
  }
  const backstops = sim.backstops;
  const rate = backstops / vehicleTicks;
  return {
    id,
    controller,
    seed,
    duration,
    vehicleTicks,
    overlapTicks,
    firstOverlap,
    conservationViolations,
    backstops,
    rate,
    passed: overlapTicks === 0 && conservationViolations === 0 && rate < 1e-5,
  };
}

function twinDemand() {
  const duration = 240;
  const seed = SEEDS[3];
  const scenario = makeScenario("festival", { duration });
  const generated = generateDemand(corridor, scenario, seed);
  const paired = generateDemand(corridor, scenario, seed);
  const drivers = ["mp-count", "mp-area"].map(
    (id) =>
      new ControllerDriver(
        createSim({ network: corridor, scenario, seed, demand: generated }),
        corridor,
        scenario,
        createController(id === "mp-count" ? "mp-count" : "mp-area"),
      ),
  );
  let identical = JSON.stringify(generated) === JSON.stringify(paired);
  for (let tick = 1; tick <= duration / DT; tick++) {
    for (const driver of drivers) driver.advanceTo(tick);
    identical &&= drivers[0].sim.metrics().generated === drivers[1].sim.metrics().generated;
  }
  return { seed, duration, arrivals: drivers[0].sim.metrics().generated, passed: identical };
}

const report = {
  schema: 1,
  fundamentalDiagram: fundamentalDiagram(),
  discharge: discharge(),
  filtering: filtering(),
  invariants: [
    invariants("off-peak", "webster", SEEDS[0]),
    invariants("morning-peak", "mp-area", SEEDS[1]),
    invariants("cars-only", "mp-count", SEEDS[2]),
  ],
  twinDemand: twinDemand(),
};
writeFileSync("results/validation.json", `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(
  `${JSON.stringify(
    {
      fundamentalDiagram: report.fundamentalDiagram.passed,
      filtering: report.filtering.passed,
      discharge: report.discharge.passed,
      invariants: report.invariants,
      twinDemand: report.twinDemand.passed,
    },
    null,
    2,
  )}\n`,
);
if (
  !report.fundamentalDiagram.passed ||
  !report.discharge.passed ||
  !report.filtering.passed ||
  !report.twinDemand.passed ||
  report.invariants.some(({ passed }) => !passed)
)
  process.exitCode = 1;
