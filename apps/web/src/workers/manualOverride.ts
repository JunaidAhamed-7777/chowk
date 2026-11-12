import type { Controller, Explanation, NeighbourSense } from "@chowk/controllers";
import type { JunctionSense, Network, Scenario } from "@chowk/sim";

/**
 * Lets a visitor run one junction by hand in "Beat the AI". The wrapped controller still
 * acts every decision, so its state stays current; only the chosen junction's request is
 * replaced. The same minimum green, clearance and starvation rules apply to the visitor.
 */
export class ManualOverride implements Controller {
  readonly id: Controller["id"];
  junction = -1;
  phase = -1;

  constructor(private readonly controller: Controller) {
    this.id = controller.id;
  }

  init(network: Network, scenario: Scenario): void {
    this.controller.init(network, scenario);
  }

  act(junction: number, sense: JunctionSense, neighbours: NeighbourSense): number {
    const phase = this.controller.act(junction, sense, neighbours);
    return junction === this.junction && this.phase >= 0 ? this.phase : phase;
  }

  explain(junction: number): Explanation | undefined {
    if (junction === this.junction && this.phase >= 0)
      return { scores: [], reason: "Signal set by the visitor" };
    return this.controller.explain?.(junction);
  }
}
