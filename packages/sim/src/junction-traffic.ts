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

const movementRank = { left: 0, through: 1, right: 2 } as const;
// Box entries past this distance from the stop line do not yet constrain movements beside them.
const GRANT_HORIZON = 30;
const MAX_BOX_ENTRIES = 64;
// Assumed clearance between consecutive vehicles on a turn, in metres of world distance.
const TURN_CLEARANCE = 0.5;
// Floor on the inner-edge compression so a very tight corner still moves.
const MIN_TURN_SCALE = 0.15;

/**
 * Movements from one approach share the box when their paths cannot cross.
 * Under approach-based phasing no other approach has green, so the only conflicts
 * are a turn sweeping across vehicles beside it. Strip 0 is the kerb side, so a
 * left turn must sit kerbward of every through or right movement entering with it.
 */
function crosses(
  rankA: number,
  startA: number,
  widthA: number,
  rankB: number,
  startB: number,
  widthB: number,
  margin: number,
): boolean {
  if (rankA === rankB) return false;
  return rankA < rankB ? startA + widthA + margin > startB : startB + widthB + margin > startA;
}

// Assumed clearance, in strips, beside a turning vehicle for the swing of its body;
// a long vehicle's rear tracks inside its front.
function bodySwing(length: number): number {
  return length > 8 ? 6 : 3;
}

/**
 * Radius of a turn's bend. Paths are authored as a straight lead-in, a circular bend and a
 * straight lead-out; the bend's chord and the angle between the roads give the radius.
 */
function bendRadius(connector: Connector, links: readonly Link[]): number {
  const { path } = connector;
  const incoming = links[connector.fromLink].dir;
  const outgoing = links[connector.toLink].dir;
  const aligned = (index: number, dir: readonly [number, number] | readonly number[]) => {
    const dx = path[index + 1][0] - path[index][0];
    const dz = path[index + 1][1] - path[index][1];
    const length = Math.sqrt(dx * dx + dz * dz);
    return (dx * dir[0] + dz * dir[1]) / length > 0.999999;
  };
  const last = path.length - 1;
  const start = path.length > 3 && aligned(0, incoming) ? 1 : 0;
  const end = path.length > 3 && aligned(last - 1, outgoing) ? last - 1 : last;
  const dx = path[end][0] - path[start][0];
  const dz = path[end][1] - path[start][1];
  const chord = Math.sqrt(dx * dx + dz * dz);
  // chord = 2R·sin(θ/2) and 1 − cos θ = 2·sin²(θ/2), with cos θ the dot product of the roads.
  const cosine = incoming[0] * outgoing[0] + incoming[1] * outgoing[1];
  const halfSine = Math.sqrt(Math.max(1e-6, (1 - cosine) / 2));
  return chord / (2 * halfSine);
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
  private readonly granted: Uint8Array;
  private readonly grantedSlots: Int32Array;
  private grantedCount = 0;
  private readonly boxCount: Int32Array;
  private readonly boxApproach: Int32Array;
  private readonly boxRank: Int8Array;
  private readonly boxConnector: Int32Array;
  private readonly boxMargin: Int8Array;
  private readonly boxStart: Int16Array;
  private readonly boxWidth: Int16Array;
  private readonly approachConnectors: number[][];
  /** Radius of each connector's bend in metres; zero for through movements. */
  private readonly turnRadius: Float64Array;
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
    this.granted = new Uint8Array(vehicles.capacity);
    this.grantedSlots = new Int32Array(vehicles.capacity);
    this.boxCount = new Int32Array(junctions.length);
    this.boxApproach = new Int32Array(junctions.length * MAX_BOX_ENTRIES);
    this.boxRank = new Int8Array(junctions.length * MAX_BOX_ENTRIES);
    this.boxConnector = new Int32Array(junctions.length * MAX_BOX_ENTRIES);
    this.boxMargin = new Int8Array(junctions.length * MAX_BOX_ENTRIES);
    this.boxStart = new Int16Array(junctions.length * MAX_BOX_ENTRIES);
    this.boxWidth = new Int16Array(junctions.length * MAX_BOX_ENTRIES);
    this.turnRadius = Float64Array.from(connectors, (connector) =>
      connector.movement === "through" ? 0 : bendRadius(connector, links),
    );
    this.approachConnectors = links.map(({ id }) =>
      connectors.filter((connector) => connector.fromLink === id).map((connector) => connector.id),
    );
  }

  private addToBox(
    junction: number,
    connector: number,
    approach: number,
    rank: number,
    start: number,
    width: number,
    margin: number,
  ): void {
    const count = this.boxCount[junction];
    if (count >= MAX_BOX_ENTRIES) return;
    const index = junction * MAX_BOX_ENTRIES + count;
    this.boxConnector[index] = connector;
    this.boxApproach[index] = approach;
    this.boxRank[index] = rank;
    this.boxStart[index] = start;
    this.boxWidth[index] = width;
    this.boxMargin[index] = margin;
    this.boxCount[junction] = count + 1;
  }

  private boxConflict(
    junction: number,
    connector: number,
    approach: number,
    rank: number,
    start: number,
    width: number,
    margin: number,
  ): boolean {
    const base = junction * MAX_BOX_ENTRIES;
    for (let index = base; index < base + this.boxCount[junction]; index++) {
      if (this.boxApproach[index] !== approach) return true;
      if (
        crosses(
          rank,
          start,
          width,
          this.boxRank[index],
          this.boxStart[index],
          this.boxWidth[index],
          Math.max(margin, this.boxMargin[index]),
        )
      )
        return true;
    }
    return false;
  }

  /**
   * Strips a turn carries a vehicle sideways past its entry strips, towards the movements
   * beside it. Snapshot positions blend from the entry offset on the approach to the exit
   * offset on the outgoing road, both measured from the road centre.
   */
  private sweepMargin(
    connector: Connector,
    entryStrip: number,
    connectorStrip: number,
    width: number,
    length: number,
  ): number {
    if (connector.movement === "through") return 0;
    const { links } = this.network;
    const incoming = links[connector.fromLink].strips;
    const outgoing = links[connector.toLink].strips;
    const exit = mapStrip(connectorStrip, width, connector.strips, outgoing, this.stripStep);
    const drift = exit - entryStrip + (incoming - outgoing) / 2;
    const towardNeighbours = connector.movement === "left" ? drift : -drift;
    return Math.ceil(Math.max(0, towardNeighbours)) + bodySwing(length);
  }

  /**
   * Arc length is measured along a turn's centre line. A vehicle offset from it travels a
   * shorter or longer arc, so the world distance between two vehicles on the bend is the
   * arc distance scaled by (R − d) / R for the inner edge at offset d. Offsets blend from the
   * entry strip to the exit strip, so the one nearer the inside of the bend bounds the edge.
   */
  private turnScale(
    connector: Connector,
    entryStrip: number,
    exitStrip: number,
    width: number,
  ): number {
    const { links, stripWidth } = this.network;
    const radius = this.turnRadius[connector.id - links.length];
    const entry = (entryStrip + (width - links[connector.fromLink].strips) / 2) * stripWidth;
    const exit = (exitStrip + (width - links[connector.toLink].strips) / 2) * stripWidth;
    // Strip 0 is the kerb, so offsets below the centre line are inside a left turn and
    // offsets above it are inside a right turn.
    const inside = connector.movement === "left" ? -Math.min(entry, exit) : Math.max(entry, exit);
    const inner = inside + (width * stripWidth) / 2;
    return Math.min(1, Math.max(MIN_TURN_SCALE, (radius - inner) / radius));
  }

  private exitStripFrom(connector: Connector, connectorStrip: number, width: number): number {
    return mapStrip(
      connectorStrip,
      width,
      connector.strips,
      this.network.links[connector.toLink].strips,
      this.stripStep,
    );
  }

  /**
   * Turning vehicles follow one another in a single stream. The follower holds back until
   * the world gap to the vehicle ahead clears both bodies and TURN_CLEARANCE on the inner edge.
   * leaderFront and followerFront are arc positions on the connector.
   */
  private followTurn(
    follower: number,
    followerScale: number,
    followerFront: number,
    leader: number,
    leaderScale: number,
    leaderFront: number,
    out: Leader,
  ): void {
    const { vehicles } = this;
    const ahead = VEHICLE_CLASSES[vehicles.cls[leader]];
    const own = VEHICLE_CLASSES[vehicles.cls[follower]];
    const scale = Math.min(followerScale, leaderScale);
    const centres = ((ahead.length + own.length) / 2 + TURN_CLEARANCE) / scale;
    const spacing = centres + (ahead.length - own.length) / 2;
    // Hold a follower that is already too close where it is, rather than push it back.
    // Turn paths are narrower than their approaches, so a turn is single file whatever the
    // strips: at least the vehicle ahead's length, more on the inside of a tight bend.
    const rear = Math.min(leaderFront - ahead.length, leaderFront - spacing + own.standstillGap);
    constrain(out, Math.max(followerFront, rear), vehicles.v[leader]);
  }

  /** Constrain a vehicle on, or about to enter, a turn by the stream ahead of it. */
  private constrainTurnStream(
    connector: Connector,
    slot: number,
    scale: number,
    front: number,
    offset: number,
    out: Leader,
  ): void {
    const { vehicles, network } = this;
    const id = connector.id;
    let leader = -1;
    let leaderFront = Infinity;
    // Lists are ordered front to back with ties broken by id, so everything listed before a
    // vehicle is ahead of it, including a vehicle level with it.
    const onTurn = vehicles.link[slot] === id;
    for (let index = 0; index < vehicles.counts[id]; index++) {
      const other = vehicles.byLink[id][index];
      if (other === slot) break;
      const otherFront = vehicles.s[other] + offset;
      if (otherFront < leaderFront || (onTurn && otherFront === leaderFront)) {
        leader = other;
        leaderFront = otherFront;
      }
    }
    if (offset > 0) {
      // Vehicles still on the approach and bound for the same turn join the stream ahead.
      const approach = connector.fromLink;
      const list = vehicles.byLink[approach];
      for (let index = 0; index < vehicles.counts[approach]; index++) {
        const other = list[index];
        if (other === slot) break;
        const otherFront = vehicles.s[other];
        if (this.nextConnector(other) !== id) continue;
        if (otherFront < leaderFront) {
          leader = other;
          leaderFront = otherFront;
        }
      }
    }
    if (leader < 0) {
      // The vehicle ahead may already be on the outgoing road while its body is in the bend.
      const road = connector.toLink;
      for (let index = vehicles.counts[road] - 1; index >= 0; index--) {
        const other = vehicles.byLink[road][index];
        if (vehicles.s[other] > MAX_VEHICLE_LENGTH * 3) break;
        if (this.previousConnector[other] !== id) continue;
        const otherFront = connector.length + vehicles.s[other] + offset;
        if (otherFront < leaderFront) {
          leader = other;
          leaderFront = otherFront;
        }
      }
    }
    if (leader < 0) return;
    const geometry = VEHICLE_CLASSES[vehicles.cls[leader]];
    const where = vehicles.link[leader];
    const leaderStrip = vehicles.strip[leader];
    let leaderEntry = this.connectorEntryStrip[leader];
    let leaderExit = leaderStrip;
    if (where === connector.fromLink) {
      leaderEntry = leaderStrip;
      const onConnector = mapStrip(
        leaderStrip,
        geometry.strips,
        network.links[where].strips,
        connector.strips,
        this.stripStep,
      );
      leaderExit = this.exitStripFrom(connector, onConnector, geometry.strips);
    } else if (where === id) {
      leaderExit = this.exitStripFrom(connector, leaderStrip, geometry.strips);
    }
    const leaderScale = this.turnScale(connector, leaderEntry, leaderExit, geometry.strips);
    this.followTurn(slot, scale, front, leader, leaderScale, leaderFront, out);
  }

  private recordBoxVehicle(slot: number, connectorId: number): void {
    const connector = this.connector(connectorId);
    const geometry = VEHICLE_CLASSES[this.vehicles.cls[slot]];
    const entry = this.connectorEntryStrip[slot];
    const connectorStrip = mapStrip(
      entry,
      geometry.strips,
      this.network.links[connector.fromLink].strips,
      connector.strips,
      this.stripStep,
    );
    this.addToBox(
      connector.junction,
      connectorId,
      connector.fromLink,
      movementRank[connector.movement],
      entry,
      geometry.strips,
      this.sweepMargin(connector, entry, connectorStrip, geometry.strips, geometry.length),
    );
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
    this.boxCount.fill(0);
    for (const connector of network.connectors) {
      const count = vehicles.counts[connector.id];
      if (count > 0) occupied[connector.junction] = connector.id;
      for (let index = 0; index < count; index++) {
        this.recordBoxVehicle(vehicles.byLink[connector.id][index], connector.id);
      }
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
        if (connector.toLink !== road.id) continue;
        occupied[connector.junction] = previous;
        this.recordBoxVehicle(slot, previous);
      }
    }
  }

  prepareAdmissions(): void {
    const { network, vehicles, signals, admission, admittedTurn, granted, grantedSlots } = this;
    admission.fill(-1);
    admittedTurn.fill(-1);
    for (let index = 0; index < this.grantedCount; index++) granted[grantedSlots[index]] = 0;
    this.grantedCount = 0;
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
      // Serve the approach front to back. A vehicle enters unless a movement already in the box,
      // or one granted ahead of it, would cross its path.
      for (let index = 0; index < vehicles.counts[road.id]; index++) {
        const slot = list[index];
        const distance = road.length - vehicles.s[slot];
        if (distance > LOOKAHEAD) break;
        const next = this.nextConnector(slot);
        if (!this.permitted(id, road, slot) || next < 0) continue;
        const connector = this.connector(next);
        if (!this.hasExitRoom(connector, slot, vehicles.strip[slot])) continue;
        const rank = movementRank[connector.movement];
        const geometry = VEHICLE_CLASSES[vehicles.cls[slot]];
        const width = geometry.strips;
        const strip = vehicles.strip[slot];
        const connectorStrip = mapStrip(
          strip,
          width,
          road.strips,
          connector.strips,
          this.stripStep,
        );
        const margin = this.sweepMargin(connector, strip, connectorStrip, width, geometry.length);
        if (this.boxConflict(id, next, road.id, rank, strip, width, margin)) continue;
        granted[slot] = 1;
        grantedSlots[this.grantedCount++] = slot;
        if (distance <= GRANT_HORIZON || rank !== movementRank.through)
          this.addToBox(id, next, road.id, rank, strip, width, margin);
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
      if (connector.movement !== "through") {
        const scale = this.turnScale(connector, this.connectorEntryStrip[slot], target, width);
        this.constrainTurnStream(connector, slot, scale, vehicles.s[slot], 0, out);
      }
      return;
    }

    const next = this.nextConnector(slot);
    if (next < 0) return;
    const connector = this.connector(next);
    const junction = connector.junction;
    if (connector.movement === "through" && vehicles.counts[next] > 0) {
      const target = mapStrip(strip, width, current.strips, connector.strips, this.stripStep);
      this.constrainByEntry(next, target, width, current.length, out);
    } else if (connector.movement !== "through") {
      const connectorStrip = mapStrip(
        strip,
        width,
        current.strips,
        connector.strips,
        this.stripStep,
      );
      const scale = this.turnScale(
        connector,
        strip,
        this.exitStripFrom(connector, connectorStrip, width),
        width,
      );
      this.constrainTurnStream(connector, slot, scale, vehicles.s[slot], current.length, out);
    }
    for (const entered of this.approachConnectors[segment]) {
      if (entered === next && connector.movement === "through") continue;
      // A vehicle's tail stays in its entry strips until it clears the stop line.
      for (let index = vehicles.counts[entered] - 1; index >= 0; index--) {
        const ahead = vehicles.byLink[entered][index];
        const geometry = VEHICLE_CLASSES[vehicles.cls[ahead]];
        const rear = vehicles.s[ahead] - geometry.length;
        if (rear >= 0) break;
        if (shareStrip(strip, width, this.connectorEntryStrip[ahead], geometry.strips)) {
          constrain(out, current.length + rear, vehicles.v[ahead]);
        }
      }
    }
    const admitted = this.events?.isOutage(junction)
      ? this.admission[junction] === next && this.admittedTurn[junction] === slot
      : this.granted[slot] === 1;
    if (
      !admitted ||
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
