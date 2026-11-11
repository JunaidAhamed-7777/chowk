import { DT } from "./constants";
import { type Arrival, DemandQueue, type DemandScenario, generateDemand } from "./demand";
import { Events, eventTicks, type ScheduledEvent, type SimEvent } from "./events";
import { StateHash } from "./hash";
import { JunctionTraffic } from "./junction-traffic";
import { LateralDynamics } from "./lateral";
import { LongitudinalDynamics } from "./longitudinal";
import { MetricAccumulator, type Metrics } from "./metrics";
import type { Network } from "./network";
import { type JunctionSense, Sensing } from "./sense";
import { SignalBank } from "./signals";
import { SnapshotWriter } from "./snapshots";
import { VehicleStore } from "./vehicles";

export interface Scenario extends DemandScenario {
  monsoon?: boolean;
  sensorNoise?: number;
  sensorDropout?: number;
  events?: readonly ScheduledEvent[];
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
  private demand: DemandQueue;
  private readonly events: Events;
  private readonly longitudinal: LongitudinalDynamics;
  private readonly lateral: LateralDynamics;
  private metricAccumulator: MetricAccumulator;
  private sensing: Sensing;
  private readonly snapshotWriter: SnapshotWriter;
  private readonly crossings: Uint32Array;
  private tick = 0;
  completed = 0;

  constructor(private readonly config: SimConfig) {
    const { network, scenario, seed, maxVehicles } = config;
    const demand = config.demand ?? generateDemand(network, scenario, seed);
    const accelerationScale = scenario.monsoon ? 0.8 : 1;
    const headwayScale = scenario.monsoon ? 1.2 : 1;
    this.vehicles = new VehicleStore(network.links.length + network.connectors.length, maxVehicles);
    this.signalBank = new SignalBank(network.junctions);
    this.events = new Events(network, seed);
    this.junctionTraffic = new JunctionTraffic(
      network,
      this.vehicles,
      this.signalBank,
      scenario.laneDisciplined,
      this.events,
    );
    this.demand = new DemandQueue(
      network,
      demand,
      scenario.monsoon ? 0.8 : 1,
      scenario.laneDisciplined,
    );
    this.longitudinal = new LongitudinalDynamics(
      this.vehicles,
      Math.max(...this.junctionTraffic.segments.map(({ strips }) => strips)),
      accelerationScale,
      headwayScale,
    );
    this.lateral = new LateralDynamics(
      network,
      this.vehicles,
      this.junctionTraffic,
      this.longitudinal,
      scenario.laneDisciplined === true,
      accelerationScale,
      headwayScale,
    );
    this.crossings = new Uint32Array(this.vehicles.capacity);
    this.metricAccumulator = new MetricAccumulator(network);
    this.sensing = new Sensing(network, this.vehicles, this.signalBank, {
      seed,
      noise: scenario.sensorNoise,
      dropout: scenario.sensorDropout,
    });
    this.snapshotWriter = new SnapshotWriter(network, this.vehicles, this.junctionTraffic);
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

  metrics(): Metrics {
    return this.metricAccumulator.read();
  }

  sense(junctionId: number): JunctionSense {
    return this.sensing.read(junctionId, this.tick);
  }

  inject(event: SimEvent): void {
    switch (event.type) {
      case "surge":
        this.demand.insert(this.events.surge(event, this.config.scenario));
        break;
      case "ambulance":
        this.demand.insert([this.events.ambulance(event)]);
        break;
      case "block":
        this.events.block(event);
        break;
      case "sensorFreeze":
        this.sensing.freeze(event.junction, this.tick, eventTicks(event.duration));
        break;
      case "outage":
        this.events.outage(event.junction, event.duration);
        break;
    }
  }

  writeSnapshot(out: Float32Array): number {
    return this.snapshotWriter.write(out);
  }

  signals(): Uint8Array {
    const { phase, state } = this.signalBank;
    const output = new Uint8Array(2 * phase.length);
    for (let junction = 0; junction < phase.length; junction++) {
      output[2 * junction] = phase[junction];
      output[2 * junction + 1] = state[junction];
    }
    return output;
  }

  hash(): number {
    const hash = new StateHash();
    const { phase, state, elapsedTicks, targetPhase } = this.signalBank;
    hash.addUint32(this.tick).addUint32(this.completed).addUint32(this.backstops);
    this.vehicles.writeHash(hash);
    this.junctionTraffic.writeHash(hash);
    this.demand.writeHash(hash);
    this.events.writeHash(hash);
    this.sensing.writeHash(hash, this.tick);
    for (let id = 0; id < phase.length; id++) {
      hash
        .addUint32(phase[id])
        .addUint32(state[id])
        .addUint32(elapsedTicks[id])
        .addUint32(targetPhase[id]);
    }
    const metrics = this.metrics();
    hash
      .addUint32(metrics.stops)
      .addUint32(metrics.maxBacklog)
      .addUint32(metrics.ambulanceCompleted)
      .addMilli(metrics.completedPeople)
      .addMilli(metrics.personDelay)
      .addMilli(metrics.vehicleDelay)
      .addMilli(metrics.travelTime)
      .addMilli(metrics.queueAreaSeconds)
      .addMilli(metrics.fuelJoules)
      .addMilli(metrics.co2Kg)
      .addMilli(metrics.ambulanceTravelTime);
    hash
      .addMilli(metrics.ambulanceDelay)
      .addMilli(metrics.busPassengerDelay)
      .addMilli(metrics.carPassengerDelay)
      .addMilli(metrics.starvationSeconds)
      .addMilli(metrics.longWaitSeconds)
      .addMilli(metrics.maxWait);
    return hash.digest();
  }

  clone(): TrafficSim {
    const copy = new TrafficSim({ ...this.config, demand: [] });
    copy.tick = this.tick;
    copy.completed = this.completed;
    copy.longitudinal.backstops = this.longitudinal.backstops;
    copy.vehicles.copyFrom(this.vehicles);
    copy.junctionTraffic.copyFrom(this.junctionTraffic);
    copy.demand = this.demand.clone();
    copy.events.copyFrom(this.events);
    copy.metricAccumulator = this.metricAccumulator.copy();
    copy.signalBank.phase.set(this.signalBank.phase);
    copy.signalBank.state.set(this.signalBank.state);
    copy.signalBank.elapsedTicks.set(this.signalBank.elapsedTicks);
    copy.signalBank.targetPhase.set(this.signalBank.targetPhase);
    copy.sensing = this.sensing.copy(copy.vehicles, copy.signalBank);
    return copy;
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
    this.events.tick = this.tick;
    junctionTraffic.readOccupancy();
    signalBank.step(junctionTraffic.canOpen, this.events.isOutage);
    demand.advance(this.tick, vehicles, this.events.entryObstacle);
    junctionTraffic.prepareAdmissions();
    for (const segment of segments) {
      if (vehicles.counts[segment.id] === 0) continue;
      longitudinal.updateAccelerations(segment.id, speedLimits[segment.id], obstacle);
    }
    this.lateral.step(this.tick);
    let crossingCount = 0;
    for (const segment of segments) {
      if (vehicles.counts[segment.id] === 0) continue;
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
        this.metricAccumulator.recordExit(vehicles, slot, this.time);
        vehicles.remove(slot);
        this.completed++;
      }
    }
    this.metricAccumulator.recordTick(vehicles, demand);
  }
}

export function createSim(config: SimConfig): TrafficSim {
  return new TrafficSim(config);
}
