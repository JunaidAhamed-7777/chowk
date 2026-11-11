import type { ApproachSense, JunctionSense, Network, Scenario } from "@chowk/sim";
import { expectedDemand, type TurnShare } from "../demand";
import { bestPhase, scorePressure } from "../pressure";
import type { Controller, Explanation, LearnedId, NeighbourSense } from "../types";
import { Inference } from "./inference";
import {
  buildObservation,
  DIRECTION_NAMES,
  FEATURE_WIDTH,
  layoutFor,
  NEIGHBOUR_OFFSET,
  type ObservationLayout,
} from "./observation";
import { POLICY_PARAMETER_COUNT } from "./weights";

const COUNT_PRESSURE_SCALE = 40;

interface Decision {
  layout: ObservationLayout;
  features: Float64Array;
  prior: Float64Array;
  learned: Float64Array;
  scores: Float64Array;
  current: number;
  chosen: number;
  sense?: JunctionSense;
}

function describe(approach: ApproachSense, direction: string): string {
  if (approach.emergency) return `${direction}: ambulance approaching`;
  if (approach.waitMax >= 90) return `${direction}: waited ${Math.round(approach.waitMax)} s`;
  if (approach.people >= 30)
    return `${direction}: ${Math.round(approach.people)} people approaching`;
  if (approach.outArea >= 0.65) return `${direction}: exit occupied`;
  return `${direction}: ${Math.round(approach.areaNear * 100)}% of road occupied near the stop line`;
}

export class ResidualPolicy implements Controller {
  private readonly inference: Inference;
  private readonly beta: number;
  private readonly counts: boolean;
  private readonly solo: boolean;
  private readonly zeroOutput: boolean;
  private readonly output = new Float64Array(4);
  private readonly occlusion = new Float64Array(50);
  private network!: Network;
  private shares: TurnShare[][] = [];
  private decisions: Decision[] = [];

  constructor(
    readonly id: LearnedId,
    vector: Float32Array,
    private readonly hysteresis: number,
  ) {
    this.inference = new Inference(vector);
    this.beta = id === "chowk-pure" ? 0 : vector[POLICY_PARAMETER_COUNT];
    this.counts = id === "chowk-count";
    this.solo = id === "chowk-solo";
    this.zeroOutput = !vector
      .subarray(POLICY_PARAMETER_COUNT - (64 * 4 + 4), POLICY_PARAMETER_COUNT)
      .some((value) => value !== 0);
  }

  init(network: Network, scenario: Scenario): void {
    this.network = network;
    this.shares = expectedDemand(network, scenario).shares;
    this.decisions = network.junctions.map(({ id, phases }) => ({
      layout: layoutFor(network, id),
      features: new Float64Array(50),
      prior: new Float64Array(phases.length),
      learned: new Float64Array(phases.length),
      scores: new Float64Array(phases.length),
      current: 0,
      chosen: 0,
    }));
  }

  act(junctionId: number, sense: JunctionSense, neighbours: NeighbourSense): number {
    const decision = this.decisions[junctionId];
    const { layout, features, prior, learned, scores } = decision;
    const currentDirection = layout.directionOfPhase[sense.phase];
    scorePressure(
      this.network,
      junctionId,
      sense,
      this.shares,
      this.counts ? "count" : "area",
      this.hysteresis,
      prior,
    );
    if (!this.zeroOutput) {
      buildObservation(layout, sense, neighbours, features, this.counts, this.solo);
      this.inference.evaluate(features, this.output);
    }
    const scale = this.counts ? this.beta / COUNT_PRESSURE_SCALE : this.beta;
    for (let phase = 0; phase < scores.length; phase++) {
      const relativeDirection = (layout.directionOfPhase[phase] + 4 - currentDirection) % 4;
      prior[phase] *= scale;
      learned[phase] = this.zeroOutput ? 0 : this.output[relativeDirection];
      scores[phase] = prior[phase] + learned[phase];
    }
    decision.current = sense.phase;
    decision.chosen = bestPhase(scores, sense.phase);
    decision.sense = sense;
    return decision.chosen;
  }

  explain(junctionId: number): Explanation | undefined {
    const decision = this.decisions[junctionId];
    if (!decision.sense) return undefined;
    return {
      scores: Array.from(decision.scores),
      prior: Array.from(decision.prior),
      learned: Array.from(decision.learned),
      reason: this.reason(decision, decision.sense),
    };
  }

  private reason(decision: Decision, sense: JunctionSense): string {
    const { layout, features, prior, scores, chosen, current } = decision;
    const direction = layout.directionOfPhase[current];
    const holding = chosen === current;
    let strongest = -1;
    let effect = 1e-8;
    if (!this.zeroOutput && scores.length > 1) {
      let runnerUp = -Infinity;
      for (let phase = 0; phase < scores.length; phase++)
        if (phase !== chosen) runnerUp = Math.max(runnerUp, scores[phase]);
      const originalMargin = scores[chosen] - runnerUp;
      const chosenOutput = (layout.directionOfPhase[chosen] + 4 - direction) % 4;
      for (let rotation = 0; rotation < 4; rotation++) {
        if (layout.approaches[(direction + rotation) % 4] < 0) continue;
        this.occlusion.set(features);
        this.occlusion.fill(0, rotation * FEATURE_WIDTH, (rotation + 1) * FEATURE_WIDTH);
        this.occlusion.fill(
          0,
          NEIGHBOUR_OFFSET + rotation * 2,
          NEIGHBOUR_OFFSET + (rotation + 1) * 2,
        );
        this.inference.evaluate(this.occlusion, this.output);
        let competingScore = -Infinity;
        for (let phase = 0; phase < scores.length; phase++) {
          if (phase === chosen) continue;
          const output = (layout.directionOfPhase[phase] + 4 - direction) % 4;
          competingScore = Math.max(competingScore, prior[phase] + this.output[output]);
        }
        const influence = Math.abs(
          prior[chosen] + this.output[chosenOutput] - competingScore - originalMargin,
        );
        if (influence > effect) {
          strongest = (direction + rotation) % 4;
          effect = influence;
        }
      }
    }
    if (strongest >= 0)
      return describe(sense.approaches[layout.approaches[strongest]], DIRECTION_NAMES[strongest]);
    return holding ? "Holding the current green" : "Serving the highest net pressure";
  }
}
