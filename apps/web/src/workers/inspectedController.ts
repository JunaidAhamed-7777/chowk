import type { Controller, Explanation, NeighbourSense } from "@chowk/controllers";
import {
  buildObservation,
  layoutFor,
  type ObservationLayout,
} from "@chowk/controllers/observation";
import type { JunctionSense, Network, Scenario } from "@chowk/sim";
import type { DecisionRecord } from "../sim/protocol";

interface Reading {
  layout?: ObservationLayout;
  vector: Float64Array;
  available: boolean;
  decision?: DecisionRecord;
}

/**
 * Wraps the live controller so the interface can show exactly what it saw at its last decision.
 * Only reads inputs and outputs; the wrapped controller's behaviour is unchanged.
 */
export class InspectedController implements Controller {
  readonly id: Controller["id"];
  enabled = false;
  private readings: Reading[] = [];

  constructor(private readonly controller: Controller) {
    this.id = controller.id;
  }

  init(network: Network, scenario: Scenario): void {
    this.controller.init(network, scenario);
    const learned = this.id.startsWith("chowk");
    this.readings = network.junctions.map(({ id }) => ({
      layout: learned ? layoutFor(network, id) : undefined,
      vector: new Float64Array(50),
      available: false,
    }));
  }

  act(junction: number, sense: JunctionSense, neighbours: NeighbourSense): number {
    const phase = this.controller.act(junction, sense, neighbours);
    const reading = this.readings[junction];
    if (this.enabled && reading) {
      // The driver reads a fresh sense object for every decision, so keeping the reference is safe.
      reading.decision = { time: neighbours.time, sense, requested: phase };
      if (reading.layout) {
        buildObservation(
          reading.layout,
          sense,
          neighbours,
          reading.vector,
          this.id === "chowk-count",
          this.id === "chowk-solo",
        );
        reading.available = true;
      }
    }
    return phase;
  }

  explain(junction: number): Explanation | undefined {
    return this.controller.explain?.(junction);
  }

  observation(junction: number): number[] | undefined {
    const reading = this.readings[junction];
    return reading?.available ? Array.from(reading.vector) : undefined;
  }

  decision(junction: number): DecisionRecord | undefined {
    return this.readings[junction]?.decision;
  }
}
