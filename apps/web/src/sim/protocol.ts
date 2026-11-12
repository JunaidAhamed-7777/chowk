import type { ControllerId, Explanation, PolicyWeights } from "@chowk/controllers";
import type { JunctionSense, Metrics, Scenario, SimEvent } from "@chowk/sim";

export interface ControllerChoice {
  id: ControllerId;
  policy?: PolicyWeights;
}

/** The sensor reading a controller acted on at its latest decision, and the phase it asked for. */
export interface DecisionRecord {
  time: number;
  sense: JunctionSense;
  requested: number;
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
  | { type: "setOverlayData"; pressure: boolean; decision: boolean; inspection: boolean }
  | { type: "event"; atTick: number; event: SimEvent }
  | { type: "manual"; junction: number; phase: number }
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
  observations?: (number[] | undefined)[];
  decisions?: (DecisionRecord | undefined)[];
}

export type FromSim = FromSimFrame | { type: "error"; message: string };
