import {
  LANE_STRIPS,
  LOOKAHEAD,
  MAX_VEHICLE_LENGTH,
  TURN_SPEED,
  VEHICLE_CLASSES,
} from "./constants";
import type { Events } from "./events";
import type { StateHash } from "./hash";
import { constrain, type Leader, shareStrip } from "./longitudinal";
import type { Connector, Link, Network } from "./network";
import { ALL_RED, type SignalBank } from "./signals";
import type { VehicleStore } from "./vehicles";

export function mapStrip(
  strip: number,
  vehicleStrips: number,
  fromStrips: number,
  toStrips: number,
  step = 1,
): number {
  const from = Math.floor((fromStrips - vehicleStrips) / step) * step;
  const to = Math.floor((toStrips - vehicleStrips) / step);
  if (from === 0) return Math.floor(to / 2) * step;
  return Math.floor((strip * to) / from + 0.5) * step;
}

export class JunctionTraffic {
  readonly segments: (Link | Connector)[];
  readonly speedLimits: Float64Array;
  readonly routeConnectors: Int32Array[];
  readonly previousConnector: Int32Array;
  readonly connectorEntryStrip: Uint16Array;
  private readonly occupied: Int32Array;
  private readonly admission: Int32Array;
  private readonly admittedTurn: Int32Array;
  private readonly outageGrant: Uint32Array;
  private readonly stripStep: number;
  private readonly leader: Leader = { rear: Infinity, speed: 0 };

  constructor(
    private readonly network: Network,
    private readonly vehicles: VehicleStore,
    private readonly signals: SignalBank,
    laneDisciplined = false,
    private readonly events?: Events,
  ) {
    const { links, connectors, junctions, routes } = network;
    this.segments = [...links, ...connectors];
    this.speedLimits = Float64Array.from(this.segments, (segment) => {
      if ("speedLimit" in segment) return segment.speedLimit;
      return Math.min(
        links[segment.fromLink].speedLimit,
        links[segment.toLink].speedLimit,
        segment.movement === "through" ? Infinity : TURN_SPEED,
      );
    });
    const connections = new Map(
      connectors.map((connector) => [
        connector.fromLink * links.length + connector.toLink,
        connector.id,
      ]),
    );
    this.routeConnectors = routes.map(({ links: roads }) =>
      Int32Array.from(
        roads,
        (road, index) => connections.get(road * links.length + roads[index + 1]) ?? -1,
      ),
    );
    this.previousConnector = new Int32Array(vehicles.capacity).fill(-1);
    this.connectorEntryStrip = new Uint16Array(vehicles.capacity);
    this.stripStep = laneDisciplined ? LANE_STRIPS : 1;
    this.occupied = new Int32Array(junctions.length).fill(-1);
    this.admission = new Int32Array(junctions.length).fill(-1);
    this.admittedTurn = new Int32Array(junctions.length).fill(-1);
    this.outageGrant = new Uint32Array(junctions.length);
  }

  private connector(id: number): Connector {
    return this.network.connectors[id - this.network.links.length];
  }

  readonly canOpen = (junction: number): boolean => this.occupied[junction] === -1;

  copyFrom(other: JunctionTraffic): void {
    this.previousConnector.set(other.previousConnector);
    this.connectorEntryStrip.set(other.connectorEntryStrip);
    this.occupied.set(other.occupied);
    this.admission.set(other.admission);
    this.admittedTurn.set(other.admittedTurn);
    this.outageGrant.set(other.outageGrant);
  }

  writeHash(hash: StateHash): void {
    for (let slot = 0; slot < this.vehicles.capacity; slot++) {
      if (this.vehicles.link[slot] === -1) continue;
      hash.addUint32(this.previousConnector[slot]).addUint32(this.connectorEntryStrip[slot]);
    }
    for (let id = 0; id < this.outageGrant.length; id++) {
      if (this.outageGrant[id] > 0) hash.addUint32(id).addUint32(this.outageGrant[id]);
    }
  }

  readOccupancy(): void {
    const { network, vehicles, occupied } = this;
    occupied.fill(-1);
    for (const connector of network.connectors) {
      if (vehicles.counts[connector.id] > 0) occupied[connector.junction] = connector.id;
    }
    for (const road of network.links) {
      const list = vehicles.byLink[road.id];
      for (let index = vehicles.counts[road.id] - 1; index >= 0; index--) {
        const slot = list[index];
        if (vehicles.s[slot] >= MAX_VEHICLE_LENGTH) break;
        const previous = this.previousConnector[slot];
        if (previous < 0 || vehicles.s[slot] >= VEHICLE_CLASSES[vehicles.cls[slot]].length)
          continue;
        const connector = this.connector(previous);
        if (connector.toLink === road.id) occupied[connector.junction] = previous;
      }
    }
  }

  prepareAdmissions(): void {
    const { network, vehicles, signals, occupied, admission, admittedTurn } = this;
    admission.fill(-1);
    admittedTurn.fill(-1);
    for (const junction of network.junctions) {
      const id = junction.id;
      if (this.events?.isOutage(id)) {
        this.admitOutage(id);
        continue;
      }
      this.outageGrant[id] = 0;
      if (signals.state[id] === ALL_RED) continue;
      const road = network.links[junction.phases[signals.phase[id]].approaches[0]];
      const list = vehicles.byLink[road.id];
      for (let index = 0; index < vehicles.counts[road.id]; index++) {
        const slot = list[index];
        if (road.length - vehicles.s[slot] > LOOKAHEAD) break;
        const next = this.nextConnector(slot);
        if (!this.permitted(id, road, slot) || next < 0) continue;
        const connector = this.connector(next);
        if (!this.hasExitRoom(connector, slot, vehicles.strip[slot])) continue;
        if (occupied[id] !== -1 && occupied[id] !== next) {
          // Pause admissions until the preceding movement clears, then serve the front of the queue.
          break;
        }
        if (connector.movement !== "through") {
          if (occupied[id] !== -1) break;
          admittedTurn[id] = slot;
        }
        admission[id] = next;
        break;
      }
    }
  }

  private admitOutage(junction: number): void {
    const { vehicles, network } = this;
    if (this.occupied[junction] !== -1) {
      this.outageGrant[junction] = 0;
      return;
    }
    let selected = -1;
    let wait = -1;
    for (const link of network.junctions[junction].approaches) {
      const road = network.links[link];
      const list = vehicles.byLink[link];
      for (let index = 0; index < vehicles.counts[link]; index++) {
        const slot = list[index];
        if (road.length - vehicles.s[slot] > VEHICLE_CLASSES[vehicles.cls[slot]].standstillGap + 1)
          break;
        const granted = vehicles.id[slot] === this.outageGrant[junction];
        const stopped = vehicles.wait[slot] >= 2 && vehicles.v[slot] < 0.5;
        const next = this.nextConnector(slot);
        if (
          (!granted && !stopped) ||
          next < 0 ||
          !this.hasExitRoom(this.connector(next), slot, vehicles.strip[slot])
        )
          continue;
        if (granted || vehicles.wait[slot] > wait) {
          selected = slot;
          wait = granted ? Infinity : vehicles.wait[slot];
        }
      }
    }
    this.outageGrant[junction] = selected < 0 ? 0 : vehicles.id[selected];
    if (selected >= 0) {
      this.admission[junction] = this.nextConnector(selected);
      this.admittedTurn[junction] = selected;
    }
  }

  blocksShift(link: number, slot: number, strip: number): boolean {
    return this.events?.blocksShift(link, this.vehicles, slot, strip) ?? false;
  }

  nextConnector(slot: number): number {
    return this.routeConnectors[this.vehicles.route[slot]][this.vehicles.routeIdx[slot]];
  }

  exitStrip(connector: Connector, slot: number): number {
    const { network, vehicles } = this;
    return mapStrip(
      vehicles.strip[slot],
      VEHICLE_CLASSES[vehicles.cls[slot]].strips,
      connector.strips,
      network.links[connector.toLink].strips,
      this.stripStep,
    );
  }

  transition(slot: number, segment: number): boolean {
    const { network, vehicles } = this;
    const from = this.segments[segment];
    const connector = segment < network.links.length ? this.nextConnector(slot) : -1;
    if (segment < network.links.length && connector === -1) return false;
    const next = connector >= 0 ? connector : this.connector(segment).toLink;
    const width = VEHICLE_CLASSES[vehicles.cls[slot]].strips;
    if (connector >= 0) this.connectorEntryStrip[slot] = vehicles.strip[slot];
    const strip = mapStrip(
      vehicles.strip[slot],
      width,
      from.strips,
      this.segments[next].strips,
      this.stripStep,
    );
    vehicles.strip[slot] = strip;
    vehicles.lat[slot] = strip * network.stripWidth;
    if (connector < 0) {
      vehicles.routeIdx[slot]++;
      this.previousConnector[slot] = segment;
    }
    vehicles.move(slot, next, vehicles.s[slot] - from.length);
    return true;
  }

  readonly obstacle = (segment: number, slot: number, strip: number, out: Leader): void => {
    const { network, vehicles } = this;
    const current = this.segments[segment];
    const width = VEHICLE_CLASSES[vehicles.cls[slot]].strips;
    this.events?.constrainBlock(segment, vehicles.s[slot], strip, width, 0, out);
    const distance = current.length - vehicles.s[slot];
    if (distance > LOOKAHEAD + MAX_VEHICLE_LENGTH) return;
    if (segment >= network.links.length) {
      const connector = this.connector(segment);
      const road = network.links[connector.toLink];
      const target = mapStrip(strip, width, connector.strips, road.strips, this.stripStep);
      this.constrainByEntry(road.id, target, width, current.length, out);
      return;
    }

    const next = this.nextConnector(slot);
    if (next < 0) return;
    const connector = this.connector(next);
    const junction = connector.junction;
    const occupied = this.occupied[junction];
    if (occupied >= 0) {
      const active = this.connector(occupied);
      if (active.fromLink === segment) {
        if (active.movement === "through") {
          const target = mapStrip(strip, width, current.strips, active.strips, this.stripStep);
          this.constrainByEntry(occupied, target, width, current.length, out);
        } else if (vehicles.counts[occupied] > 0) {
          // A turning vehicle's tail is still in its entry strips until it clears the line.
          const turn = vehicles.byLink[occupied][0];
          const geometry = VEHICLE_CLASSES[vehicles.cls[turn]];
          const rear = vehicles.s[turn] - geometry.length;
          if (
            rear < 0 &&
            shareStrip(strip, width, this.connectorEntryStrip[turn], geometry.strips)
          ) {
            constrain(out, current.length + rear, vehicles.v[turn]);
          }
        }
      }
    }
    if (
      this.admission[junction] !== next ||
      (connector.movement !== "through" && this.admittedTurn[junction] !== slot) ||
      !this.permitted(junction, network.links[segment], slot) ||
      !this.hasExitRoom(connector, slot, strip)
    ) {
      constrain(out, current.length, 0);
    }
  };

  private permitted(junction: number, road: Link, slot: number): boolean {
    const { vehicles } = this;
    if (this.events?.isOutage(junction)) return this.admittedTurn[junction] === slot;
    return this.signals.permitsEntry(
      junction,
      road.id,
      road.length - vehicles.s[slot],
      vehicles.v[slot],
      VEHICLE_CLASSES[vehicles.cls[slot]].comfortDecel,
    );
  }

  private hasExitRoom(connector: Connector, slot: number, strip: number): boolean {
    const { network, vehicles, leader } = this;
    const { strips, length, standstillGap } = VEHICLE_CLASSES[vehicles.cls[slot]];
    const from = network.links[connector.fromLink];
    const to = network.links[connector.toLink];
    if (strips > connector.strips || strips > to.strips) return false;
    const connectorStrip = mapStrip(strip, strips, from.strips, connector.strips, this.stripStep);
    const target = mapStrip(connectorStrip, strips, connector.strips, to.strips, this.stripStep);
    leader.rear = Infinity;
    leader.speed = 0;
    this.constrainByEntry(to.id, target, strips, 0, leader);
    return leader.rear >= length + standstillGap;
  }

  private constrainByEntry(
    segment: number,
    strip: number,
    width: number,
    offset: number,
    out: Leader,
  ): void {
    const { vehicles } = this;
    this.events?.entryObstacle(segment, strip, width, offset, out);
    const list = vehicles.byLink[segment];
    for (let index = vehicles.counts[segment] - 1; index >= 0; index--) {
      const slot = list[index];
      const front = vehicles.s[slot] + offset;
      if (front - MAX_VEHICLE_LENGTH > out.rear) break;
      const candidate = VEHICLE_CLASSES[vehicles.cls[slot]];
      if (shareStrip(strip, width, vehicles.strip[slot], candidate.strips)) {
        constrain(out, front - candidate.length, vehicles.v[slot]);
      }
    }
  }
}
