import { mkdirSync, writeFileSync } from "node:fs";
import { corridor, createRandomStreams, createSim, DT, VEHICLE_CLASSES } from "@chowk/sim";
import { type MixId, trafficMixes } from "../src/mixes";

const warmup = 6;
const windowSeconds = 40;
const seeds = Array.from({ length: 20 }, (_, index) => 500_000 + index);
const widths = [...new Set(corridor.links.map(({ strips }) => strips))].sort((a, b) => a - b);
const network = {
  ...corridor,
  junctions: corridor.junctions.map((junction) => ({ ...junction, maxGreen: 120 })),
};

function sample(strips: number, mixId: MixId, seed: number) {
  const connector = network.connectors.find(
    (entry) => entry.movement === "through" && network.links[entry.fromLink].strips === strips,
  );
  if (!connector) throw new Error(`No through movement for ${strips} strips`);
  const road = network.links[connector.fromLink];
  const junction = network.junctions[connector.junction];
  const phase = junction.phases.findIndex(({ approaches }) => approaches.includes(road.id));
  const route = network.routes.find(
    ({ links }) =>
      links[links.indexOf(road.id) + 1] === connector.toLink && links.includes(road.id),
  );
  if (!route || phase < 0) throw new Error(`Missing calibration route for link ${road.id}`);
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
  // Place a standing queue at the line. Row depth keeps all rectangles disjoint
  // before lane-free motion and filtering begin.
  for (let s = road.length - 1.6; s >= 14; ) {
    let rowDepth = 0;
    let strip = 0;
    while (strip < strips) {
      const cls = chooseClass();
      const vehicle = VEHICLE_CLASSES[cls];
      if (strip + vehicle.strips > strips) break;
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
  `${JSON.stringify({ schema: 1, warmup, windowSeconds, rows }, null, 2)}\n`,
);
