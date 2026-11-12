import { ControllerDriver, createController } from "@chowk/controllers";
import { saturationFor } from "@chowk/scenarios";
import {
  corridor,
  createSim,
  DT,
  type Metrics,
  type Scenario,
  type ScheduledEvent,
  SNAPSHOT_STRIDE,
} from "@chowk/sim";
import { makeLiveScenario, warmupSeconds } from "../sim/liveScenario";
import type { ControllerChoice, FromSim, FromSimFrame, ToSim, ToSimInit } from "../sim/protocol";
import { InspectedController } from "./inspectedController";
import { ManualOverride } from "./manualOverride";

let driver: ControllerDriver | undefined;
let scenario: Scenario;
let endTick = 0;
let buffers: ArrayBuffer[] = [];
let events: ScheduledEvent[] = [];
let pressure = false;
let decision = false;
let inspection = false;
let inspected: InspectedController | undefined;
let manual: ManualOverride | undefined;
let manualJunction = -1;
let manualPhase = -1;
let choice: ControllerChoice = { id: "webster" };
// Clones of the simulation every CHECKPOINT_TICKS, kept for rewinding.
const CHECKPOINT_TICKS = Math.round(10 / DT);
const CHECKPOINT_COUNT = 9;
let checkpoints: { tick: number; sim: ReturnType<typeof createSim> }[] = [];
let applied: ScheduledEvent[] = [];

function controllerFor({ id, policy }: ControllerChoice) {
  manual = new ManualOverride(
    createController(id, {
      policy,
      saturation: (link) => saturationFor(corridor, scenario, link),
    }),
  );
  manual.junction = manualJunction;
  manual.phase = manualPhase;
  inspected = new InspectedController(manual);
  inspected.enabled = inspection;
  return inspected;
}

function publish(warmup?: Metrics[]) {
  if (!driver) return;
  const current = driver;
  const sim = current.sim;
  const buffer = buffers.pop();
  if (!buffer) throw new Error("Snapshot buffer pool exhausted");
  const vehicles = new Float32Array(buffer);
  const message: FromSimFrame = {
    type: "frame",
    tick: current.tick,
    count: sim.writeSnapshot(vehicles),
    vehicles: buffer,
    signals: sim.signals(),
    metrics: sim.metrics(),
    warmup,
    ...(pressure && { sense: corridor.junctions.map(({ id }) => sim.sense(id)) }),
    ...(decision && { explanations: corridor.junctions.map(({ id }) => current.explain(id)) }),
    ...(inspection && {
      observations: corridor.junctions.map(({ id }) => inspected?.observation(id)),
      decisions: corridor.junctions.map(({ id }) => inspected?.decision(id)),
    }),
  };
  self.postMessage(message, { transfer: [buffer] });
}

function advance(targetTick: number) {
  if (!driver) return;
  const target = Math.min(endTick, targetTick);
  while (events[0] && events[0].tick <= target) {
    const next = events.shift();
    if (!next) break;
    driver.advanceTo(next.tick - 1);
    driver.sim.inject(next.event);
    applied.push(next);
  }
  driver.advanceTo(target);
  const last = checkpoints[checkpoints.length - 1];
  if (!last || driver.tick - last.tick >= CHECKPOINT_TICKS) {
    checkpoints.push({ tick: driver.tick, sim: driver.sim.clone() });
    if (checkpoints.length > CHECKPOINT_COUNT) checkpoints.shift();
  }
  publish();
}

function rewind(seconds: number) {
  if (!driver) return;
  const wanted = driver.tick - Math.round(seconds / DT);
  let restore = checkpoints[0];
  for (const checkpoint of checkpoints) if (checkpoint.tick <= wanted) restore = checkpoint;
  if (!restore) return publish();
  // A clone continues bit for bit, so both sides return to the same state they were in.
  driver = new ControllerDriver(restore.sim.clone(), corridor, scenario, controllerFor(choice));
  checkpoints = checkpoints.filter(({ tick }) => tick <= restore.tick);
  const replay = applied.filter(({ tick }) => tick > restore.tick);
  applied = applied.filter(({ tick }) => tick <= restore.tick);
  events = [...replay, ...events].sort((a, b) => a.tick - b.tick);
  if (manualPhase >= 0) driver.sim.requestPhase(manualJunction, manualPhase);
  publish();
}

function init({
  seed,
  maxVehicles,
  controller = { id: "webster" },
  scenario: requestedScenario = makeLiveScenario(),
}: ToSimInit) {
  scenario = requestedScenario;
  choice = controller;
  checkpoints = [];
  applied = [];
  manualJunction = -1;
  manualPhase = -1;
  endTick = Math.floor(scenario.duration / DT);
  const sim = createSim({ network: corridor, scenario, seed, maxVehicles });
  driver = new ControllerDriver(sim, corridor, scenario, controllerFor(controller));
  events = [];
  buffers = Array.from(
    { length: 3 },
    () => new ArrayBuffer(maxVehicles * SNAPSHOT_STRIDE * Float32Array.BYTES_PER_ELEMENT),
  );
  const target = Math.min(endTick, Math.round(warmupSeconds / DT));
  const warmup: Metrics[] = [sim.metrics()];
  // Retain the warm-up series at one simulated-second intervals for rolling metrics.
  while (driver.tick < target) {
    driver.advanceTo(Math.min(target, driver.tick + Math.round(1 / DT)));
    warmup.push(sim.metrics());
  }
  publish(warmup);
}

self.onmessage = ({ data }: MessageEvent<ToSim>) => {
  try {
    switch (data.type) {
      case "init":
        init(data);
        break;
      case "advanceTo":
        advance(data.tick);
        break;
      case "setController":
        choice = data.controller;
        driver?.setController(controllerFor(data.controller));
        break;
      case "setOverlayData":
        pressure = data.pressure;
        decision = data.decision;
        inspection = data.inspection;
        if (inspected) inspected.enabled = inspection;
        break;
      case "event":
        if (!driver || data.atTick <= driver.tick || data.atTick > endTick)
          throw new Error("Event target must be after the current simulation tick.");
        events.push({ tick: data.atTick, event: data.event });
        break;
      case "manual": {
        const junction = corridor.junctions[data.junction];
        if (data.junction !== -1 && !junction)
          throw new Error("Unknown junction for manual control.");
        if (data.phase >= 0 && !junction?.phases[data.phase])
          throw new Error("Unknown phase for manual control.");
        manualJunction = data.junction;
        manualPhase = data.phase;
        if (manual) {
          manual.junction = manualJunction;
          manual.phase = manualPhase;
        }
        // Ask now as well as at the next decision; the signal still honours minimum green.
        if (driver && junction && data.phase >= 0)
          driver.sim.requestPhase(data.junction, data.phase);
        break;
      }
      case "rewind":
        rewind(data.seconds);
        break;
      case "recycle":
        buffers.push(data.buffer);
        break;
    }
  } catch (error) {
    const message: FromSim = {
      type: "error",
      message: error instanceof Error ? error.message : "The simulation could not advance.",
    };
    self.postMessage(message);
  }
};
