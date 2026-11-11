import type { JunctionSense, Metrics, Scenario } from "@chowk/sim";

export type ControllerChoice = "fixed" | "pressure";

export interface ToSimInit {
  type: "init";
  seed: number;
  maxVehicles: number;
  controller?: ControllerChoice;
  scenario?: Scenario;
}

export type ToSim =
  | ToSimInit
  | { type: "advanceTo"; tick: number }
  | { type: "setController"; controller: ControllerChoice }
  | { type: "setOverlayData"; pressure: boolean }
  | { type: "recycle"; buffer: ArrayBuffer };

export interface FromSimFrame {
  type: "frame";
  tick: number;
  count: number;
  vehicles: ArrayBuffer;
  signals: Uint8Array;
  metrics: Metrics;
  sense?: JunctionSense[];
}

export type FromSim = FromSimFrame | { type: "error"; message: string };
