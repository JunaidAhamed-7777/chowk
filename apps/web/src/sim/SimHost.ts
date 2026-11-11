import { DT, type Metrics, SNAPSHOT_STRIDE } from "@chowk/sim";
import { liveDuration, liveSeed } from "./liveScenario";
import type { FromSim, FromSimFrame, ToSim } from "./protocol";

export const fadeMs = 200;
const maxTick = Math.floor(liveDuration / DT);

export interface Snapshot {
  tick: number;
  count: number;
  positions: Float32Array<ArrayBuffer>;
  signals: Uint8Array;
  index: Map<number, number>;
}

export interface Departure {
  time: number;
  x: number;
  z: number;
  dx: number;
  dz: number;
  cls: number;
  flags: number;
}

export class SimHost {
  previous?: Snapshot;
  current?: Snapshot;
  receivedAt = 0;
  readonly births = new Map<number, number>();
  readonly departures: Departure[] = [];
  private accumulator = 0;
  private lastMetricsAt = -Infinity;
  private inFlight = true;
  private readonly worker = new Worker(new URL("../workers/sim.worker.ts", import.meta.url), {
    type: "module",
  });

  constructor(
    maxVehicles: number,
    onReady: () => void,
    onMetrics: (metrics: Metrics) => void,
    onError: (message: string) => void,
  ) {
    this.worker.onmessage = ({ data }: MessageEvent<FromSim>) => {
      if (data.type === "error") {
        onError(data.message);
        return;
      }
      const first = !this.current;
      const now = performance.now();
      this.receive(data, now);
      if (first) onReady();
      if (now - this.lastMetricsAt >= 250 || data.tick === maxTick) {
        this.lastMetricsAt = now;
        onMetrics(data.metrics);
      }
    };
    this.worker.onerror = (event) => {
      event.preventDefault();
      onError(event.message || "The simulation worker stopped.");
    };
    this.send({ type: "init", seed: liveSeed, maxVehicles });
  }

  private send(message: ToSim) {
    this.worker.postMessage(message);
  }

  private receive(frame: FromSimFrame, now: number) {
    const map = this.previous?.index ?? new Map<number, number>();
    if (this.previous) {
      const buffer = this.previous.positions.buffer;
      const recycle: ToSim = { type: "recycle", buffer };
      this.worker.postMessage(recycle, [buffer]);
    }
    map.clear();
    this.previous = this.current;
    this.current = {
      tick: frame.tick,
      count: frame.count,
      positions: new Float32Array(frame.vehicles),
      signals: frame.signals,
      index: map,
    };
    this.receivedAt = now;
    this.inFlight = false;

    for (const [id, bornAt] of this.births) {
      if (now - bornAt > fadeMs) this.births.delete(id);
    }
    while (this.departures.length && now - this.departures[0].time > fadeMs)
      this.departures.shift();
    const { positions } = this.current;
    for (let offset = 0; offset < frame.count * SNAPSHOT_STRIDE; offset += SNAPSHOT_STRIDE) {
      const id = positions[offset + 6];
      map.set(id, offset);
      if (this.previous && !this.previous.index.has(id)) this.births.set(id, now);
    }

    const previous = this.previous;
    if (!previous) return;
    for (const [id, offset] of previous.index) {
      if (map.has(id)) continue;
      const values = previous.positions;
      this.departures.push({
        time: now,
        x: values[offset],
        z: values[offset + 1],
        dx: values[offset + 2],
        dz: values[offset + 3],
        cls: values[offset + 5],
        flags: values[offset + 7],
      });
    }
  }

  advance(delta: number, speed: number, running: boolean) {
    if (!this.current || !running || this.current.tick >= maxTick) {
      this.accumulator = 0;
      return;
    }
    // Limit outstanding work and discard excess wall time when the worker is slow.
    const budget = Math.max(DT, speed * 0.15);
    this.accumulator = Math.min(this.accumulator + Math.min(delta, 0.1) * speed, budget);
    if (this.inFlight) return;
    const ticks = Math.floor(this.accumulator / DT);
    if (ticks === 0) return;
    this.accumulator -= ticks * DT;
    this.inFlight = true;
    this.send({ type: "advanceTo", tick: Math.min(maxTick, this.current.tick + ticks) });
  }

  dispose() {
    this.worker.terminate();
  }
}
