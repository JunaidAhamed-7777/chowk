import { DT, EMERGENCY_CLASS, VEHICLE_CLASSES } from "./constants";
import { type Arrival, type DemandScenario, generateDemand, type RatePoint } from "./demand";
import type { StateHash } from "./hash";
import { constrain, type Leader, shareStrip } from "./longitudinal";
import type { Network } from "./network";
import { createRandomStreams, type Random } from "./random";
import type { VehicleStore } from "./vehicles";

interface Block {
  readonly type: "block";
  readonly link: number;
  readonly start: number;
  readonly end: number;
  readonly strip: number;
  readonly strips: number;
  readonly duration: number;
}

export type SimEvent =
  | {
      readonly type: "surge";
      readonly source: number;
      readonly multiplier: number;
      readonly duration: number;
    }
  | Block
  | { readonly type: "ambulance"; readonly source: number; readonly route: number }
  | { readonly type: "sensorFreeze"; readonly junction: number; readonly duration: number }
  | { readonly type: "outage"; readonly junction: number; readonly duration: number };

export interface ScheduledEvent {
  readonly tick: number;
  readonly event: SimEvent;
}

interface ActiveBlock extends Block {
  readonly begins: number;
  readonly expires: number;
}

function rateAt(rates: readonly RatePoint[], time: number): number {
  for (let i = 1; i < rates.length; i++) {
    const a = rates[i - 1];
    const b = rates[i];
    if (time <= b.t) return a.rate + ((time - a.t) / (b.t - a.t)) * (b.rate - a.rate);
  }
  return rates[rates.length - 1].rate;
}

export function eventTicks(duration: number): number {
  const ticks = -Math.floor(-duration / DT);
  if (!Number.isSafeInteger(ticks) || ticks <= 0) throw new RangeError("Invalid event duration");
  return ticks;
}

export class Events {
  private readonly blocks: ActiveBlock[][];
  private readonly outageStart: Float64Array;
  private readonly outageEnd: Float64Array;
  private random: Random;
  private hasEvents = false;
  tick = 0;

  constructor(
    private readonly network: Network,
    seed: number,
  ) {
    this.blocks = network.links.map(() => []);
    this.outageStart = new Float64Array(network.junctions.length);
    this.outageEnd = new Float64Array(network.junctions.length);
    this.random = createRandomStreams(seed).events;
  }

  surge(event: Extract<SimEvent, { type: "surge" }>, scenario: DemandScenario): Arrival[] {
    eventTicks(event.duration);
    const base = scenario.sources.find(({ source }) => source === event.source);
    if (
      !this.network.sources[event.source] ||
      !base ||
      !Number.isFinite(event.multiplier) ||
      event.multiplier < 1
    ) {
      throw new RangeError("Invalid surge source or multiplier");
    }
    const start = (this.tick + 1) * DT;
    const end = Math.min(scenario.duration, start + event.duration);
    if (end <= start || event.multiplier === 1) return [];
    const extra = event.multiplier - 1;
    const rates = [{ t: 0, rate: extra * rateAt(base.rates, start) }];
    for (const point of base.rates) {
      if (point.t > start && point.t < end)
        rates.push({ t: point.t - start, rate: extra * point.rate });
    }
    rates.push({ t: end - start, rate: extra * rateAt(base.rates, end) });
    const arrivals = generateDemand(
      this.network,
      {
        ...scenario,
        duration: end - start,
        sources: [{ ...base, rates }],
      },
      this.random.nextUint32(),
    );
    this.hasEvents = true;
    return arrivals.map((arrival) => ({ ...arrival, t: arrival.t + start }));
  }

  ambulance(event: Extract<SimEvent, { type: "ambulance" }>): Arrival {
    const source = this.network.sources[event.source];
    if (!source || this.network.routes[event.route]?.source !== source.id) {
      throw new RangeError("Ambulance route must start at its source");
    }
    if (this.network.links[source.link].strips < VEHICLE_CLASSES[EMERGENCY_CLASS].strips) {
      throw new RangeError("The ambulance does not fit on its source link");
    }
    return {
      t: (this.tick + 1) * DT,
      source: source.id,
      cls: EMERGENCY_CLASS,
      route: event.route,
      strip: 0,
      v0Factor: 1,
    };
  }

  block(event: Block): void {
    const road = this.network.links[event.link];
    const { start, end, strip, strips } = event;
    if (
      !road ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      start >= end ||
      end > road.length ||
      !Number.isInteger(strip) ||
      !Number.isInteger(strips) ||
      strip < 0 ||
      strips < 1 ||
      strip + strips > road.strips
    ) {
      throw new RangeError("Blocked area must fit within a road link");
    }
    const begins = this.tick + 1;
    const expires = begins + eventTicks(event.duration);
    const list = this.blocks[event.link];
    for (let index = list.length - 1; index >= 0; index--) {
      if (list[index].expires <= this.tick) list.splice(index, 1);
    }
    list.push({ ...event, begins, expires });
    this.hasEvents = true;
  }

  outage(junction: number, duration: number): void {
    if (!this.network.junctions[junction]) throw new RangeError("Unknown outage junction");
    const begins = this.tick + 1;
    const expires = begins + eventTicks(duration);
    if (this.outageEnd[junction] <= begins) this.outageStart[junction] = begins;
    this.outageEnd[junction] = Math.max(expires, this.outageEnd[junction]);
    this.hasEvents = true;
  }

  readonly isOutage = (junction: number): boolean =>
    this.tick >= this.outageStart[junction] && this.tick < this.outageEnd[junction];

  readonly entryObstacle = (
    link: number,
    strip: number,
    width: number,
    offset: number,
    out: Leader,
  ): void => {
    this.constrainBlock(link, 0, strip, width, offset, out);
  };

  constrainBlock(
    link: number,
    front: number,
    strip: number,
    width: number,
    offset: number,
    out: Leader,
  ): void {
    const blocks = this.blocks[link];
    if (!blocks) return;
    for (const block of blocks) {
      if (
        front <= block.start &&
        this.active(block) &&
        shareStrip(strip, width, block.strip, block.strips)
      ) {
        constrain(out, offset + block.start, 0);
      }
    }
  }

  blocksShift(link: number, vehicles: VehicleStore, slot: number, strip: number): boolean {
    const blocks = this.blocks[link];
    const vehicle = VEHICLE_CLASSES[vehicles.cls[slot]];
    const front = vehicles.s[slot];
    for (const block of blocks) {
      if (
        front > block.start &&
        front - vehicle.length < block.end &&
        this.active(block) &&
        shareStrip(strip, vehicle.strips, block.strip, block.strips)
      )
        return true;
    }
    return false;
  }

  copyFrom(other: Events): void {
    this.tick = other.tick;
    this.random = other.random.clone();
    this.hasEvents = other.hasEvents;
    this.outageStart.set(other.outageStart);
    this.outageEnd.set(other.outageEnd);
    for (let id = 0; id < this.blocks.length; id++) this.blocks[id] = other.blocks[id].slice();
  }

  writeHash(hash: StateHash): void {
    if (!this.hasEvents) return;
    hash.addUint32(this.random.getState());
    for (let id = 0; id < this.outageEnd.length; id++) {
      if (this.outageEnd[id] > this.tick)
        hash.addUint32(id).addUint32(this.outageStart[id]).addUint32(this.outageEnd[id]);
    }
    for (const blocks of this.blocks) {
      for (const block of blocks) {
        if (block.expires <= this.tick) continue;
        hash
          .addUint32(block.link)
          .addMilli(block.start)
          .addMilli(block.end)
          .addUint32(block.strip)
          .addUint32(block.strips)
          .addUint32(block.begins)
          .addUint32(block.expires);
      }
    }
  }

  private active(block: ActiveBlock): boolean {
    return block.begins <= this.tick && this.tick < block.expires;
  }
}
