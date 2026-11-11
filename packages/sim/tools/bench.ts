import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cpus, platform, release } from "node:os";
import { performance } from "node:perf_hooks";
import { corridor, createRandomStreams, createSim, DT, VEHICLE_CLASSES } from "../src";

const targetCounts = [500, 1_500, 3_000];
const samples = 3;
const warmupTicks = 24;
const timedTicks = 96;

function populated(target: number, seed: number) {
  const random = createRandomStreams(seed).demand;
  const areas = corridor.links.map(({ strips, length }) => strips * length);
  const totalArea = areas.reduce((a, b) => a + b, 0);
  const sim = createSim({
    network: corridor,
    seed,
    scenario: { duration: 60, sources: [] },
    demand: [],
    maxVehicles: target,
  });
  let totalAllocated = 0;
  let area = 0;
  for (const road of corridor.links) {
    area += areas[road.id];
    const count = Math.round((target * area) / totalArea) - totalAllocated;
    totalAllocated += count;
    if (!count) continue;
    const route = corridor.routes.find(({ links }) => links.includes(road.id));
    if (!route) throw new Error(`No route over link ${road.id}`);
    const index = route.links.indexOf(road.id);
    const rows: { depth: number; vehicles: { cls: number; strip: number }[] }[] = [];
    let row = { depth: 0, vehicles: [] as { cls: number; strip: number }[] };
    let strip = 0;
    for (let vehicle = 0; vehicle < count; vehicle++) {
      const draw = random.next();
      const cls = draw < 0.5 ? 0 : draw < 0.62 ? 1 : draw < 0.9 ? 2 : draw < 0.95 ? 3 : 4;
      const spec = VEHICLE_CLASSES[cls];
      if (strip + spec.strips > road.strips) {
        rows.push(row);
        row = { depth: 0, vehicles: [] };
        strip = 0;
      }
      row.depth = Math.max(row.depth, spec.length + spec.standstillGap);
      row.vehicles.push({ cls, strip });
      strip += spec.strips;
    }
    rows.push(row);
    const spare = road.length - 28 - rows.reduce((sum, entry) => sum + entry.depth, 0);
    if (spare < 0) throw new Error(`Fixture will not fit on link ${road.id}`);
    const gap = spare / rows.length;
    let front = road.length - 14;
    for (const row of rows) {
      for (const { cls, strip } of row.vehicles) {
        const spec = VEHICLE_CLASSES[cls];
        const slot = sim.vehicles.add({
          link: road.id,
          cls,
          s: front,
          strip,
          lat: strip * corridor.stripWidth,
          route: route.id,
          v: 0,
          v0: spec.desiredSpeed,
          occ: spec.occupancy,
          tEnter: 0,
        });
        if (slot < 0) throw new Error("Vehicle fixture exhausted its capacity");
        sim.vehicles.routeIdx[slot] = index;
      }
      front -= row.depth + gap;
    }
  }
  return sim;
}

function measure(vehicles: number, seed: number) {
  const sim = populated(vehicles, seed);
  sim.step(warmupTicks);
  const start = performance.now();
  let active = 0;
  for (let tick = 0; tick < timedTicks; tick++) {
    sim.step();
    active += sim.vehicles.count;
  }
  const elapsed = performance.now() - start;
  return { realtime: (timedTicks * DT * 1000) / elapsed, meanActive: active / timedTicks };
}

const simulator = targetCounts.map((vehicles) => {
  const runs = Array.from({ length: samples }, (_, index) => {
    const seed = 500_000 + index;
    let starting = vehicles;
    let run = measure(starting, seed);
    // Vehicles leave via sinks during measurement. Add back the deterministic
    // drain in the next fixture so timed mean occupancy meets the stated load.
    for (let attempt = 0; run.meanActive < vehicles && attempt < 5; attempt++) {
      starting += Math.ceil((vehicles - run.meanActive) * 1.15);
      run = measure(starting, seed);
    }
    if (run.meanActive < vehicles) throw new Error(`Could not sustain ${vehicles} active vehicles`);
    return run;
  });
  runs.sort((a, b) => a.realtime - b.realtime);
  const median = runs[Math.floor(samples / 2)];
  process.stdout.write(
    `${vehicles} vehicle target (${median.meanActive.toFixed(0)} active on average): ${median.realtime.toFixed(1)}× real time\n`,
  );
  return { vehicles, ...median };
});

if (process.argv.includes("--write")) {
  const file = "results/engineering.json";
  const existing = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const hardware = {
    ...existing.hardware,
    cpu: cpus()[0]?.model ?? "Unknown CPU",
    os: `${platform()} ${release()}`,
    runtime: `Node ${process.versions.node}`,
  };
  mkdirSync("results", { recursive: true });
  writeFileSync(file, `${JSON.stringify({ ...existing, hardware, simulator }, null, 2)}\n`);
}
