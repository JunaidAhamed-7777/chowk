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

let driver: ControllerDriver | undefined;
let scenario: Scenario;
let endTick = 0;
let buffers: ArrayBuffer[] = [];
let events: ScheduledEvent[] = [];
let pressure = false;
let decision = false;
let inspection = false;
let inspected: InspectedController | undefined;

function controllerFor({ id, policy }: ControllerChoice) {
  inspected = new InspectedController(
    createController(id, {
      policy,
      saturation: (link) => saturationFor(corridor, scenario, link),
    }),
  );
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
  }
  driver.advanceTo(target);
  publish();
}

function init({
  seed,
  maxVehicles,
  controller = { id: "webster" },
  scenario: requestedScenario = makeLiveScenario(),
}: ToSimInit) {
  scenario = requestedScenario;
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
