// Validation-seed diagnostic: where delay accrues and how fast each approach discharges on green.
// npm run bench:diagnose -- <scenario> <controller> [seed] [load]
import { ControllerDriver, type ControllerId, createController } from "@chowk/controllers";
import { makeScenario, type ScenarioId, saturationFor } from "@chowk/scenarios";
import { corridor, createSim, DT } from "@chowk/sim";

const args = process.argv.slice(2);
const scenarioId = (args[0] ?? "morning-peak") as ScenarioId;
const controllerId = (args[1] ?? "webster") as ControllerId;
const seed = Number(args[2] ?? 500_000);
const load = args[3] ? Number(args[3]) : undefined;
if (seed >= 1_000_000) throw new Error("Diagnostics use validation seeds only");

const warmup = 300;
const measurement = 1_800;
const network = corridor;
const scenario = makeScenario(scenarioId, { duration: warmup + measurement, load });
const sim = createSim({ network, scenario, seed });
const controller = createController(controllerId, {
  saturation: (link) => saturationFor(network, scenario, link),
});
const driver = new ControllerDriver(sim, network, scenario, controller);

const linkCount = network.links.length;
const approachOf = new Int32Array(linkCount).fill(-1);
for (const junction of network.junctions)
  for (const link of junction.approaches) approachOf[link] = junction.id;
const movementOf = new Map(network.connectors.map((c) => [c.id, c.movement]));

const { vehicles, signalBank } = sim;
const lastId = new Uint32Array(vehicles.capacity);
const lastLink = new Int32Array(vehicles.capacity).fill(-1);
const discharged = new Float64Array(linkCount);
const dischargedByMove: Record<string, number> = { through: 0, left: 0, right: 0 };
const greenSeconds = new Float64Array(linkCount);
const queuedGreenSeconds = new Float64Array(linkCount);
const queuedGreenDischarge = new Float64Array(linkCount);

function greenApproach(junction: number): number {
  if (signalBank.state[junction] !== 0) return -1;
  return network.junctions[junction].phases[signalBank.phase[junction]].approaches[0];
}

function hasQueueAtStopLine(link: number): boolean {
  const list = vehicles.byLink[link];
  const length = network.links[link].length;
  for (let i = 0; i < vehicles.counts[link]; i++) {
    const slot = list[i];
    if (vehicles.s[slot] < length - 30) break;
    if (vehicles.v[slot] < 1) return true;
  }
  return false;
}

const totalTicks = (warmup + measurement) / DT;
const warmTicks = warmup / DT;
driver.advanceTo(warmTicks);
const before = sim.metrics();
for (let tick = warmTicks + 1; tick <= totalTicks; tick++) {
  const queuedGreen = new Int32Array(network.junctions.length).fill(-1);
  for (const junction of network.junctions) {
    const link = greenApproach(junction.id);
    if (link < 0) continue;
    greenSeconds[link] += DT;
    if (hasQueueAtStopLine(link)) {
      queuedGreenSeconds[link] += DT;
      queuedGreen[junction.id] = link;
    }
  }
  driver.advanceTo(tick);
  for (let slot = 0; slot < vehicles.capacity; slot++) {
    const id = vehicles.id[slot];
    const link = vehicles.link[slot];
    if (id !== 0 && id === lastId[slot] && lastLink[slot] >= 0 && lastLink[slot] !== link) {
      const from = lastLink[slot];
      if (from < linkCount && approachOf[from] >= 0 && link >= linkCount) {
        discharged[from]++;
        const move = movementOf.get(link);
        if (move) dischargedByMove[move]++;
        if (queuedGreen[approachOf[from]] === from) queuedGreenDischarge[from]++;
      }
    }
    lastId[slot] = id;
    lastLink[slot] = id === 0 ? -1 : link;
  }
}
const after = sim.metrics();
const generatedPeople = after.generatedPeople - before.generatedPeople;
const personDelay = after.personDelay - before.personDelay;
const backlogVehicleSeconds = after.backlogVehicleSeconds - before.backlogVehicleSeconds;
console.log(
  JSON.stringify({ scenario: scenarioId, controller: controllerId, seed, load: scenario.load }),
);
console.log(
  `delay/person ${(personDelay / generatedPeople).toFixed(1)} s · generated ${after.generated - before.generated} · completed ${after.completed - before.completed} · inNetwork ${after.inNetwork} · backlog ${after.backlog} (start ${before.backlog}) · mean backlog ${(backlogVehicleSeconds / measurement).toFixed(1)}`,
);
console.log(
  `stops/veh ${((after.stops - before.stops) / (after.generated - before.generated)).toFixed(2)} · discharges by movement ${JSON.stringify(dischargedByMove)}`,
);
const generatedVehicles = after.generated - before.generated;
console.log(
  `mean vehicle delay ${((after.vehicleDelay - before.vehicleDelay) / generatedVehicles).toFixed(1)} s; backlog share of vehicle delay ${(backlogVehicleSeconds / (after.vehicleDelay - before.vehicleDelay)).toFixed(2)}`,
);
for (const junction of network.junctions) {
  const rows = junction.approaches.map((link) => {
    const sat = saturationFor(network, scenario, link);
    const rate =
      queuedGreenSeconds[link] > 0 ? queuedGreenDischarge[link] / queuedGreenSeconds[link] : 0;
    return `L${link}(${network.links[link].strips}s) flow ${(discharged[link] / measurement).toFixed(3)}/s green ${(greenSeconds[link] / measurement).toFixed(2)} queuedGreen ${(queuedGreenSeconds[link] / measurement).toFixed(2)} dischargeOnQueuedGreen ${rate.toFixed(3)}/s vs calib ${sat.toFixed(3)}`;
  });
  console.log(`J${junction.id + 1}\n  ${rows.join("\n  ")}`);
}
