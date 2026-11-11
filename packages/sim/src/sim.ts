import { DT } from "./constants";
import { type Arrival, DemandQueue, type DemandScenario, generateDemand } from "./demand";
import { JunctionTraffic } from "./junction-traffic";
import { LongitudinalDynamics } from "./longitudinal";
import type { Network } from "./network";
import { SignalBank } from "./signals";
import { VehicleStore } from "./vehicles";

export interface Scenario extends DemandScenario {
  monsoon?: boolean;
  laneDisciplined?: boolean;
}

export interface SimConfig {
  network: Network;
  scenario: Scenario;
  seed: number;
  demand?: readonly Arrival[];
  maxVehicles?: number;
}

export class TrafficSim {
  readonly vehicles: VehicleStore;
  readonly signalBank: SignalBank;
  readonly junctionTraffic: JunctionTraffic;
  readonly demand: DemandQueue;
  private readonly longitudinal: LongitudinalDynamics;
  private readonly crossings: Uint32Array;
  private tick = 0;
  completed = 0;

  constructor(config: SimConfig) {
    const { network, scenario, seed, maxVehicles } = config;
    const demand = config.demand ?? generateDemand(network, scenario, seed);
    this.vehicles = new VehicleStore(network.links.length + network.connectors.length, maxVehicles);
    this.signalBank = new SignalBank(network.junctions);
    this.junctionTraffic = new JunctionTraffic(network, this.vehicles, this.signalBank);
    this.demand = new DemandQueue(network, demand, scenario.monsoon ? 0.8 : 1);
    this.longitudinal = new LongitudinalDynamics(
      this.vehicles,
      Math.max(...this.junctionTraffic.segments.map(({ strips }) => strips)),
      scenario.monsoon ? 0.8 : 1,
      scenario.monsoon ? 1.2 : 1,
    );
    this.crossings = new Uint32Array(this.vehicles.capacity);
  }

  get time(): number {
    return this.tick * DT;
  }

  get backstops(): number {
    return this.longitudinal.backstops;
  }

  requestPhase(junctionId: number, phase: number): void {
    this.signalBank.requestPhase(junctionId, phase);
  }

  step(count = 1): void {
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new RangeError("Step count must be a non-negative integer");
    }
    for (let iteration = 0; iteration < count; iteration++) {
      this.stepOnce();
    }
  }

  private stepOnce(): void {
    const { crossings, demand, junctionTraffic, longitudinal, signalBank, vehicles } = this;
    const { segments, speedLimits, obstacle } = junctionTraffic;
    this.tick++;
    junctionTraffic.readOccupancy();
    signalBank.step(junctionTraffic.canOpen);
    demand.advance(this.tick, vehicles);
    junctionTraffic.prepareAdmissions();
    for (const segment of segments) {
      longitudinal.updateAccelerations(segment.id, speedLimits[segment.id], obstacle);
    }
    let crossingCount = 0;
    for (const segment of segments) {
      longitudinal.integrate(segment.id, segment.strips, obstacle);
      const list = vehicles.byLink[segment.id];
      for (let index = 0; index < vehicles.counts[segment.id]; index++) {
        const slot = list[index];
        if (vehicles.s[slot] <= segment.length) break;
        crossings[crossingCount++] = slot;
      }
    }
    for (let index = 0; index < crossingCount; index++) {
      const slot = crossings[index];
      if (!junctionTraffic.transition(slot, vehicles.link[slot])) {
        vehicles.remove(slot);
        this.completed++;
      }
    }
  }
}

export function createSim(config: SimConfig): TrafficSim {
  return new TrafficSim(config);
}
