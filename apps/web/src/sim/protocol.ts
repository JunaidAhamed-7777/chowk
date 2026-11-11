import type { ControllerId, Explanation, PolicyWeights } from "@chowk/controllers";
import type { JunctionSense, Metrics, Scenario, SimEvent } from "@chowk/sim";

export interface ControllerChoice {
  id: ControllerId;
  policy?: PolicyWeights;
}

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
  | { type: "setOverlayData"; pressure: boolean; decision: boolean }
  | { type: "event"; atTick: number; event: SimEvent }
  | { type: "recycle"; buffer: ArrayBuffer };

export interface FromSimFrame {
  type: "frame";
  tick: number;
  count: number;
  vehicles: ArrayBuffer;
  signals: Uint8Array;
  metrics: Metrics;
  warmup?: Metrics[];
  sense?: JunctionSense[];
  explanations?: (Explanation | undefined)[];
}

export type FromSim = FromSimFrame | { type: "error"; message: string };
