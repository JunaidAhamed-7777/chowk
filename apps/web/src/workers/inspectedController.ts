import type { Controller, Explanation, NeighbourSense } from "@chowk/controllers";
import {
  buildObservation,
  layoutFor,
  type ObservationLayout,
} from "@chowk/controllers/observation";
import type { JunctionSense, Network, Scenario } from "@chowk/sim";

interface Reading {
  layout: ObservationLayout;
  vector: Float64Array;
  available: boolean;
}

export class InspectedController implements Controller {
  readonly id: Controller["id"];
  enabled = false;
  private readings: Reading[] = [];

  constructor(private readonly controller: Controller) {
    this.id = controller.id;
  }

  init(network: Network, scenario: Scenario): void {
    this.controller.init(network, scenario);
    this.readings = this.id.startsWith("chowk")
      ? network.junctions.map(({ id }) => ({
          layout: layoutFor(network, id),
          vector: new Float64Array(50),
          available: false,
        }))
      : [];
  }

  act(junction: number, sense: JunctionSense, neighbours: NeighbourSense): number {
    const phase = this.controller.act(junction, sense, neighbours);
    const reading = this.readings[junction];
    if (this.enabled && reading) {
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
    return phase;
  }

  explain(junction: number): Explanation | undefined {
    return this.controller.explain?.(junction);
  }

  observation(junction: number): number[] | undefined {
    const reading = this.readings[junction];
    return reading?.available ? Array.from(reading.vector) : undefined;
  }
}
