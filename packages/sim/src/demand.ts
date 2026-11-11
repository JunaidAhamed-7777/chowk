import {
  CARS_ONLY_MIX,
  DEFAULT_MIX,
  DT,
  LANE_STRIPS,
  MAX_VEHICLE_LENGTH,
  VEHICLE_CLASSES,
} from "./constants";
import type { StateHash } from "./hash";
import { constrain, type Leader, shareStrip } from "./longitudinal";
import type { Link, Network } from "./network";
import { createRandomStreams, type Random } from "./random";
import type { VehicleSpawn, VehicleStore } from "./vehicles";

export interface RatePoint {
  readonly t: number;
  readonly rate: number;
}

export interface RouteShare {
  readonly route: number;
  readonly weight: number;
}

export interface SourceDemand {
  readonly source: number;
  readonly rates: readonly RatePoint[];
  readonly routes: readonly RouteShare[];
}

export interface DemandScenario {
  readonly duration: number;
  readonly mix?: readonly number[];
  readonly laneDisciplined?: boolean;
  readonly sources: readonly SourceDemand[];
}

export interface Arrival {
  readonly t: number;
  readonly source: number;
  readonly cls: number;
  readonly route: number;
  readonly v0Factor: number;
  readonly strip: number;
}

export type EntryObstacle = (
  link: number,
  strip: number,
  width: number,
  offset: number,
  leader: Leader,
) => void;

function nextHazard(random: Random): number {
  let uniform = (random.nextUint32() + 0.5) / 0x1_0000_0000;
  let logOffset = 0;
  while (uniform < 1) {
    uniform *= 2;
    logOffset += Math.LN2;
  }
  // Range reduction puts the series argument in [0, 1/3), giving a fixed, portable log.
  const x = (uniform - 1) / (uniform + 1);
  const squared = x * x;
  let power = x;
  let sum = 0;
  for (let denominator = 1; denominator < 26; denominator += 2) {
    sum += power / denominator;
    power *= squared;
  }
  return logOffset - 2 * sum;
}

function cumulativeWeights(weights: readonly number[], label: string): number[] {
  let total = 0;
  const cumulative = weights.map((weight) => {
    if (!Number.isFinite(weight) || weight < 0) throw new RangeError(`Invalid ${label} weight`);
    total += weight;
    return total;
  });
  if (!Number.isFinite(total) || total === 0)
    throw new RangeError(`${label} needs positive weight`);
  return cumulative;
}

function choose(cumulative: readonly number[], random: Random): number {
  const sample = random.next() * cumulative[cumulative.length - 1];
  for (let index = 0; index < cumulative.length; index++) {
    if (sample < cumulative[index]) return index;
  }
  // A subnormal or very large total can round the final product up to the total.
  for (let index = cumulative.length - 1; index > 0; index--) {
    if (cumulative[index] > cumulative[index - 1]) return index;
  }
  return 0;
}

function validateRates(rates: readonly RatePoint[], duration: number): void {
  if (rates[0]?.t !== 0) throw new RangeError("A demand rate profile must start at zero seconds");
  let previousTime = -1;
  for (const { t, rate } of rates) {
    if (!Number.isFinite(t) || t <= previousTime || t > duration) {
      throw new RangeError("Demand rate times must increase within the episode");
    }
    if (!Number.isFinite(rate) || rate < 0 || !Number.isFinite(rate * duration)) {
      throw new RangeError("Demand rates must be finite and non-negative");
    }
    previousTime = t;
  }
}

export function generateDemand(
  network: Network,
  scenario: DemandScenario,
  seed: number,
): Arrival[] {
  const { duration, laneDisciplined } = scenario;
  const mix = laneDisciplined ? CARS_ONLY_MIX : (scenario.mix ?? DEFAULT_MIX);
  const stripStride = laneDisciplined ? LANE_STRIPS : 1;
  if (!Number.isFinite(duration) || duration <= 0) throw new RangeError("Invalid demand duration");
  if (mix.length !== VEHICLE_CLASSES.length) throw new RangeError("Invalid vehicle mix length");
  const classWeights = cumulativeWeights(mix, "Vehicle mix");
  const random = createRandomStreams(seed).demand;
  const arrivals: Arrival[] = [];
  const sources: (SourceDemand | undefined)[] = Array.from({ length: network.sources.length });
  for (const source of scenario.sources) {
    if (!network.sources[source.source] || sources[source.source]) {
      throw new RangeError(`Unknown or duplicate demand source ${source.source}`);
    }
    sources[source.source] = source;
  }

  for (let source = 0; source < sources.length; source++) {
    const profile = sources[source];
    if (!profile) continue;
    const { rates, routes } = profile;
    const link = network.links[network.sources[source].link];
    for (let cls = 0; cls < mix.length; cls++) {
      if (mix[cls] > 0 && VEHICLE_CLASSES[cls].strips > link.strips) {
        throw new RangeError(`Source ${source} is too narrow for vehicle class ${cls}`);
      }
    }
    validateRates(rates, duration);
    const routeWeights = cumulativeWeights(
      routes.map(({ route, weight }) => {
        if (network.routes[route]?.source !== source) {
          throw new RangeError(`Route ${route} does not originate at source ${source}`);
        }
        return weight;
      }),
      "Route shares",
    );

    let remainingHazard = nextHazard(random);
    for (let index = 0; index < rates.length; index++) {
      const start = rates[index];
      const end = rates[index + 1] ?? { t: duration, rate: start.rate };
      if (end.t <= start.t) break;
      const slope = (end.rate - start.rate) / (end.t - start.t);
      let t = start.t;
      let rate = start.rate;
      let availableHazard = (rate / 2 + end.rate / 2) * (end.t - t);
      while (remainingHazard < availableHazard) {
        // Invert the integral of the linear rate. This form is stable on flat segments.
        const arrivalRate = Math.sqrt(Math.max(0, rate * rate + 2 * slope * remainingHazard));
        const nextTime = t + (2 * remainingHazard) / (rate + arrivalRate);
        if (nextTime >= end.t) break;
        if (!Number.isFinite(nextTime) || (nextTime === t && remainingHazard > 0)) {
          throw new RangeError("Demand rate exceeds time resolution");
        }
        t = nextTime;
        rate = arrivalRate;
        const cls = choose(classWeights, random);
        const route = routes[choose(routeWeights, random)].route;
        const v0Factor = 0.9 + 0.2 * random.next();
        const placements =
          Math.floor((link.strips - VEHICLE_CLASSES[cls].strips) / stripStride) + 1;
        const strip = Math.floor(random.next() * placements) * stripStride;
        arrivals.push({ t, source, cls, route, v0Factor, strip });
        remainingHazard = nextHazard(random);
        availableHazard = (rate / 2 + end.rate / 2) * (end.t - t);
      }
      remainingHazard = Math.max(0, remainingHazard - availableHazard);
    }
  }
  arrivals.sort((first, second) => first.t - second.t || first.source - second.source);
  return arrivals;
}

export class DemandQueue {
  private readonly heads: Int32Array;
  private readonly tails: Int32Array;
  private arrivals: Arrival[];
  private order: number[];
  private baseArrivalCount: number;
  private next: Int32Array;
  private readonly leader: Leader = { rear: Infinity, speed: 0 };
  private readonly spawn: VehicleSpawn = {
    link: 0,
    s: 0,
    strip: 0,
    lat: 0,
    v: 0,
    cls: 0,
    route: 0,
    v0: 0,
    occ: 0,
    tEnter: 0,
  };
  generated = 0;
  generatedPeople = 0;
  backlog = 0;
  backlogPeople = 0;
  readonly backlogByClass = new Uint32Array(VEHICLE_CLASSES.length);

  constructor(
    private readonly network: Network,
    arrivals: readonly Arrival[],
    private readonly speedScale = 1,
    private readonly laneDisciplined = false,
  ) {
    this.heads = new Int32Array(network.sources.length).fill(-1);
    this.tails = new Int32Array(network.sources.length).fill(-1);
    this.arrivals = Array.from(arrivals);
    this.order = arrivals.map((_, index) => index);
    this.baseArrivalCount = arrivals.length;
    this.next = new Int32Array(arrivals.length).fill(-1);
    let previousTime = 0;
    for (const arrival of arrivals) {
      const source = network.sources[arrival.source];
      const vehicle = VEHICLE_CLASSES[arrival.cls];
      if (
        !source ||
        !vehicle ||
        !Number.isFinite(arrival.t) ||
        arrival.t < previousTime ||
        network.routes[arrival.route]?.source !== arrival.source ||
        !Number.isFinite(arrival.v0Factor) ||
        arrival.v0Factor <= 0 ||
        !Number.isInteger(arrival.strip) ||
        arrival.strip < 0 ||
        arrival.strip + vehicle.strips > network.links[source.link].strips
      ) {
        throw new RangeError("Invalid or unsorted demand arrival");
      }
      previousTime = arrival.t;
    }
  }

  insert(arrivals: readonly Arrival[]): void {
    if (arrivals.length === 0) return;
    const next = new Int32Array(this.arrivals.length + arrivals.length).fill(-1);
    next.set(this.next);
    this.next = next;
    for (const arrival of arrivals) {
      this.order.push(this.arrivals.length);
      this.arrivals.push(arrival);
    }
    const future = this.order.slice(this.generated);
    future.sort((first, second) => {
      const a = this.arrivals[first];
      const b = this.arrivals[second];
      return a.t - b.t || a.source - b.source || first - second;
    });
    for (let index = 0; index < future.length; index++)
      this.order[this.generated + index] = future[index];
  }

  advance(tick: number, vehicles: VehicleStore, obstacle?: EntryObstacle): void {
    const time = tick * DT;
    while (
      this.generated < this.order.length &&
      this.arrivals[this.order[this.generated]].t <= time
    ) {
      const index = this.order[this.generated++];
      const { source, cls } = this.arrivals[index];
      const tail = this.tails[source];
      if (tail < 0) this.heads[source] = index;
      else this.next[tail] = index;
      this.tails[source] = index;
      const occupancy = VEHICLE_CLASSES[cls].occupancy;
      this.backlog++;
      this.backlogByClass[cls]++;
      this.backlogPeople += occupancy;
      this.generatedPeople += occupancy;
    }
    if (this.backlog === 0) return;

    for (let source = 0; source < this.heads.length; source++) {
      const link = this.network.links[this.network.sources[source].link];
      let previous = -1;
      let index = this.heads[source];
      let blockedClasses = 0;
      while (index >= 0 && vehicles.count < vehicles.capacity) {
        const arrival = this.arrivals[index];
        const next = this.next[index];
        const classMask = 1 << arrival.cls;
        if (
          !(blockedClasses & classMask) &&
          this.trySpawn(arrival, link, time, vehicles, obstacle)
        ) {
          if (previous < 0) this.heads[source] = next;
          else this.next[previous] = next;
          if (next < 0) this.tails[source] = previous;
          this.backlog--;
          this.backlogByClass[arrival.cls]--;
          this.backlogPeople -= VEHICLE_CLASSES[arrival.cls].occupancy;
        } else {
          // A failed attempt covered every strip. More spawns can only reduce the available space.
          blockedClasses |= classMask;
          previous = index;
        }
        index = next;
      }
    }
    if (this.backlog === 0) this.backlogPeople = 0;
  }

  clone(): DemandQueue {
    const copy = new DemandQueue(this.network, [], this.speedScale, this.laneDisciplined);
    copy.heads.set(this.heads);
    copy.tails.set(this.tails);
    copy.arrivals = this.arrivals.slice();
    copy.order = this.order.slice();
    copy.baseArrivalCount = this.baseArrivalCount;
    copy.next = this.next.slice();
    copy.backlogByClass.set(this.backlogByClass);
    copy.generated = this.generated;
    copy.generatedPeople = this.generatedPeople;
    copy.backlog = this.backlog;
    copy.backlogPeople = this.backlogPeople;
    return copy;
  }

  writeHash(hash: StateHash): void {
    hash.addUint32(this.generated).addUint32(this.backlog).addMilli(this.backlogPeople);
    for (let source = 0; source < this.heads.length; source++) {
      for (let index = this.heads[source]; index >= 0; index = this.next[index]) {
        hash.addUint32(index);
        this.writeAddedArrival(hash, index);
      }
    }
    for (let cursor = this.generated; cursor < this.order.length; cursor++) {
      this.writeAddedArrival(hash, this.order[cursor]);
    }
  }

  private writeAddedArrival(hash: StateHash, index: number): void {
    if (index < this.baseArrivalCount) return;
    const arrival = this.arrivals[index];
    hash
      .addMilli(arrival.t)
      .addUint32(arrival.source)
      .addUint32(arrival.route)
      .addUint32(arrival.cls)
      .addUint32(arrival.strip)
      .addMilli(arrival.v0Factor);
  }

  private trySpawn(
    arrival: Arrival,
    link: Link,
    time: number,
    vehicles: VehicleStore,
    obstacle?: EntryObstacle,
  ): boolean {
    const vehicle = VEHICLE_CLASSES[arrival.cls];
    const lastStrip = link.strips - vehicle.strips;
    const stride = this.laneDisciplined ? LANE_STRIPS : 1;
    const preferred = Math.floor(arrival.strip / stride) * stride;
    for (let attempt = -stride; attempt <= lastStrip; attempt += stride) {
      if (attempt === preferred) continue;
      const strip = attempt < 0 ? preferred : attempt;
      const { leader } = this;
      leader.rear = Infinity;
      leader.speed = 0;
      obstacle?.(link.id, strip, vehicle.strips, 0, leader);
      const list = vehicles.byLink[link.id];
      for (let index = vehicles.counts[link.id] - 1; index >= 0; index--) {
        const slot = list[index];
        if (vehicles.s[slot] - MAX_VEHICLE_LENGTH > leader.rear) break;
        const ahead = VEHICLE_CLASSES[vehicles.cls[slot]];
        if (shareStrip(strip, vehicle.strips, vehicles.strip[slot], ahead.strips)) {
          constrain(leader, vehicles.s[slot] - ahead.length, vehicles.v[slot]);
        }
      }
      const excess = leader.rear - vehicle.length - vehicle.standstillGap;
      if (excess < 0) continue;
      const reaction = vehicle.comfortDecel * vehicle.headway;
      const brakingSpeed =
        Math.sqrt(
          reaction * reaction + leader.speed * leader.speed + 2 * vehicle.comfortDecel * excess,
        ) - reaction;
      const desiredSpeed = vehicle.desiredSpeed * arrival.v0Factor * this.speedScale;
      const { spawn } = this;
      spawn.link = link.id;
      spawn.s = vehicle.length;
      spawn.strip = strip;
      spawn.lat = strip * this.network.stripWidth;
      spawn.v = Math.min(desiredSpeed, link.speedLimit, brakingSpeed, leader.speed + excess / DT);
      spawn.cls = arrival.cls;
      spawn.route = arrival.route;
      spawn.v0 = desiredSpeed;
      spawn.occ = vehicle.occupancy;
      spawn.tEnter = time;
      return vehicles.add(spawn) >= 0;
    }
    return false;
  }
}
