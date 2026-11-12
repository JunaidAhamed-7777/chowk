import type { Explanation } from "@chowk/controllers";
import {
  DT,
  type JunctionSense,
  type Metrics,
  type Scenario,
  type SimEvent,
  SNAPSHOT_STRIDE,
} from "@chowk/sim";
import { liveDuration } from "./liveScenario";
import type { ControllerChoice, DecisionRecord, FromSim, FromSimFrame, ToSim } from "./protocol";

export const fadeMs = 200;
export type SimulationSide = 0 | 1;
export type ControllerPair = readonly [ControllerChoice, ControllerChoice];
export type MetricsPair = readonly [Metrics, Metrics];

export interface Snapshot {
  tick: number;
  count: number;
  positions: Float32Array<ArrayBuffer>;
  signals: Uint8Array;
  index: Map<number, number>;
  sense?: JunctionSense[];
  explanations?: (Explanation | undefined)[];
  observations?: (number[] | undefined)[];
  decisions?: (DecisionRecord | undefined)[];
}

export interface Departure {
  time: number;
  id: number;
  x: number;
  z: number;
  dx: number;
  dz: number;
  cls: number;
  flags: number;
}

export class SnapshotStream {
  previous?: Snapshot;
  current?: Snapshot;
  receivedAt = 0;
  readonly births = new Map<number, number>();
  readonly departures: Departure[] = [];
  private readonly worker = new Worker(new URL("../workers/sim.worker.ts", import.meta.url), {
    type: "module",
  });

  constructor(onFrame: (frame: FromSimFrame) => void, onError: (message: string) => void) {
    this.worker.onmessage = ({ data }: MessageEvent<FromSim>) => {
      if (data.type === "error") {
        onError(data.message);
        return;
      }
      onFrame(data);
    };
    this.worker.onerror = (event) => {
      event.preventDefault();
      onError(event.message || "The simulation worker stopped.");
    };
  }

  send(message: ToSim) {
    this.worker.postMessage(message);
  }

  publish(frame: FromSimFrame, now: number) {
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
      sense: frame.sense,
      explanations: frame.explanations,
      observations: frame.observations,
      decisions: frame.decisions,
    };
    this.receivedAt = now;

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
        id,
        x: values[offset],
        z: values[offset + 1],
        dx: values[offset + 2],
        dz: values[offset + 3],
        cls: values[offset + 5],
        flags: values[offset + 7],
      });
    }
  }

  dispose() {
    this.worker.terminate();
  }
}

interface SimHostOptions {
  seed: number;
  maxVehicles: number;
  scenario?: Scenario;
  controllers: ControllerPair;
  onReady: () => void;
  onMetrics: (metrics: MetricsPair, tick: number, warmup?: readonly MetricsPair[]) => void;
  onError: (message: string) => void;
}

export class SimHost {
  readonly streams: readonly [SnapshotStream, SnapshotStream];
  private readonly pending: [FromSimFrame?, FromSimFrame?] = [];
  private readonly maxTick: number;
  private accumulator = 0;
  private lastMetricsAt = -Infinity;
  private inFlight = true;
  private refreshRequested = false;
  private overlay = { pressure: false, decision: false, inspection: false };
  private readonly controllers: [ControllerChoice, ControllerChoice];
  private disposed = false;
  private tick: number | undefined;
  private target: number | undefined;

  constructor(private readonly options: SimHostOptions) {
    this.maxTick = Math.floor((options.scenario?.duration ?? liveDuration) / DT);
    this.controllers = [...options.controllers];
    const onError = (message: string) => this.fail(message);
    this.streams = [
      new SnapshotStream((frame) => this.receive(0, frame), onError),
      new SnapshotStream((frame) => this.receive(1, frame), onError),
    ];
    for (const side of [0, 1] as const) {
      this.streams[side].send({
        type: "init",
        seed: options.seed,
        maxVehicles: options.maxVehicles,
        controller: options.controllers[side],
        scenario: options.scenario,
      });
    }
  }

  private fail(message: string) {
    if (this.disposed) return;
    this.dispose();
    this.options.onError(message);
  }

  private receive(side: SimulationSide, frame: FromSimFrame) {
    if (this.disposed) return;
    if (this.pending[side] || (this.target !== undefined && frame.tick !== this.target)) {
      this.fail("The simulation workers lost synchronisation.");
      return;
    }
    this.pending[side] = frame;
    const [left, right] = this.pending;
    if (!left || !right) return;
    if (left.tick !== right.tick) {
      this.fail("The simulation workers returned different ticks.");
      return;
    }
    this.pending[0] = undefined;
    this.pending[1] = undefined;
    const now = performance.now();
    const first = this.tick === undefined;
    this.tick = left.tick;
    this.inFlight = false;
    // Both snapshots become visible in the same turn, even if one worker was slow.
    this.streams[0].publish(left, now);
    this.streams[1].publish(right, now);
    if (first) this.options.onReady();
    if (now - this.lastMetricsAt >= 250 || this.tick === this.maxTick) {
      this.lastMetricsAt = now;
      const warmup = left.warmup && right.warmup;
      this.options.onMetrics(
        [left.metrics, right.metrics],
        this.tick,
        warmup && left.warmup?.map((metrics, index) => [metrics, warmup[index]]),
      );
    }
  }

  setController(side: SimulationSide, controller: ControllerChoice) {
    const previous = this.controllers[side];
    if (this.disposed || (previous.id === controller.id && previous.policy === controller.policy))
      return;
    this.controllers[side] = controller;
    this.streams[side].send({ type: "setController", controller });
  }

  /** Hand one junction on one side to the visitor; phase -1 returns it to the controller. */
  setManual(side: SimulationSide, junction: number, phase: number) {
    if (this.disposed) return;
    this.streams[side].send({ type: "manual", junction, phase });
    this.refreshRequested = true;
  }

  setOverlayData(pressure: boolean, decision: boolean, inspection: boolean) {
    if (
      this.disposed ||
      (this.overlay.pressure === pressure &&
        this.overlay.decision === decision &&
        this.overlay.inspection === inspection)
    )
      return;
    this.overlay = { pressure, decision, inspection };
    const message: ToSim = { type: "setOverlayData", pressure, decision, inspection };
    this.streams[0].send(message);
    this.streams[1].send(message);
    this.refreshRequested = true;
  }

  inject(event: SimEvent) {
    if (this.disposed || this.tick === undefined) return undefined;
    const atTick = Math.max(this.tick, this.target ?? this.tick) + 1;
    if (atTick > this.maxTick) return undefined;
    const message: ToSim = { type: "event", atTick, event };
    this.streams[0].send(message);
    this.streams[1].send(message);
    return atTick;
  }

  private request(tick: number) {
    this.inFlight = true;
    this.target = tick;
    this.refreshRequested = false;
    const message: ToSim = { type: "advanceTo", tick };
    this.streams[0].send(message);
    this.streams[1].send(message);
  }

  advance(delta: number, speed: number, running: boolean) {
    if (this.disposed || this.tick === undefined) return;
    if (!running || this.tick >= this.maxTick) {
      this.accumulator = 0;
      if (!this.inFlight && this.refreshRequested) this.request(this.tick);
      return;
    }
    // Limit outstanding work and discard excess wall time when the worker is slow.
    const budget = Math.max(DT, speed * 0.15);
    this.accumulator = Math.min(this.accumulator + Math.min(delta, 0.1) * speed, budget);
    if (this.inFlight) return;
    const ticks = Math.floor(this.accumulator / DT);
    if (ticks === 0) {
      if (this.refreshRequested) this.request(this.tick);
      return;
    }
    this.accumulator -= ticks * DT;
    this.request(Math.min(this.maxTick, this.tick + ticks));
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.streams[0].dispose();
    this.streams[1].dispose();
  }
}
