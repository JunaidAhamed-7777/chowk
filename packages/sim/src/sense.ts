import {
  EMERGENCY_CLASS,
  FAR_ZONE_METRES,
  NEAR_ZONE_METRES,
  QUEUE_SPEED_THRESHOLD,
  QUEUE_ZONE_METRES,
  VEHICLE_CLASSES,
} from "./constants";
import type { StateHash } from "./hash";
import type { Link, Network } from "./network";
import { createRandomStreams, Random } from "./random";
import type { SignalBank, SignalState } from "./signals";
import type { VehicleStore } from "./vehicles";

export interface ExitSense {
  readonly link: number;
  readonly area: number;
  readonly count: number;
}

export interface ApproachSense {
  areaNear: number;
  areaMid: number;
  areaFar: number;
  stoppedArea: number;
  count: number;
  countNear?: number;
  countMid?: number;
  countFar?: number;
  stoppedCount?: number;
  people: number;
  waitMax: number;
  emergency: 0 | 1;
  outArea: number;
  exits: ExitSense[];
}

export interface JunctionSense {
  approaches: ApproachSense[];
  phase: number;
  state: SignalState;
  elapsed: number;
}

export interface SensingOptions {
  seed: number;
  noise?: number;
  dropout?: number;
}

function overlap(rear: number, front: number, start: number, end: number): number {
  return Math.max(0, Math.min(front, end) - Math.max(rear, start));
}

function fraction(area: number, zoneArea: number): number {
  return zoneArea > 0 ? Math.min(1, area / zoneArea) : 0;
}

function gaussian(random: Random): number {
  // Summing 12 uniforms approximates a standard normal with fixed draws and arithmetic.
  let value = -6;
  for (let draw = 0; draw < 12; draw++) value += random.next();
  return value;
}

export class Sensing {
  private readonly exits: number[][];
  private readonly noise: number;
  private readonly dropout: number;
  private readonly eventSeed: number;
  private readonly seed: number;
  private readonly frozen: (ApproachSense[] | undefined)[];
  private readonly frozenFrom: Float64Array;
  private readonly frozenUntil: Float64Array;

  constructor(
    private readonly network: Network,
    private readonly vehicles: VehicleStore,
    private readonly signals: SignalBank,
    options?: SensingOptions,
  ) {
    this.noise = options?.noise ?? 0;
    this.dropout = options?.dropout ?? 0;
    if (!Number.isFinite(this.noise) || this.noise < 0 || this.noise > 1) {
      throw new RangeError("Sensor noise must be a standard deviation between 0 and 1");
    }
    if (!Number.isFinite(this.dropout) || this.dropout < 0 || this.dropout > 1) {
      throw new RangeError("Sensor dropout must be a probability between 0 and 1");
    }
    this.seed = options?.seed ?? 0;
    this.frozen = network.junctions.map(() => undefined);
    this.frozenFrom = new Float64Array(network.junctions.length);
    this.frozenUntil = new Float64Array(network.junctions.length);
    this.eventSeed = createRandomStreams(this.seed).events.getState();
    this.exits = network.links.map(() => []);
    for (const connector of network.connectors) {
      this.exits[connector.fromLink].push(connector.toLink);
    }
    for (const exits of this.exits) exits.sort((first, second) => first - second);
  }

  read(junctionId: number, tick: number): JunctionSense {
    const junction = this.network.junctions[junctionId];
    if (!junction) throw new RangeError(`Unknown junction ${junctionId}`);
    const frozen = this.frozen[junctionId];
    if (frozen && tick >= this.frozenFrom[junctionId] && tick < this.frozenUntil[junctionId]) {
      return {
        ...this.signals.stateAt(junctionId),
        approaches: frozen.map((item) => ({
          ...item,
          exits: item.exits.map((exit) => ({ ...exit })),
        })),
      };
    }
    // The same sensor reading must reach the controller regardless of UI polling or read order.
    const random =
      this.noise > 0 || this.dropout > 0
        ? new Random(
            this.eventSeed ^ Math.imul(tick, 0x9e3779b9) ^ Math.imul(junctionId, 0x85ebca6b),
          )
        : undefined;
    const exitSamples: (ExitSense | undefined)[] = [];
    const approaches = junction.approaches.map((id) =>
      this.readApproach(this.network.links[id], exitSamples, random),
    );
    return { ...this.signals.stateAt(junctionId), approaches };
  }

  freeze(junction: number, tick: number, duration: number): void {
    this.frozen[junction] = this.read(junction, tick).approaches;
    this.frozenFrom[junction] = tick + 1;
    this.frozenUntil[junction] = Math.max(this.frozenUntil[junction], tick + 1 + duration);
  }

  writeHash(hash: StateHash, tick: number): void {
    for (let id = 0; id < this.frozenUntil.length; id++) {
      const readings = this.frozen[id];
      if (!readings || this.frozenUntil[id] <= tick) continue;
      hash.addUint32(id).addUint32(this.frozenFrom[id]).addUint32(this.frozenUntil[id]);
      for (const sense of readings) {
        hash
          .addMilli(sense.areaNear)
          .addMilli(sense.areaMid)
          .addMilli(sense.areaFar)
          .addMilli(sense.stoppedArea)
          .addUint32(sense.count)
          .addMilli(sense.people)
          .addMilli(sense.waitMax)
          .addUint32(sense.emergency);
        for (const exit of sense.exits)
          hash.addUint32(exit.link).addMilli(exit.area).addUint32(exit.count);
      }
    }
  }

  copy(vehicles: VehicleStore, signals: SignalBank): Sensing {
    const copy = new Sensing(this.network, vehicles, signals, {
      seed: this.seed,
      noise: this.noise,
      dropout: this.dropout,
    });
    copy.frozenFrom.set(this.frozenFrom);
    copy.frozenUntil.set(this.frozenUntil);
    for (let id = 0; id < this.frozen.length; id++) copy.frozen[id] = this.frozen[id];
    return copy;
  }

  private readApproach(
    link: Link,
    exitSamples: (ExitSense | undefined)[],
    random: Random | undefined,
  ): ApproachSense {
    const { vehicles, network } = this;
    if (random && this.dropout > 0 && random.next() < this.dropout) {
      return {
        areaNear: 0,
        areaMid: 0,
        areaFar: 0,
        stoppedArea: 0,
        count: 0,
        countNear: 0,
        countMid: 0,
        countFar: 0,
        stoppedCount: 0,
        people: 0,
        waitMax: 0,
        emergency: 0,
        outArea: 0,
        exits: this.exits[link.id].map((id) => ({ link: id, area: 0, count: 0 })),
      };
    }

    const length = link.length;
    const width = link.strips * network.stripWidth;
    const near = Math.max(0, length - NEAR_ZONE_METRES);
    const mid = Math.max(0, length - QUEUE_ZONE_METRES);
    const far = Math.max(0, length - FAR_ZONE_METRES);
    let nearArea = 0;
    let midArea = 0;
    let farArea = 0;
    let stoppedArea = 0;
    let count = 0;
    let countNear = 0;
    let countFar = 0;
    let stoppedCount = 0;
    let people = 0;
    let waitMax = 0;
    let emergency: 0 | 1 = 0;
    const list = vehicles.byLink[link.id];
    for (let index = 0; index < vehicles.counts[link.id]; index++) {
      const slot = list[index];
      const front = vehicles.s[slot];
      if (front < far) break;
      const cls = vehicles.cls[slot];
      const vehicle = VEHICLE_CLASSES[cls];
      const rear = front - vehicle.length;
      nearArea += overlap(rear, front, near, length) * vehicle.width;
      midArea += overlap(rear, front, mid, near) * vehicle.width;
      farArea += overlap(rear, front, far, mid) * vehicle.width;
      if (vehicles.v[slot] < QUEUE_SPEED_THRESHOLD) {
        stoppedArea += overlap(rear, front, mid, length) * vehicle.width;
      }
      if (front >= mid && front <= length) {
        count++;
        if (front >= near) countNear++;
        if (vehicles.v[slot] < QUEUE_SPEED_THRESHOLD) stoppedCount++;
        people += vehicles.occ[slot];
        waitMax = Math.max(waitMax, vehicles.wait[slot]);
      } else if (front < mid) countFar++;
      if (cls === EMERGENCY_CLASS && front <= length) emergency = 1;
    }

    const exits = this.exits[link.id].map(
      (id) => (exitSamples[id] ??= this.readExit(network.links[id], random)),
    );
    let outArea = 0;
    for (const exit of exits) outArea += exit.area;
    return {
      areaNear: this.perturb(fraction(nearArea, (length - near) * width), random, 1),
      areaMid: this.perturb(fraction(midArea, (near - mid) * width), random, 1),
      areaFar: this.perturb(fraction(farArea, (mid - far) * width), random, 1),
      stoppedArea: this.perturb(fraction(stoppedArea, (length - mid) * width), random, 1),
      count: Math.floor(this.perturb(count, random) + 0.5),
      countNear,
      countMid: count - countNear,
      countFar,
      stoppedCount,
      people: this.perturb(people, random),
      waitMax: this.perturb(waitMax, random),
      emergency,
      outArea: exits.length > 0 ? outArea / exits.length : 0,
      exits,
    };
  }

  private readExit(link: Link, random: Random | undefined): ExitSense {
    const { vehicles, network } = this;
    const end = Math.min(link.length, NEAR_ZONE_METRES);
    let occupied = 0;
    let count = 0;
    const list = vehicles.byLink[link.id];
    for (let index = 0; index < vehicles.counts[link.id]; index++) {
      const slot = list[index];
      const vehicle = VEHICLE_CLASSES[vehicles.cls[slot]];
      const front = vehicles.s[slot];
      occupied += overlap(front - vehicle.length, front, 0, end) * vehicle.width;
      if (front >= 0 && front <= end) count++;
    }
    return {
      link: link.id,
      area: this.perturb(fraction(occupied, end * link.strips * network.stripWidth), random, 1),
      count: Math.floor(this.perturb(count, random) + 0.5),
    };
  }

  private perturb(value: number, random: Random | undefined, max = Infinity): number {
    return random && this.noise > 0
      ? Math.min(max, Math.max(0, value * (1 + this.noise * gaussian(random))))
      : value;
  }
}
