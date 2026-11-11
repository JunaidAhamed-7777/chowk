import {
  CO2_KG_PER_JOULE,
  DT,
  EMERGENCY_CLASS,
  FUEL_MODEL,
  MOVING_SPEED_THRESHOLD,
  QUEUE_SPEED_THRESHOLD,
  QUEUE_ZONE_METRES,
  STOP_SPEED_THRESHOLD,
  VEHICLE_CLASSES,
} from "./constants";
import type { Network } from "./network";
import type { VehicleStore } from "./vehicles";

interface DemandCounts {
  readonly generated: number;
  readonly generatedPeople: number;
  readonly backlog: number;
  readonly backlogPeople: number;
}

export interface Metrics {
  elapsed: number;
  generated: number;
  generatedPeople: number;
  completed: number;
  completedPeople: number;
  inNetwork: number;
  backlog: number;
  maxBacklog: number;
  backlogVehicleSeconds: number;
  personDelay: number;
  vehicleDelay: number;
  stops: number;
  travelTime: number;
  /** Integral of the sum of stopped-area fractions across approaches, in seconds. */
  queueAreaSeconds: number;
  fuelJoules: number;
  co2Kg: number;
  ambulanceCompleted: number;
  ambulanceTravelTime: number;
  lastAmbulanceTravelTime: number | null;
}

export class MetricAccumulator {
  private readonly zoneStart: Float64Array;
  private readonly areaScale: Float64Array;
  private readonly totals: Metrics = {
    elapsed: 0,
    generated: 0,
    generatedPeople: 0,
    completed: 0,
    completedPeople: 0,
    inNetwork: 0,
    backlog: 0,
    maxBacklog: 0,
    backlogVehicleSeconds: 0,
    personDelay: 0,
    vehicleDelay: 0,
    stops: 0,
    travelTime: 0,
    queueAreaSeconds: 0,
    fuelJoules: 0,
    co2Kg: 0,
    ambulanceCompleted: 0,
    ambulanceTravelTime: 0,
    lastAmbulanceTravelTime: null,
  };

  constructor(private readonly network: Network) {
    this.zoneStart = new Float64Array(network.links.length);
    this.areaScale = new Float64Array(network.links.length);
    for (const junction of network.junctions) {
      for (const approach of junction.approaches) {
        const link = network.links[approach];
        const zoneLength = Math.min(link.length, QUEUE_ZONE_METRES);
        this.zoneStart[approach] = link.length - zoneLength;
        this.areaScale[approach] = 1 / (zoneLength * link.strips * network.stripWidth);
      }
    }
  }

  recordTick(vehicles: VehicleStore, demand: DemandCounts): void {
    const totals = this.totals;
    totals.elapsed += DT;
    totals.generated = demand.generated;
    totals.generatedPeople = demand.generatedPeople;
    totals.inNetwork = vehicles.count;
    totals.backlog = demand.backlog;
    totals.maxBacklog = Math.max(totals.maxBacklog, demand.backlog);
    totals.backlogVehicleSeconds += demand.backlog * DT;
    totals.personDelay += demand.backlogPeople * DT;
    totals.vehicleDelay += demand.backlog * DT;

    let queueArea = 0;
    for (let segment = 0; segment < vehicles.byLink.length; segment++) {
      const list = vehicles.byLink[segment];
      const count = vehicles.counts[segment];
      const scale = this.areaScale[segment] ?? 0;
      for (let index = 0; index < count; index++) {
        const slot = list[index];
        this.recordVehicle(vehicles, slot);
        if (scale > 0 && vehicles.v[slot] < QUEUE_SPEED_THRESHOLD) {
          const vehicle = VEHICLE_CLASSES[vehicles.cls[slot]];
          const front = Math.min(vehicles.s[slot], this.network.links[segment].length);
          const rear = Math.max(vehicles.s[slot] - vehicle.length, this.zoneStart[segment]);
          queueArea += Math.max(0, front - rear) * vehicle.width * scale;
        }
      }
    }
    totals.queueAreaSeconds += queueArea * DT;
  }

  recordExit(vehicles: VehicleStore, slot: number, time: number): void {
    // Exiting slots are removed before the end-of-tick scan, so charge this tick here.
    this.recordVehicle(vehicles, slot);
    const totals = this.totals;
    const travelTime = time - vehicles.tEnter[slot];
    totals.completed++;
    totals.completedPeople += vehicles.occ[slot];
    totals.travelTime += travelTime;
    if (vehicles.cls[slot] === EMERGENCY_CLASS) {
      totals.ambulanceCompleted++;
      totals.ambulanceTravelTime += travelTime;
      totals.lastAmbulanceTravelTime = travelTime;
    }
  }

  read(): Metrics {
    return { ...this.totals };
  }

  copy(): MetricAccumulator {
    const copy = new MetricAccumulator(this.network);
    Object.assign(copy.totals, this.totals);
    return copy;
  }

  private recordVehicle(vehicles: VehicleStore, slot: number): void {
    const totals = this.totals;
    const speed = vehicles.v[slot];
    const delay = DT * (1 - speed / vehicles.v0[slot]);
    vehicles.delay[slot] += delay;
    totals.vehicleDelay += delay;
    totals.personDelay += delay * vehicles.occ[slot];

    if (speed > MOVING_SPEED_THRESHOLD) {
      vehicles.moving[slot] = 1;
    } else if (speed < STOP_SPEED_THRESHOLD && vehicles.moving[slot] === 1) {
      vehicles.moving[slot] = 0;
      vehicles.stops[slot]++;
      totals.stops++;
    }

    const cls = vehicles.cls[slot];
    const fuel = FUEL_MODEL[cls];
    const energy =
      DT * (fuel.idle + speed * (fuel.cruise + fuel.acceleration * Math.max(0, vehicles.a[slot])));
    totals.fuelJoules += energy;
    totals.co2Kg += energy * CO2_KG_PER_JOULE[VEHICLE_CLASSES[cls].fuel];
  }
}
