import type { JunctionSense, Network } from "@chowk/sim";
import type { Controller, Explanation } from "./types";

const EXTEND_THRESHOLD = 0.025;

export class Actuated implements Controller {
  readonly id = "actuated";
  private network!: Network;
  private reasons: string[] = [];

  init(network: Network): void {
    this.network = network;
    this.reasons = network.junctions.map(() => "Waiting for the first observation");
  }

  act(junctionId: number, sense: JunctionSense): number {
    const junction = this.network.junctions[junctionId];
    const approach = (phase: number) =>
      sense.approaches[junction.approaches.indexOf(junction.phases[phase].approaches[0])];
    if (sense.elapsed < junction.maxGreen && approach(sense.phase).areaNear >= EXTEND_THRESHOLD) {
      this.reasons[junctionId] = "Extending green while traffic arrives";
      return sense.phase;
    }
    for (let advance = 1; advance < junction.phases.length; advance++) {
      const phase = (sense.phase + advance) % junction.phases.length;
      if (approach(phase).count > 0) {
        this.reasons[junctionId] = "Advancing to the next occupied approach";
        return phase;
      }
    }
    this.reasons[junctionId] = "Holding while other approaches are clear";
    return sense.phase;
  }

  explain(junctionId: number): Explanation {
    return { scores: [], reason: this.reasons[junctionId] };
  }
}
