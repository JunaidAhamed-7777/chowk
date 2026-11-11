import { corridor, createSim, DT, SNAPSHOT_STRIDE } from "@chowk/sim";
import { liveDuration, makeLiveScenario, warmupSeconds } from "../sim/liveScenario";
import type { ControllerChoice, FromSim, FromSimFrame, ToSim, ToSimInit } from "../sim/protocol";

const cycleSlotSeconds = 24;
const junctionOffsets = [0, 11, 6, 18, 12] as const;
const phaseRequestInterval = Math.round(1 / DT);
const pressureRequestInterval = Math.round(5 / DT);
let sim: ReturnType<typeof createSim> | undefined;
let currentTick = 0;
let buffers: ArrayBuffer[] = [];
let endTick = Math.floor(liveDuration / DT);
let controller: ControllerChoice = "fixed";
let pressure = false;

function publish() {
  if (!sim) return;
  const buffer = buffers.pop();
  if (!buffer) throw new Error("Snapshot buffer pool exhausted");
  const vehicles = new Float32Array(buffer);
  const signals = sim.signals();
  const message: FromSimFrame = {
    type: "frame",
    tick: currentTick,
    count: sim.writeSnapshot(vehicles),
    vehicles: buffer,
    signals,
    metrics: sim.metrics(),
    ...(pressure && {
      sense: corridor.junctions
        .map(({ id }) => sim?.sense(id))
        .filter((sense) => sense !== undefined),
    }),
  };
  self.postMessage(message, { transfer: [buffer] });
}

function advance(targetTick: number) {
  if (!sim) return;
  const target = Math.min(endTick, targetTick);
  while (currentTick < target) {
    const interval = controller === "fixed" ? phaseRequestInterval : pressureRequestInterval;
    if (currentTick % interval === 0) {
      const time = currentTick * DT;
      for (const junction of corridor.junctions) {
        let desired =
          Math.floor((time + junctionOffsets[junction.id]) / cycleSlotSeconds) %
          junction.phases.length;
        if (controller === "pressure") {
          const reading = sim.sense(junction.id);
          let largest = -Infinity;
          desired = reading.phase;
          for (let offset = 0; offset < junction.phases.length; offset++) {
            const phase = (reading.phase + offset) % junction.phases.length;
            let score = 0;
            for (const link of junction.phases[phase].approaches) {
              const approach = reading.approaches[junction.approaches.indexOf(link)];
              score += approach.stoppedArea + approach.areaNear - approach.outArea;
            }
            if (score > largest) {
              largest = score;
              desired = phase;
            }
          }
        }
        sim.requestPhase(junction.id, desired);
      }
    }
    const batch = Math.min(target - currentTick, interval - (currentTick % interval));
    sim.step(batch);
    currentTick += batch;
  }
  publish();
}

function init({
  seed,
  maxVehicles,
  controller: choice = "fixed",
  scenario = makeLiveScenario(),
}: ToSimInit) {
  sim = createSim({ network: corridor, scenario, seed, maxVehicles });
  controller = choice;
  endTick = Math.floor(scenario.duration / DT);
  currentTick = 0;
  buffers = Array.from(
    { length: 3 },
    () => new ArrayBuffer(maxVehicles * SNAPSHOT_STRIDE * Float32Array.BYTES_PER_ELEMENT),
  );
  advance(Math.round(warmupSeconds / DT));
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
        controller = data.controller;
        break;
      case "setOverlayData":
        pressure = data.pressure;
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
