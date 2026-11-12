import { ControllerDriver, createController } from "@chowk/controllers";
import { makeScenario, saturationFor } from "@chowk/scenarios";
import { createSim, DT, holdoutNetwork, SNAPSHOT_STRIDE } from "@chowk/sim";
import type { GridFromWorker, GridToWorker } from "../benchmark/gridProtocol";

// The held-out grid, run live for the Results page. Same simulator and controllers as the
// benchmark; the grid was never used for training or checkpoint choice.
const WARMUP_SECONDS = 300;
const MAX_VEHICLES = 1_500;
let driver: ControllerDriver | undefined;
// Two buffers: one on screen while the other is written.
const pool: ArrayBuffer[] = [0, 1].map(
  () => new ArrayBuffer(MAX_VEHICLES * SNAPSHOT_STRIDE * Float32Array.BYTES_PER_ELEMENT),
);
let base = { personDelay: 0, generatedPeople: 0 };

self.onmessage = ({ data }: MessageEvent<GridToWorker>) => {
  try {
    if (data.type === "init") {
      const scenario = makeScenario("morning-peak", {
        network: holdoutNetwork,
        duration: WARMUP_SECONDS + 1_800,
      });
      const sim = createSim({
        network: holdoutNetwork,
        scenario,
        seed: data.seed,
        maxVehicles: MAX_VEHICLES,
      });
      driver = new ControllerDriver(
        sim,
        holdoutNetwork,
        scenario,
        createController(data.controller.id, {
          policy: data.controller.policy,
          saturation: (link) => saturationFor(holdoutNetwork, scenario, link),
        }),
      );
      driver.advanceTo(Math.round(WARMUP_SECONDS / DT));
      const metrics = sim.metrics();
      base = { personDelay: metrics.personDelay, generatedPeople: metrics.generatedPeople };
    } else if (data.type === "advance" && driver) {
      driver.advanceTo(
        Math.min(
          data.tick + Math.round(WARMUP_SECONDS / DT),
          Math.round((WARMUP_SECONDS + 1_800) / DT),
        ),
      );
    } else if (data.type === "recycle") {
      pool.push(data.buffer);
      return;
    }
    if (!driver) return;
    const sim = driver.sim;
    const metrics = sim.metrics();
    const next = pool.pop();
    if (!next) throw new Error("Grid snapshot buffers were not returned");
    const buffer = new Float32Array(next);
    const count = sim.writeSnapshot(buffer);
    const people = metrics.generatedPeople - base.generatedPeople;
    const message: GridFromWorker = {
      tick: driver.tick - Math.round(WARMUP_SECONDS / DT),
      count,
      positions: buffer.buffer,
      signals: sim.signals(),
      delayPerPerson: people > 0 ? (metrics.personDelay - base.personDelay) / people : 0,
    };
    self.postMessage(message, { transfer: [buffer.buffer] });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
