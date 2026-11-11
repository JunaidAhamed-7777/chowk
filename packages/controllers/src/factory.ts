import type { JunctionSense, Network, Scenario } from "@chowk/sim";
import { Actuated } from "./actuated";
import { ResidualPolicy } from "./policy/controller";
import { decodePolicy, generationZero } from "./policy/weights";
import { AREA_HYSTERESIS, COUNT_HYSTERESIS, MaxPressure } from "./pressure";
import type {
  Controller,
  ControllerId,
  ControllerOptions,
  Explanation,
  NeighbourSense,
} from "./types";
import { Webster } from "./webster";

class Preemption implements Controller {
  private network!: Network;
  private overrides: boolean[] = [];

  constructor(
    readonly id: Extract<ControllerId, `${string}+preempt`>,
    private readonly baseline: Controller,
  ) {}

  init(network: Network, scenario: Scenario): void {
    this.network = network;
    this.overrides = network.junctions.map(() => false);
    this.baseline.init(network, scenario);
  }

  act(junctionId: number, sense: JunctionSense, neighbours: NeighbourSense): number {
    const baseline = this.baseline.act(junctionId, sense, neighbours);
    const junction = this.network.junctions[junctionId];
    let emergency = -1;
    let waited = -Infinity;
    for (let approach = 0; approach < sense.approaches.length; approach++) {
      const reading = sense.approaches[approach];
      if (reading.emergency && reading.waitMax > waited) {
        emergency = approach;
        waited = reading.waitMax;
      }
    }
    const phase =
      emergency < 0
        ? -1
        : junction.phases.findIndex(({ approaches }) =>
            approaches.includes(junction.approaches[emergency]),
          );
    this.overrides[junctionId] = phase >= 0;
    return phase >= 0 ? phase : baseline;
  }

  explain(junctionId: number): Explanation | undefined {
    const baseline = this.baseline.explain?.(junctionId);
    return this.overrides[junctionId]
      ? { ...baseline, scores: baseline?.scores ?? [], reason: "Serving an approaching ambulance" }
      : baseline;
  }
}

export function createController(id: ControllerId, options: ControllerOptions = {}): Controller {
  const { saturation, policy, parameters, hysteresis } = options;
  if (hysteresis !== undefined && (!Number.isFinite(hysteresis) || hysteresis < 0))
    throw new RangeError("Hysteresis must be finite and non-negative");
  switch (id) {
    case "webster":
      if (!saturation) throw new TypeError("Webster requires measured saturation flows");
      return new Webster(saturation);
    case "actuated":
      return new Actuated();
    case "mp-area":
      return new MaxPressure("area", hysteresis ?? AREA_HYSTERESIS);
    case "mp-count":
      return new MaxPressure("count", hysteresis ?? COUNT_HYSTERESIS);
    case "webster+preempt":
      return new Preemption(id, createController("webster", options));
    case "actuated+preempt":
      return new Preemption(id, createController("actuated", options));
    case "mp-area+preempt":
      return new Preemption(id, createController("mp-area", options));
    case "mp-count+preempt":
      return new Preemption(id, createController("mp-count", options));
    case "chowk":
    case "chowk-vehicle":
    case "chowk-count":
    case "chowk-pure":
    case "chowk-solo":
      return new ResidualPolicy(
        id,
        parameters ?? (policy ? decodePolicy(policy) : generationZero()),
        hysteresis ?? (id === "chowk-count" ? COUNT_HYSTERESIS : AREA_HYSTERESIS),
      );
  }
  throw new RangeError(`Unknown controller ${id}`);
}
