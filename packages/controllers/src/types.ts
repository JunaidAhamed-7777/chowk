import type { JunctionSense, Network, Scenario } from "@chowk/sim";
import type { PolicyWeights } from "./policy/weights";

export type BaselineId = "webster" | "actuated" | "mp-count" | "mp-area";
export type LearnedId = "chowk" | "chowk-vehicle" | "chowk-count" | "chowk-pure" | "chowk-solo";
export type ControllerId = BaselineId | LearnedId | `${BaselineId}+preempt`;

export interface ControllerOptions {
  policy?: PolicyWeights;
  parameters?: Float32Array;
  saturation?: (linkId: number) => number;
  hysteresis?: number;
}

export interface NeighbourApproach {
  releasing: boolean;
  elapsed: number;
}

export interface NeighbourSense {
  time: number;
  approaches: readonly NeighbourApproach[];
}

export interface Explanation {
  scores: number[];
  prior?: number[];
  learned?: number[];
  reason: string;
}

export interface Controller {
  readonly id: ControllerId;
  init(network: Network, scenario: Scenario): void;
  act(junctionId: number, sense: JunctionSense, neighbours: NeighbourSense): number;
  explain?(junctionId: number): Explanation | undefined;
}
