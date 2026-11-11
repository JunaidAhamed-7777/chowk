import { corridor, createSim, DT, SNAPSHOT_STRIDE } from "@chowk/sim";
import { liveDuration, makeLiveScenario, warmupSeconds } from "../sim/liveScenario";
import type { FromSim, FromSimFrame, ToSim, ToSimInit } from "../sim/protocol";

const cycleSlotSeconds = 24;
const junctionOffsets = [0, 11, 6, 18, 12] as const;
const phaseRequestInterval = Math.round(1 / DT);
const endTick = Math.floor(liveDuration / DT);
let sim: ReturnType<typeof createSim> | undefined;
let currentTick = 0;
let buffers: ArrayBuffer[] = [];

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
  };
  self.postMessage(message, { transfer: [buffer] });
}

function advance(targetTick: number) {
  if (!sim) return;
  const target = Math.min(endTick, targetTick);
  while (currentTick < target) {
    if (currentTick % phaseRequestInterval === 0) {
      const time = currentTick * DT;
      for (const junction of corridor.junctions) {
        const desired =
          Math.floor((time + junctionOffsets[junction.id]) / cycleSlotSeconds) %
          junction.phases.length;
        sim.requestPhase(junction.id, desired);
      }
    }
    const batch = Math.min(
      target - currentTick,
      phaseRequestInterval - (currentTick % phaseRequestInterval),
    );
    sim.step(batch);
    currentTick += batch;
  }
  publish();
}

function init({ seed, maxVehicles }: ToSimInit) {
  sim = createSim({ network: corridor, scenario: makeLiveScenario(), seed, maxVehicles });
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
