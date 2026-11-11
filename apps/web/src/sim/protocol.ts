import type { Metrics } from "@chowk/sim";

export interface ToSimInit {
  type: "init";
  seed: number;
  maxVehicles: number;
}

export type ToSim =
  | ToSimInit
  | { type: "advanceTo"; tick: number }
  | { type: "recycle"; buffer: ArrayBuffer };

export interface FromSimFrame {
  type: "frame";
  tick: number;
  count: number;
  vehicles: ArrayBuffer;
  signals: Uint8Array;
  metrics: Metrics;
}

export type FromSim = FromSimFrame | { type: "error"; message: string };
