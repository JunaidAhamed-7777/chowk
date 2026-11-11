import { DEFAULT_VEHICLE_CAPACITY, MOVING_SPEED_THRESHOLD } from "./constants";
import type { StateHash } from "./hash";

export interface VehicleSpawn {
  link: number;
  s: number;
  strip: number;
  lat: number;
  v: number;
  cls: number;
  route: number;
  v0: number;
  occ: number;
  tEnter: number;
}

const INTEGER_FIELDS = ["id", "strip", "cls", "route", "routeIdx", "stops", "moving"] as const;
const CONTINUOUS_FIELDS = [
  "s",
  "lat",
  "v",
  "a",
  "v0",
  "occ",
  "tEnter",
  "delay",
  "wait",
  "lastShift",
] as const;

export class VehicleStore {
  readonly id: Uint32Array;
  readonly link: Int32Array;
  readonly s: Float64Array;
  readonly strip: Uint16Array;
  readonly lat: Float64Array;
  readonly v: Float64Array;
  readonly a: Float64Array;
  readonly cls: Uint8Array;
  readonly route: Uint32Array;
  readonly routeIdx: Uint32Array;
  readonly v0: Float64Array;
  readonly occ: Float64Array;
  readonly tEnter: Float64Array;
  readonly delay: Float64Array;
  readonly wait: Float64Array;
  readonly stops: Uint32Array;
  readonly moving: Uint8Array;
  readonly lastShift: Float64Array;
  readonly byLink: Uint32Array[];
  readonly counts: Uint32Array;
  private readonly free: Uint32Array;
  private freeCount: number;
  private nextId = 1;

  constructor(
    linkCount: number,
    readonly capacity = DEFAULT_VEHICLE_CAPACITY,
  ) {
    if (
      !Number.isInteger(linkCount) ||
      linkCount < 1 ||
      !Number.isInteger(capacity) ||
      capacity < 1
    ) {
      throw new RangeError("Vehicle storage needs positive integer segment and vehicle capacities");
    }
    this.id = new Uint32Array(capacity);
    this.link = new Int32Array(capacity).fill(-1);
    this.s = new Float64Array(capacity);
    this.strip = new Uint16Array(capacity);
    this.lat = new Float64Array(capacity);
    this.v = new Float64Array(capacity);
    this.a = new Float64Array(capacity);
    this.cls = new Uint8Array(capacity);
    this.route = new Uint32Array(capacity);
    this.routeIdx = new Uint32Array(capacity);
    this.v0 = new Float64Array(capacity);
    this.occ = new Float64Array(capacity);
    this.tEnter = new Float64Array(capacity);
    this.delay = new Float64Array(capacity);
    this.wait = new Float64Array(capacity);
    this.stops = new Uint32Array(capacity);
    this.moving = new Uint8Array(capacity);
    this.lastShift = new Float64Array(capacity);
    this.byLink = Array.from({ length: linkCount }, () => new Uint32Array(capacity));
    this.counts = new Uint32Array(linkCount);
    this.free = Uint32Array.from({ length: capacity }, (_, index) => capacity - index - 1);
    this.freeCount = capacity;
  }

  get count(): number {
    return this.capacity - this.freeCount;
  }

  add(spawn: VehicleSpawn): number {
    this.checkLink(spawn.link);
    if (this.freeCount === 0) return -1;
    const slot = this.free[--this.freeCount];
    // Render interpolation must distinguish a new vehicle from the previous owner of the slot.
    this.id[slot] = this.nextId++;
    this.link[slot] = spawn.link;
    this.s[slot] = spawn.s;
    this.strip[slot] = spawn.strip;
    this.lat[slot] = spawn.lat;
    this.v[slot] = spawn.v;
    this.a[slot] = 0;
    this.cls[slot] = spawn.cls;
    this.route[slot] = spawn.route;
    this.routeIdx[slot] = 0;
    this.v0[slot] = spawn.v0;
    this.occ[slot] = spawn.occ;
    this.tEnter[slot] = spawn.tEnter;
    this.delay[slot] = 0;
    this.wait[slot] = 0;
    this.stops[slot] = 0;
    this.moving[slot] = spawn.v > MOVING_SPEED_THRESHOLD ? 1 : 0;
    this.lastShift[slot] = -2;
    this.insert(slot, spawn.link);
    return slot;
  }

  remove(slot: number): void {
    const link = this.activeLink(slot);
    this.unlink(slot, link);
    this.link[slot] = -1;
    this.free[this.freeCount++] = slot;
  }

  move(slot: number, link: number, s: number): void {
    this.checkLink(link);
    const oldLink = this.activeLink(slot);
    this.unlink(slot, oldLink);
    this.link[slot] = link;
    this.s[slot] = s;
    this.insert(slot, link);
  }

  sort(link: number): void {
    const list = this.byLink[link];
    const count = this.counts[link];
    // Insertion sort is linear when this tick leaves most of the previous ordering intact.
    for (let index = 1; index < count; index++) {
      this.insertAt(list, index, list[index]);
    }
  }

  copyFrom(other: VehicleStore): void {
    this.link.set(other.link);
    for (const field of INTEGER_FIELDS) this[field].set(other[field]);
    for (const field of CONTINUOUS_FIELDS) this[field].set(other[field]);
    this.counts.set(other.counts);
    this.free.set(other.free);
    this.freeCount = other.freeCount;
    this.nextId = other.nextId;
    for (let segment = 0; segment < this.byLink.length; segment++) {
      this.byLink[segment].set(other.byLink[segment]);
    }
  }

  writeHash(hash: StateHash): void {
    hash.addUint32(this.nextId).addUint32(this.freeCount);
    for (let free = 0; free < this.freeCount; free++) hash.addUint32(this.free[free]);
    for (let segment = 0; segment < this.byLink.length; segment++) {
      const count = this.counts[segment];
      hash.addUint32(count);
      const list = this.byLink[segment];
      for (let index = 0; index < count; index++) {
        const slot = list[index];
        hash.addUint32(slot);
        for (const field of INTEGER_FIELDS) hash.addUint32(this[field][slot]);
        for (const field of CONTINUOUS_FIELDS) hash.addMilli(this[field][slot]);
      }
    }
  }

  private activeLink(slot: number): number {
    const link = this.link[slot];
    if (link === undefined || link < 0) throw new RangeError(`Inactive vehicle slot ${slot}`);
    return link;
  }

  private checkLink(link: number): void {
    if (this.byLink[link] === undefined) throw new RangeError(`Unknown vehicle segment ${link}`);
  }

  private insert(slot: number, link: number): void {
    this.insertAt(this.byLink[link], this.counts[link]++, slot);
  }

  private insertAt(list: Uint32Array, index: number, slot: number): void {
    const s = this.s[slot];
    const id = this.id[slot];
    while (index > 0) {
      const previous = list[index - 1];
      const previousS = this.s[previous];
      if (previousS > s || (previousS === s && this.id[previous] < id)) break;
      list[index] = previous;
      index--;
    }
    list[index] = slot;
  }

  private unlink(slot: number, link: number): void {
    const list = this.byLink[link];
    const count = this.counts[link];
    let index = 0;
    while (list[index] !== slot) index++;
    for (let tail = index + 1; tail < count; tail++) {
      list[tail - 1] = list[tail];
    }
    this.counts[link] = count - 1;
  }
}
