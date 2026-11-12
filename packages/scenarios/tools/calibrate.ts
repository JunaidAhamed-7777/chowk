import { mkdirSync, writeFileSync } from "node:fs";
import { corridor, createRandomStreams, createSim, DT, VEHICLE_CLASSES } from "@chowk/sim";
import { ARTERIAL_STRIPS, type MixId, trafficMixes, turningShares } from "../src/mixes";

const warmup = 6;
const windowSeconds = 40;
const seeds = Array.from({ length: 20 }, (_, index) => 500_000 + index);
const widths = [...new Set(corridor.links.map(({ strips }) => strips))].sort((a, b) => a - b);
const network = {
  ...corridor,
  junctions: corridor.junctions.map((junction) => ({ ...junction, maxGreen: 120 })),
};

function sample(strips: number, mixId: MixId, seed: number) {
  // Use an approach that offers every movement, so the queue discharges with the scenario's
  // turning shares through the same shared-box rules the scenarios run under.
  const road = network.links.find(
    (link) =>
      link.strips === strips &&
      (["through", "left", "right"] as const).every((movement) =>
        network.connectors.some(
          (entry) => entry.fromLink === link.id && entry.movement === movement,
        ),
      ),
  );
  if (!road) throw new Error(`No four-way approach with ${strips} strips`);
  const junction = network.junctions.find(({ approaches }) => approaches.includes(road.id));
  const phase = junction?.phases.findIndex(({ approaches }) => approaches.includes(road.id)) ?? -1;
  if (!junction || phase < 0) throw new Error(`Approach ${road.id} has no phase`);
  const routeFor = (movement: "through" | "left" | "right") => {
    const connector = network.connectors.find(
      (entry) => entry.fromLink === road.id && entry.movement === movement,
    );
    const route = network.routes.find(
      ({ links }) =>
        links.includes(road.id) && links[links.indexOf(road.id) + 1] === connector?.toLink,
    );
    if (!route) throw new Error(`Missing ${movement} calibration route for link ${road.id}`);
    return route;
  };
  const movements = (["through", "left", "right"] as const).map((movement) => ({
    route: routeFor(movement),
    share: turningShares[strips === ARTERIAL_STRIPS ? "arterial" : "cross"][movement],
  }));
  const sim = createSim({
    network,
    seed,
    scenario: { duration: warmup + windowSeconds, sources: [], laneDisciplined: mixId === "cars" },
    demand: [],
    maxVehicles: 768,
  });
  sim.signalBank.phase[junction.id] = phase;
  sim.signalBank.targetPhase[junction.id] = phase;
  const random = createRandomStreams(seed).demand;
  const mix = trafficMixes[mixId];
  const chooseClass = () => {
    let remaining = random.next();
    for (let cls = 0; cls < mix.length; cls++) {
      remaining -= mix[cls];
      if (remaining < 0) return cls;
    }
    return 2;
  };
  const chooseRoute = () => {
    let remaining = random.next();
    for (const { route, share } of movements) {
      remaining -= share;
      if (remaining < 0) return route;
    }
    return movements[0].route;
  };
  // Place a standing queue at the line. Row depth keeps all rectangles disjoint
  // before lane-free motion and filtering begin.
  for (let s = road.length - 1.6; s >= 14; ) {
    let rowDepth = 0;
    let strip = 0;
    while (strip < strips) {
      const cls = chooseClass();
      const vehicle = VEHICLE_CLASSES[cls];
      if (strip + vehicle.strips > strips) break;
      const route = chooseRoute();
      const slot = sim.vehicles.add({
        link: road.id,
        cls,
        s,
        strip,
        lat: strip * network.stripWidth,
        v: 0,
        v0: vehicle.desiredSpeed * (0.9 + random.next() * 0.2),
        route: route.id,
        occ: vehicle.occupancy,
        tEnter: 0,
      });
      if (slot < 0) throw new Error("Calibration queue exceeded vehicle capacity");
      sim.vehicles.routeIdx[slot] = route.links.indexOf(road.id);
      rowDepth = Math.max(rowDepth, vehicle.length + vehicle.standstillGap);
      strip += mixId === "cars" ? 7 : vehicle.strips;
    }
    s -= rowDepth;
  }
  const remainingArea = () => {
    let area = 0;
    for (let i = 0; i < sim.vehicles.counts[road.id]; i++) {
      const vehicle = VEHICLE_CLASSES[sim.vehicles.cls[sim.vehicles.byLink[road.id][i]]];
      area += vehicle.length * vehicle.width;
    }
    return area;
  };
  sim.step(warmup / DT);
  const countStart = sim.vehicles.counts[road.id];
  const areaStart = remainingArea();
  sim.step(windowSeconds / DT);
  const countEnd = sim.vehicles.counts[road.id];
  if (countEnd === 0) throw new Error(`Calibration queue exhausted on link ${road.id}`);
  return {
    vehicles: countStart - countEnd,
    area: areaStart - remainingArea(),
  };
}

const rows = [];
for (const mix of Object.keys(trafficMixes) as MixId[]) {
  for (const strips of widths) {
    const samples = seeds.map((seed) => ({ seed, ...sample(strips, mix, seed) }));
    const vehiclesPerSecond =
      samples.reduce((sum, { vehicles }) => sum + vehicles, 0) / (seeds.length * windowSeconds);
    const areaPerSecond =
      samples.reduce((sum, { area }) => sum + area, 0) / (seeds.length * windowSeconds);
    if (!(vehiclesPerSecond > 0 && areaPerSecond > 0))
      throw new Error(`Zero measured discharge for ${mix} / ${strips}`);
    rows.push({ mix, strips, vehiclesPerSecond, areaPerSecond, samples });
    process.stdout.write(
      `${mix} / ${strips} strips: ${vehiclesPerSecond.toFixed(3)} vehicles/s, ${areaPerSecond.toFixed(3)} m²/s\n`,
    );
  }
}

mkdirSync("results", { recursive: true });
writeFileSync(
  "results/calibration.json",
  `${JSON.stringify({ schema: 2, warmup, windowSeconds, turningShares, rows }, null, 2)}\n`,
);
