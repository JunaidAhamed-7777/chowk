import type { JunctionSense, Network, Scenario } from "@chowk/sim";
import { expectedDemand, type TurnShare } from "./demand";
import tunedHysteresis from "./tuned-hysteresis.json";
import type { BaselineId, Controller, Explanation } from "./types";

export const AREA_HYSTERESIS = tunedHysteresis.area;
export const COUNT_HYSTERESIS = tunedHysteresis.count;
export type PressureBasis = "area" | "count";

export function bestPhase(scores: ArrayLike<number>, current: number): number {
  let best = current;
  for (let phase = 0; phase < scores.length; phase++) {
    if (scores[phase] > scores[best]) best = phase;
  }
  return best;
}

export function scorePressure(
  network: Network,
  junctionId: number,
  sense: JunctionSense,
  shares: readonly (readonly TurnShare[])[],
  basis: PressureBasis,
  hysteresis: number,
  scores: Float64Array,
): void {
  const junction = network.junctions[junctionId];
  for (let phase = 0; phase < junction.phases.length; phase++) {
    let score = phase === sense.phase ? hysteresis : 0;
    for (const link of junction.phases[phase].approaches) {
      const observation = sense.approaches[junction.approaches.indexOf(link)];
      const near = Math.min(network.links[link].length, 60);
      const mid = Math.min(network.links[link].length, 150) - near;
      score +=
        basis === "count"
          ? observation.count
          : (observation.areaNear * near + observation.areaMid * mid) / (near + mid);
      for (const exit of observation.exits) {
        const share = shares[link].find(({ link: id }) => id === exit.link)?.share ?? 0;
        score -= share * (basis === "count" ? exit.count : exit.area);
      }
    }
    scores[phase] = score;
  }
}

export class MaxPressure implements Controller {
  readonly id: Extract<BaselineId, "mp-area" | "mp-count">;
  private network!: Network;
  private shares: TurnShare[][] = [];
  private scores: Float64Array[] = [];
  private reasons: string[] = [];

  constructor(
    private readonly basis: PressureBasis,
    private readonly hysteresis: number,
  ) {
    this.id = basis === "area" ? "mp-area" : "mp-count";
  }

  init(network: Network, scenario: Scenario): void {
    this.network = network;
    this.shares = expectedDemand(network, scenario).shares;
    this.scores = network.junctions.map(({ phases }) => new Float64Array(phases.length));
    this.reasons = network.junctions.map(() => "Waiting for the first observation");
  }

  act(junctionId: number, sense: JunctionSense): number {
    const scores = this.scores[junctionId];
    scorePressure(
      this.network,
      junctionId,
      sense,
      this.shares,
      this.basis,
      this.hysteresis,
      scores,
    );
    const phase = bestPhase(scores, sense.phase);
    this.reasons[junctionId] =
      phase === sense.phase ? "Holding the current green" : "Serving the highest net pressure";
    return phase;
  }

  explain(junctionId: number): Explanation {
    return { scores: Array.from(this.scores[junctionId]), reason: this.reasons[junctionId] };
  }
}
